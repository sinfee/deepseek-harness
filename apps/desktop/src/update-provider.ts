/** 主进程更新提供者接入；未配置时完整沿用官方更新器。 */
import { isAbsolute } from 'node:path'
import type { ChildProcess } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { DesktopUpdateCoordinator } from './update-coordinator.ts'

/** 桌面状态组件和更新调度所需的操作。 */
export type DesktopUpdateProvider = {
  /** 处理已绑定宿主的扩展消息；未识别时返回 false，交回官方协议校验。 */
  handleHostMessage?: (child: ChildProcess, message: unknown) => boolean
} & Pick<DesktopUpdateCoordinator,
  'state' | 'check' | 'download' | 'install' | 'dispose' | 'revision' | 'selectedChannel'
  | 'configurationFailure' | 'suspendConfiguration' | 'switchChannel'>

/**
 * 从显式配置的本地模块加载更新提供者。
 * @param options - 安装携带的模块路径、官方运行时及退出回调。
 * @param parameters - 官方更新器原有的状态发布、任务收束与渠道参数。
 * @returns 供现有菜单、IPC、确认窗口和调度器共用的更新操作。
 */
export async function createDesktopUpdateProvider(
  options: { modulePath: string | undefined; primaryRuntime: string; version: string; quit: () => void },
  ...parameters: ConstructorParameters<typeof DesktopUpdateCoordinator>
): Promise<DesktopUpdateProvider> {
  if (options.modulePath === undefined) return new DesktopUpdateCoordinator(...parameters)
  if (!isAbsolute(options.modulePath)) throw new Error('桌面更新模块必须使用绝对路径')
  const module: unknown = await import(pathToFileURL(options.modulePath).href)
  if (typeof module !== 'object' || module === null || !('createDesktopUpdater' in module)
    || typeof module.createDesktopUpdater !== 'function') throw new Error('桌面更新模块缺少 createDesktopUpdater')
  const create = module.createDesktopUpdater as (input: {
    publish: ConstructorParameters<typeof DesktopUpdateCoordinator>[0]
    beforeRestart: ConstructorParameters<typeof DesktopUpdateCoordinator>[1]
    currentVersion: string
    primaryRuntime: string
    quit: () => void
  }) => unknown
  const provider: unknown = await create({
    publish: parameters[0], beforeRestart: parameters[1], currentVersion: options.version,
    primaryRuntime: options.primaryRuntime, quit: options.quit,
  })
  if (typeof provider !== 'object' || provider === null
    || !('state' in provider) || typeof provider.state !== 'object' || provider.state === null
    || !('check' in provider) || typeof provider.check !== 'function'
    || !('download' in provider) || typeof provider.download !== 'function'
    || !('install' in provider) || typeof provider.install !== 'function'
    || !('dispose' in provider) || typeof provider.dispose !== 'function') throw new Error('桌面更新模块操作不完整')
  if ('handleHostMessage' in provider && typeof provider.handleHostMessage !== 'function') throw new Error('桌面扩展消息处理器无效')
  const external = provider as Pick<DesktopUpdateProvider, 'state' | 'check' | 'download' | 'install' | 'dispose' | 'handleHostMessage'>
    & Partial<Pick<DesktopUpdateProvider, 'revision' | 'selectedChannel' | 'configurationFailure' | 'suspendConfiguration' | 'switchChannel'>>
  let suspended: DesktopUpdateProvider['state'] | undefined
  let failure: DesktopUpdateProvider['configurationFailure']
  return {
    get state() { return suspended ?? external.state },
    get revision() { return external.revision ?? 0 },
    get selectedChannel() { return external.selectedChannel ?? parameters[6] ?? 'nightly' },
    get configurationFailure() { return external.configurationFailure ?? failure },
    check: (...args) => suspended === undefined ? external.check(...args) : Promise.resolve(suspended),
    download: (...args) => {
      if (suspended !== undefined) return Promise.resolve(suspended)
      return external.download(...args)
    },
    install: (...args) => {
      if (suspended !== undefined) return Promise.resolve(suspended)
      return external.install(...args)
    },
    dispose: () => external.dispose(),
    suspendConfiguration(detail, reason = 'startup') {
      if (external.suspendConfiguration !== undefined) { external.suspendConfiguration(detail, reason); return }
      failure = reason
      suspended = parameters[0]({ phase: 'error', failedOperation: 'configuration', message: detail })
    },
    switchChannel: async (...args) => {
      if (external.switchChannel === undefined) throw new Error('当前桌面更新提供者不支持切换更新渠道')
      return external.switchChannel(...args)
    },
    ...(external.handleHostMessage === undefined ? {} : { handleHostMessage: external.handleHostMessage.bind(external) }),
  }
}
