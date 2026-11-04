/** Host loader entry for the browser-only layout plugin. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import z from '@deepseek-ai/schemastery'
import { LAYOUT_CONFIG_GLOBAL } from './page-config.ts'

/** 可由组合配置启用桌面收起状态的图标侧条；默认沿用平台行为。 */
export interface Config {
  /** 收起侧栏时保留图标条。 */
  keepSidebarRail?: boolean
}

/** 校验布局组合选项，并将其传递给客户端。 */
export const Config = z.object({
  keepSidebarRail: z.boolean().default(false),
}).default({ keepSidebarRail: false })

/** 在客户端插件加载前传递公开的布局选项。 */
export function apply(ctx: Context, config: Config): void {
  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: LAYOUT_CONFIG_GLOBAL, value: { keepSidebarRail: config.keepSidebarRail === true } })
  })
}
