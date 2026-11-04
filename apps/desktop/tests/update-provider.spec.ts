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
  expect(provider.revision).toBe(0)
  expect(provider.selectedChannel).toBe('nightly')
  const persist = vi.fn(async () => {})
  await expect(provider.switchChannel('stable', persist)).rejects.toThrow('不支持切换更新渠道')
  expect(persist).not.toHaveBeenCalled()
  provider.suspendConfiguration('配置不可读')
  expect(provider.configurationFailure).toBe('startup')
  expect(await provider.check()).toMatchObject({ phase: 'error', failedOperation: 'configuration' })
  expect(await provider.download('1.0.0')).toEqual(provider.state)
  expect(await provider.install('1.0.0')).toEqual(provider.state)
  const invalid = join(root, 'invalid.mjs')
  await writeFile(invalid, 'export const createDesktopUpdater = () => ({state:{phase:"idle"}})')
  await expect(createDesktopUpdateProvider({ modulePath: invalid, primaryRuntime: root, version: '0.1.0', quit() {} }, value => value, async () => true)).rejects.toThrow('操作不完整')
})

it('保留外部更新提供者的渠道状态与调用归属', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-provider-channel-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const path = join(root, 'provider.mjs')
  await writeFile(path, `export const createDesktopUpdater = () => ({
    state: {phase:'idle'}, revision: 2, selectedChannel: 'nightly',
    async check(){return this.state}, async download(){return this.state}, async install(){return this.state}, dispose(){},
    async switchChannel(channel,persist){await persist();this.selectedChannel=channel;this.revision++;return 'applied'},
    suspendConfiguration(){this.configurationFailure='cleanup'}
  })`)
  const provider = await createDesktopUpdateProvider({ modulePath: path, primaryRuntime: root, version: '1.0.0', quit() {} }, value => value, async () => true)
  const persist = vi.fn(async () => {})
  expect(await provider.switchChannel('stable', persist)).toBe('applied')
  expect(persist).toHaveBeenCalledOnce()
  expect(provider.selectedChannel).toBe('stable')
  expect(provider.revision).toBe(3)
  provider.suspendConfiguration('清理失败')
  expect(provider.configurationFailure).toBe('cleanup')
})
