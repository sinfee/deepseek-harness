import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyThkaiHome, resolveAgentsHome, resolveDshHome } from '@deepseek-ai/dsh-home-paths'

describe('品牌启动目录', () => {
  it('未配置时保留官方变量', () => {
    const env = { DSH_HOME: 'official', DSH_AGENTS_HOME: 'shared', THKAI_HOME: '  ' }
    const before = { ...env }
    expect(applyThkaiHome(env)).toBeUndefined()
    expect(env).toEqual(before)
  })

  it.each(['中文 空格/#/%数据', 'relative data', '~/品牌 数据'])('规范化并保留路径字符：%s', (value) => {
    const env: Record<string, string | undefined> = { THKAI_HOME: value, DSH_HOME: 'old', DSH_AGENTS_HOME: 'old' }
    const home = applyThkaiHome(env)
    expect(home).toBe(resolveDshHome(value, {}))
    expect(env).toMatchObject({ THKAI_HOME: home, DSH_HOME: home, DSH_DESKTOP_HOME: home, DSH_AGENTS_HOME: join(home!, 'agents') })
    expect(resolveDshHome(undefined, env)).toBe(home)
    expect(resolveAgentsHome(undefined, env)).toBe(join(home!, 'agents'))
    expect(resolveDshHome('explicit', env)).toBe(resolve('explicit'))
    expect(resolveAgentsHome('explicit-agents', env)).toBe(resolve('explicit-agents'))
    const restarted = { ...env }
    expect(applyThkaiHome(restarted)).toBe(home)
    expect(restarted).toEqual(env)
  })

  it('新变量优先于历史别名，空白新变量允许历史别名', () => {
    expect(applyThkaiHome({ THKAI_HOME: 'new', 'THKAI-HOME': 'old' })).toBe(resolve('new'))
    expect(applyThkaiHome({ THKAI_HOME: ' ', 'THKAI-HOME': 'old' })).toBe(resolve('old'))
  })
})
