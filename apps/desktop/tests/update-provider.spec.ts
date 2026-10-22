import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished, vi } from 'vitest'
import { createDesktopUpdateProvider } from '../src/update-provider.ts'

vi.mock('../src/update-coordinator.ts', () => ({ DesktopUpdateCoordinator: vi.fn(() => { throw new Error('本用例只加载外部提供者') }) }))

it('显式模块提供现有桌面 UI 所需操作，缺失操作时拒绝启动', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-provider-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const valid = join(root, 'valid.mjs')
  await writeFile(valid, 'export const createDesktopUpdater = ({ publish }) => ({ state: {phase:"idle"}, check: async () => publish({phase:"available",version:"1.0.0"}), download(){}, install(){}, dispose(){} })')
  const provider = await createDesktopUpdateProvider({ modulePath: valid, primaryRuntime: root, version: '0.1.0', quit() {} }, value => value, async () => true)
  expect(await provider.check()).toEqual({ phase: 'available', version: '1.0.0' })
  const invalid = join(root, 'invalid.mjs')
  await writeFile(invalid, 'export const createDesktopUpdater = () => ({state:{phase:"idle"}})')
  await expect(createDesktopUpdateProvider({ modulePath: invalid, primaryRuntime: root, version: '0.1.0', quit() {} }, value => value, async () => true)).rejects.toThrow('操作不完整')
})
