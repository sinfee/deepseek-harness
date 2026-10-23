/** Host loader entry for the browser-only layout plugin. */

/** 可由组合配置启用桌面收起状态的图标侧条；默认沿用平台行为。 */
export interface Config { keepSidebarRail?: boolean }

/** 校验布局组合选项，并将其传递给客户端。 */
export const Config = {
  '~standard': {
    version: 1 as const,
    vendor: 'dsh',
    validate(input: unknown) {
      if (input === undefined) return { value: { keepSidebarRail: false } }
      if (typeof input !== 'object' || input === null || Array.isArray(input)
        || ('keepSidebarRail' in input && typeof input.keepSidebarRail !== 'boolean')) {
        return { issues: [{ message: 'keepSidebarRail 必须为布尔值' }] }
      }
      return { value: { keepSidebarRail: 'keepSidebarRail' in input && input.keepSidebarRail === true } }
    },
  },
}

/** Provides no host-side behavior. */
export function apply(): void {}
