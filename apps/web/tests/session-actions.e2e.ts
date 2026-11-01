/** 在实际浏览器和持久化后端验证会话导出与永久删除。 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { launchWebScaffold, seedSession } from './scaffold.ts'

it('从会话菜单导出 Markdown 和 JSON，并在确认后永久删除', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: fileURLToPath(new URL('./pin-browse-picker.overlay.yml', import.meta.url)),
  })
  try {
    const workspace = await scaffold.ctx.workspaceRegistry.create(scaffold.workspaceCwd)
    const seed = await readFile(new URL('../../../snapshots/web/seeded-history/session.v3.jsonl', import.meta.url), 'utf8')
    const id = await seedSession(scaffold, seed, 'session-export-delete')
    await workspace.attachSession(id)
    await scaffold.ctx.sessionController.rename({ sessionId: id, title: 'Feature conversation' })
    const marker = join(scaffold.workspaceCwd, 'keep-workspace.txt')
    await writeFile(marker, 'keep workspace')
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' })
      await page.goto(scaffold.authenticatedUrl)
      const row = page.locator(`[data-row-key="session:${id}"]`)
      const menu = row.locator('[data-context-menu-trigger]')
      await row.waitFor()
      await row.hover()
      await menu.waitFor()
      for (const [label, extension] of [
        ['Export conversation as Markdown', 'md'], ['Export conversation as JSON (all events)', 'json'],
      ] as const) {
        await row.hover()
        await menu.click()
        const downloaded = page.waitForEvent('download')
        await page.getByRole('menuitem', { name: label, exact: true }).click()
        const download = await downloaded
        expect(download.suggestedFilename()).toBe(`conversation-${id}.${extension}`)
        const path = await download.path()
        if (path === null) throw new Error('下载没有生成文件')
        const content = await readFile(path, 'utf8')
        if (extension === 'md') expect(content).toContain('# Feature conversation')
        else expect(JSON.parse(content)).toMatchObject({ format: 'dsh-session-export', version: 1, session: { id } })
      }
      await row.hover()
      await menu.click()
      await page.getByRole('menuitem', { name: 'Permanently delete conversation', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Permanently delete conversation', exact: true })
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      expect(await scaffold.ctx.sessionPersistence.stat(id)).toBeDefined()
      await row.hover()
      await menu.click()
      await page.getByRole('menuitem', { name: 'Permanently delete conversation', exact: true }).click()
      await dialog.getByRole('button', { name: 'Permanently delete conversation', exact: true }).click()
      await expect.poll(async () => await scaffold.ctx.sessionPersistence.stat(id)).toBeUndefined()
      await expect.poll(() => workspace.sessionIds.includes(id)).toBe(false)
      await expect.poll(() => menu.count()).toBe(0)
      expect(await readFile(marker, 'utf8')).toBe('keep workspace')
    } finally { await browser.close() }
  } finally { await scaffold.close() }
})
