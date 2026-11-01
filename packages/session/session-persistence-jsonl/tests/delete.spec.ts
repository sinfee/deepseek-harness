import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { generationLogFilename } from '../src/format.ts'
import { describe, expect, it } from 'vitest'
import { SESSION_FORMAT_VERSION, SessionId } from '@deepseek-ai/dsh-session'
import * as Jsonl from '../src/index.ts'

describe('永久删除持久化会话', () => {
  for (const compression of ['none', 'zstd'] as const) {
    it(`删除后重启不可见，保留其他会话和工作区文件：${compression}`, async () => {
      const root = await mkdtemp(join(tmpdir(), 'dsh-delete-'))
      const ctx = new Context()
      const id = SessionId('delete-me')
      const other = SessionId('keep-me')
      try {
        await ctx.plugin(Jsonl, { root: join(root, 'sessions'), compression })
        const workspace = join(root, 'keep.txt')
        await writeFile(workspace, 'keep')
        for (const sid of [id, other]) {
          const handle = await ctx.sessionPersistence.create({ id: sid, version: SESSION_FORMAT_VERSION,
            createdAt: 1, isSeeded: false, cwd: root })
          await handle.flush()
          await expect(ctx.sessionPersistence.delete(sid)).rejects.toMatchObject({ name: 'SessionAlreadyOwnedError' })
          if (sid === id) {
            const second = new Context()
            try {
              await second.plugin(Jsonl, { root: join(root, 'sessions'), compression })
              await expect(second.sessionPersistence.delete(sid)).rejects.toMatchObject({ name: 'SessionAlreadyOwnedError' })
            } finally { await second.fiber.dispose() }
          }
          await handle.close()
        }
        const stored = await ctx.sessionPersistence.stat(id)
        const path = stored?.location?.path
        if (path === undefined) throw new Error('缺少日志文件路径')
        await writeFile(join(dirname(path), generationLogFilename(3, compression)), await readFile(path))
        expect(await ctx.sessionPersistence.delete(id)).toBe(true)
        expect(await ctx.sessionPersistence.stat(id)).toBeUndefined()
        expect(await ctx.sessionPersistence.delete(id)).toBe(false)
        expect(await readFile(workspace, 'utf8')).toBe('keep')
        await ctx.fiber.dispose()
        const restarted = new Context()
        try {
          await restarted.plugin(Jsonl, { root: join(root, 'sessions'), compression })
          expect((await restarted.sessionPersistence.list()).map(row => row.header.id)).toEqual([other])
        } finally { await restarted.fiber.dispose() }
      } finally {
        await ctx.fiber.dispose()
        await rm(root, { recursive: true, force: true })
      }
    })
  }
})
