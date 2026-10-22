import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveDesktopUserData } from '../src/paths.ts'

describe('桌面品牌目录', () => {
  it('未设置覆盖时保留 Electron 默认路径', () => {
    expect(resolveDesktopUserData({}, [])).toBeUndefined()
    expect(resolveDesktopUserData({ DSH_DESKTOP_HOME: ' ' }, [])).toBeUndefined()
  })
  it('显式命令行和状态目录优先于品牌根目录', () => {
    const env = { DSH_DESKTOP_HOME: '中文 空格#%', DSH_DESKTOP_USER_DATA_DIR: 'explicit' }
    expect(resolveDesktopUserData(env, [])).toBe(resolve('explicit'))
    expect(resolveDesktopUserData(env, ['--user-data-dir=cli'])).toBe(resolve('cli'))
    expect(resolveDesktopUserData(env, ['--user-data-dir', 'cli'])).toBe(resolve('cli'))
    expect(resolveDesktopUserData({ DSH_DESKTOP_HOME: '中文 空格#%' }, [])).toBe(join(resolve('中文 空格#%'), 'desktop'))
  })
})
