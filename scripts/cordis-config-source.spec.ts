/** 无符号链接权限的 Windows 检出仍按 Git 元数据读取配置，不放宽普通 YAML 校验。 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished } from 'vitest'
import { readCordisConfigSource } from './cordis-config-files.ts'

it('只解析受 Git 跟踪的链接，并拒绝越界目标和循环', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-config-link-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  git('init', '--quiet')
  writeFileSync(join(root, 'target.yml'), '[]\n')
  writeFileSync(join(root, 'alias.yml'), './target.yml')
  expect(readCordisConfigSource(root, 'alias.yml')).toBe('./target.yml')
  const indexLink = (name: string, target: string) => {
    writeFileSync(join(root, name), target)
    const hash = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: target, encoding: 'utf8' }).trim()
    git('update-index', '--add', '--cacheinfo', '120000', hash, name)
  }
  indexLink('alias.yml', './target.yml')
  expect(readCordisConfigSource(root, 'alias.yml')).toBe('[]\n')
  indexLink('alias.yml', '../outside.yml')
  expect(() => readCordisConfigSource(root, 'alias.yml')).toThrow('越出仓库')
  indexLink('alias.yml', './alias.yml')
  expect(() => readCordisConfigSource(root, 'alias.yml')).toThrow('循环或层级过深')
})
