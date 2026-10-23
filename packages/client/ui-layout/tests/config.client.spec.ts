/** 组合的图标侧条选项在配置入口验证。 */
import { expect, it } from 'vitest'
import { Config } from '@deepseek-ai/dsh-client-ui-layout'
it('默认沿用平台行为，仅接受布尔侧条选项', () => {
  expect(Config['~standard'].validate(undefined)).toEqual({ value: { keepSidebarRail: false } })
  expect(Config['~standard'].validate({ keepSidebarRail: true })).toEqual({ value: { keepSidebarRail: true } })
  expect(Config['~standard'].validate({ keepSidebarRail: false })).toEqual({ value: { keepSidebarRail: false } })
  for (const input of [null, [], 'rail', { keepSidebarRail: 1 }]) expect(Config['~standard'].validate(input)).toHaveProperty('issues')
})
