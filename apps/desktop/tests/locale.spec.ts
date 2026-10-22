import { describe, expect, it } from 'vitest'
import { en, formatDesktopMessage, resolveDesktopLocale, resolveDesktopStartupLocale, zh } from '../src/locale.ts'

describe('desktop locale dictionaries', () => {
  it('将品牌应用于中英文菜单和托盘，并在关于中保留上游版本', () => {
    const brand = { productName: 'ThkAI3D', upstreamVersion: '0.2.1-rc.2' }
    const chinese = resolveDesktopLocale('zh-CN', brand).messages
    expect(chinese.aboutMenu).toBe('关于 ThkAI3D')
    expect(chinese.aboutProduct).toBe('ThkAI3D')
    expect(chinese.openApplication).toBe('打开 ThkAI3D')
    expect(chinese.quitApplication).toBe('退出 ThkAI3D')
    expect(formatDesktopMessage(chinese.aboutVersion, { version: '1.0.0' }))
      .toBe('版本 V1.0.0\n依托上游 DeepSeek Harness V0.2.1-rc.2')
    expect(resolveDesktopLocale('en', brand).messages.aboutMenu).toBe('About ThkAI3D')
    expect(resolveDesktopLocale('en', brand).messages.aboutVersion).toContain('Based on upstream DeepSeek Harness V0.2.1-rc.2')
    expect(resolveDesktopStartupLocale('zh', ['en'], brand).messages).toEqual(chinese)
  })
  it('ships the same key set in English and Chinese', () => {
    expect(Object.keys(zh)).toEqual(Object.keys(en))
    expect(resolveDesktopLocale('zh-Hans-CN').messages).toEqual(zh)
    expect(resolveDesktopLocale('en-US').messages).toEqual(en)
    expect(resolveDesktopLocale('fr-FR').messages).toEqual(en)
  })

  it('formats named values without consuming unknown placeholders', () => {
    expect(formatDesktopMessage('{name}@{version} {missing}', { name: 'plugin', version: '1.2.3' }))
      .toBe('plugin@1.2.3 {missing}')
  })

  it('prefers an explicit supported choice, then the first supported system language', () => {
    expect(resolveDesktopStartupLocale('zh', ['en-US']).id).toBe('zh-CN')
    expect(resolveDesktopStartupLocale('EN', ['zh-CN']).id).toBe('en')
    expect(resolveDesktopStartupLocale(null, ['ja-JP', 'zh-Hant', 'en-US']).id).toBe('zh-CN')
    expect(resolveDesktopStartupLocale(null, ['en-US', 'zh-CN']).id).toBe('en')
    expect(resolveDesktopStartupLocale(null, ['ja-JP']).id).toBe('en')
    expect(resolveDesktopStartupLocale(null, []).id).toBe('en')
    expect(resolveDesktopStartupLocale('ja', ['zh-CN']).id).toBe('zh-CN')
  })

})
