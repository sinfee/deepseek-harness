/** 在宿主启动前运行发行包提供的可信 profile 初始化模块。 */
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * 在主实例启动时等待发行环境初始化，失败时阻止登录与更新调度启动。
 * @param modulePath - 可信发行入口提供的绝对路径；未设置时不执行。
 * @returns 初始化完成。
 */
export async function prepareDesktopEnvironment(modulePath: string | undefined): Promise<void> {
  if (modulePath === undefined) return
  if (!isAbsolute(modulePath)) throw new Error('桌面环境初始化模块必须使用绝对路径')
  const module: unknown = await import(pathToFileURL(modulePath).href)
  if (typeof module !== 'object' || module === null || !('prepareStartup' in module)
    || typeof module.prepareStartup !== 'function') throw new Error('桌面环境初始化模块缺少 prepareStartup')
  await module.prepareStartup()
}

/**
 * 等待安装携带的初始化操作，任何失败均阻止后续宿主启动。
 * @param modulePath - 可信发行入口设置的绝对路径；未设置时不执行操作。
 * @param paths - 官方管理的 profile、只读运行时及支持文件目录。
 * @returns 初始化完成。
 */
export async function prepareDesktopProfile(modulePath: string | undefined,
  paths: { profile: string; runtime: string; support: string }): Promise<void> {
  if (modulePath === undefined) return
  if (!isAbsolute(modulePath)) throw new Error('桌面初始化模块必须使用绝对路径')
  const module: unknown = await import(pathToFileURL(modulePath).href)
  if (typeof module !== 'object' || module === null || !('prepareProfile' in module)
    || typeof module.prepareProfile !== 'function') throw new Error('桌面初始化模块缺少 prepareProfile')
  const prepare = module.prepareProfile as (input: typeof paths) => unknown
  await prepare(paths)
}
