import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { prepareDesktopProfile, prepareDesktopEnvironment } from '../src/profile-bootstrap.ts'

it('初始化等待实际模块完成，并拒绝相对路径、缺失入口和执行失败', async () => {
  const root = await mkdtemp(join(tmpdir(), 'thk-bootstrap-'))
  const paths = { profile: root, runtime: '运行时', support: '支持目录' }
  try {
    await prepareDesktopProfile(undefined, paths)
    await prepareDesktopEnvironment(undefined)
    await expect(prepareDesktopEnvironment('relative.mjs')).rejects.toThrow('绝对路径')
    await expect(prepareDesktopProfile('relative.mjs', paths)).rejects.toThrow('绝对路径')
    await writeFile(join(root, 'empty.mjs'), 'export const empty = true')
    await expect(prepareDesktopEnvironment(join(root, 'empty.mjs'))).rejects.toThrow('prepareStartup')
    await expect(prepareDesktopProfile(join(root, 'empty.mjs'), paths)).rejects.toThrow('prepareProfile')
    await writeFile(join(root, 'fail.mjs'), 'export function prepareProfile() { throw new Error("安装失败") }')
    await expect(prepareDesktopProfile(join(root, 'fail.mjs'), paths)).rejects.toThrow('安装失败')
    await writeFile(join(root, 'ok.mjs'), 'import { writeFile } from "node:fs/promises"; import { join } from "node:path"; export async function prepareProfile(input) { await writeFile(join(input.profile, "done.json"), JSON.stringify(input)) }')
    await prepareDesktopProfile(join(root, 'ok.mjs'), paths)
    expect(JSON.parse(await readFile(join(root, 'done.json'), 'utf8'))).toEqual(paths)
    await writeFile(join(root, 'startup.mjs'), `import { writeFile } from 'node:fs/promises'; export async function prepareStartup() { await writeFile(${JSON.stringify(join(root, 'startup.done'))}, '完成') }`)
    await prepareDesktopEnvironment(join(root, 'startup.mjs'))
    expect(await readFile(join(root, 'startup.done'), 'utf8')).toBe('完成')
  } finally { await rm(root, { recursive: true, force: true }) }
})
