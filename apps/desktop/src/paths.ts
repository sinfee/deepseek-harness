/** Filesystem ownership for the Electron-managed desktop installation. */

import { join, resolve } from 'node:path'
import { expandHomePath, resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/**
 * 解析 Electron 用户状态目录，显式命令行或环境路径优先于品牌根目录。
 * @param env - 启动环境。
 * @param args - Electron 命令行参数。
 * @returns 用户状态绝对路径；未覆盖时保留 Electron 默认路径。
 */
export function resolveDesktopUserData(env: NodeJS.ProcessEnv = process.env, args: readonly string[] = process.argv): string | undefined {
  const inline = args.find(value => value.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length)
  const index = args.indexOf('--user-data-dir')
  const separate = index >= 0 ? args[index + 1] : undefined
  const explicit = [inline, separate, env.DSH_DESKTOP_USER_DATA_DIR].find(value => value !== undefined && value.trim().length > 0)
  if (explicit !== undefined) return resolve(expandHomePath(explicit))
  const home = env.DSH_DESKTOP_HOME
  return home?.trim() ? join(resolve(expandHomePath(home)), 'desktop') : undefined
}

/** Stable desktop installation paths under the shared Harness home. */
export interface DesktopPaths {
  readonly profile: string
  readonly lock: string
}

/**
 * Resolve every Electron-owned path without changing the shared data roots.
 * @param dshHome - Harness home shared with npm-installed dsh.
 * @returns immutable desktop path set.
 */
export function resolveDesktopPaths(dshHome: string = resolveDshHome()): DesktopPaths {
  return {
    profile: join(dshHome, 'profiles', 'desktop'),
    lock: join(dshHome, 'profiles', 'desktop', 'lock'),
  }
}
