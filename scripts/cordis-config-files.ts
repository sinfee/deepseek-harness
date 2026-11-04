/** Cordis Loader configuration file discovery. */

import { globSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

/**
 * 读取 Loader 配置，兼容 Windows 将 Git 符号链接检出为路径文本的情况。
 * @param root - 仓库根目录。
 * @param file - 仓库相对配置路径。
 * @returns 真实配置文本；普通 YAML 标量不会被当作链接。
 */
export function readCordisConfigSource(root: string, file: string): string {
  let current = file
  for (let depth = 0; depth < 8; depth++) {
    const content = readFileSync(resolve(root, current), 'utf8')
    if (!/^\.\.?[/\\][^\r\n]+\.ya?ml\s*$/.test(content)) return content
    const indexed = execFileSync('git', ['ls-files', '--stage', '--', current], { cwd: root, encoding: 'utf8' })
    if (!indexed.startsWith('120000 ')) return content
    const target = resolve(root, dirname(current), content.trim())
    const next = relative(root, target)
    if (isAbsolute(next) || next === '..' || next.startsWith('../') || next.startsWith('..\\')) {
      throw new Error(`Loader 配置链接越出仓库：${current}`)
    }
    current = next
  }
  throw new Error(`Loader 配置链接循环或层级过深：${file}`)
}

/**
 * Return repository-relative Cordis Loader YAML paths under `root`.
 *
 * Translation consistency records are YAML sidecars, never Loader inputs.
 *
 * @param root Repository root to scan.
 * @returns Sorted repository-relative Loader configuration paths.
 */
export function cordisConfigFiles(root: string): string[] {
  return globSync(['**/*cordis*.yml', '**/*cordis*.yaml'], {
    cwd: root,
    exclude: ['.claude/**', 'node_modules/**', 'vendor/**', '**/*.i18n.yaml'],
  }).sort()
}
