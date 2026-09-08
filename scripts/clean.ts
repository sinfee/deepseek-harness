import { lstat, readdir, realpath, rm } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { repositoryConfigHost } from './ts-project.ts'

const knownOrphanEntries = new Set(['node_modules', 'lib', '.typecheck'])

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (isMissing(error)) return false
    throw error
  }
}

async function childDirectories(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.filter(entry => entry.isDirectory()).map(entry => join(path, entry.name))
  } catch (error) {
    if (isMissing(error)) return []
    throw error
  }
}

function repositoryPath(root: string, path: string): string {
  return relative(root, path).split(sep).join('/')
}

function parseConfig(configPath: string): ts.ParsedCommandLine {
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, repositoryConfigHost)
  if (!parsed) throw new Error(`clean: cannot parse TypeScript config ${configPath}`)
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'))
  }
  return parsed
}

/** Plans and removes repository-owned build output without crossing the repository boundary. */
export class RepositoryCleaner {
  private readonly root: string

  constructor(root: string) {
    this.root = resolve(root)
  }

  /**
   * Remove generated build state and package directories containing only known residue.
   * @returns Repository-relative paths that were removed.
   */
  async clean(): Promise<string[]> {
    const targets = await this.plan()
    // Planning validates every target first, so an unsafe orphan prevents all deletion.
    for (const target of targets) await rm(target, { recursive: true, force: true })
    return targets.map(target => repositoryPath(this.root, target))
  }

  private async plan(): Promise<string[]> {
    const targets = new Set<string>()
    const unsafeOrphans: string[] = []
    const canonicalRoot = await realpath(this.root)

    await this.addIfPresent(targets, join(this.root, '.dsh-build'), canonicalRoot)
    await this.addIfPresent(targets, join(this.root, 'apps/desktop/.desktop-build'), canonicalRoot)

    // These checks cover legacy root-level incremental state emitted by older configs.
    await this.addIfPresent(targets, join(this.root, '.typecheck'), canonicalRoot)
    for (const entry of await readdir(this.root, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.tsbuildinfo')) targets.add(join(this.root, entry.name))
    }
    await this.addIfPresent(
      targets,
      join(this.root, 'native/system/tsconfig.tsbuildinfo'),
      canonicalRoot,
    )

    // The root project-reference graph is the source of truth for live build targets.
    // Each emitting project declares lib/types as outDir; its parent lib also owns
    // the sibling runtime bundles, so the complete build output root is removed.
    for (const outputDirectory of this.buildOutputDirectories()) {
      await this.addIfPresent(targets, outputDirectory, canonicalRoot)
    }

    for (const packageDirectory of await this.workspacePackageDirectories()) {
      // package.json 表示目录仍是有效工作区；其输出已由上面的项目图处理，
      // 包内 node_modules 必须保留。
      if (await exists(join(packageDirectory, 'package.json'))) {
        continue
      }

      // packages/*/* 和 vendor/* 都可能在上游删除包后遗留仅含 node_modules
      // 的空壳。tsdown 会把这种目录误识别为工作区，因此必须在构建前清除。
      const entries = await readdir(packageDirectory)
      const unknown = entries.filter(entry => !knownOrphanEntries.has(entry) && !entry.endsWith('.tsbuildinfo'))
      if (unknown.length > 0) {
        unsafeOrphans.push(...unknown.map(entry => repositoryPath(this.root, join(packageDirectory, entry))))
      } else {
        await this.addIfPresent(targets, packageDirectory, canonicalRoot)
      }
    }

    if (unsafeOrphans.length > 0) {
      throw new Error([
        'clean: refusing to remove package directories without package.json; unknown entries remain:',
        ...unsafeOrphans.sort().map(path => `  ${path}`),
      ].join('\n'))
    }

    return [...targets].sort()
  }

  private async workspacePackageDirectories(): Promise<string[]> {
    const directories = await childDirectories(join(this.root, 'vendor'))
    for (const groupDirectory of await childDirectories(join(this.root, 'packages'))) {
      directories.push(...await childDirectories(groupDirectory))
    }
    return directories
  }

  private buildOutputDirectories(): string[] {
    const outputs = new Set<string>()
    const pending = [join(this.root, 'tsconfig.json')]
    const visited = new Set<string>()
    const nativeEntryOutput = join(this.root, 'native/system/packages/entry/lib')

    while (pending.length > 0) {
      const nextConfigPath = pending.pop()
      if (nextConfigPath === undefined) break
      const configPath = resolve(nextConfigPath)
      if (visited.has(configPath)) continue
      visited.add(configPath)

      const parsed = parseConfig(configPath)
      if (parsed.options.outDir !== undefined) {
        const typesDirectory = resolve(parsed.options.outDir)
        const outputDirectory = basename(typesDirectory) === 'types'
          ? dirname(typesDirectory)
          : typesDirectory === nativeEntryOutput
            ? typesDirectory
            : undefined
        if (outputDirectory === undefined) {
          throw new Error(`clean: expected TypeScript outDir to end in /types: ${repositoryPath(this.root, typesDirectory)}`)
        }
        this.assertRepositoryTarget(outputDirectory)
        outputs.add(outputDirectory)
      }

      for (const reference of parsed.projectReferences ?? []) {
        pending.push(ts.resolveProjectReferencePath(reference))
      }
    }

    return [...outputs]
  }

  private assertRepositoryTarget(path: string): void {
    this.assertDescendant(this.root, path, path)
  }

  private assertDescendant(root: string, path: string, displayPath: string): void {
    const repositoryRelative = relative(root, path)
    if (repositoryRelative === '' || repositoryRelative === '..' || repositoryRelative.startsWith(`..${sep}`) || isAbsolute(repositoryRelative)) {
      throw new Error(`clean: refusing deletion target outside repository: ${displayPath}`)
    }
  }

  private async addIfPresent(targets: Set<string>, path: string, canonicalRoot: string): Promise<void> {
    // Missing outputs are normal on a clean checkout; only existing paths become deletion targets.
    if (!await exists(path)) return
    // Resolve the parent rather than the final entry: rm unlinks a final symlink,
    // but a symlink in an ancestor would make deletion cross the repository boundary.
    const canonicalParent = await realpath(dirname(path))
    this.assertDescendant(canonicalRoot, join(canonicalParent, basename(path)), path)
    targets.add(path)
  }
}

const scriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] !== undefined && resolve(process.argv[1]) === scriptPath) {
  try {
    const removed = await new RepositoryCleaner(resolve(dirname(scriptPath), '..')).clean()
    if (removed.length === 0) {
      console.log('clean: already clean')
    } else {
      console.log(`clean: removed ${removed.length} paths`)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
