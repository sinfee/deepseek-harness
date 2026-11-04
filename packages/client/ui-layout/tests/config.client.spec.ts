/** 组合的图标侧条选项在配置入口验证。 */
import { expect, it } from 'vitest'
import { Config } from '@deepseek-ai/dsh-client-ui-layout'
it('空配置按标准 Schema 沿用平台行为，侧条值必须为布尔值', () => {
  expect(Config['~standard'].validate(undefined)).toEqual({ value: { keepSidebarRail: false } })
  expect(Config['~standard'].validate(null)).toEqual({ value: { keepSidebarRail: false } })
  expect(Config['~standard'].validate({ keepSidebarRail: true })).toEqual({ value: { keepSidebarRail: true } })
  expect(Config['~standard'].validate({ keepSidebarRail: false })).toEqual({ value: { keepSidebarRail: false } })
  for (const input of [[], 'rail', { keepSidebarRail: 1 }]) expect(Config['~standard'].validate(input)).toHaveProperty('issues')
})
