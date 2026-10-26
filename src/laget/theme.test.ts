import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, THEMES, parseTheme } from './theme'

describe('parseTheme', () => {
  it('accepts every known theme id', () => {
    for (const t of THEMES) expect(parseTheme(t.id)).toBe(t.id)
  })
  it('falls back to the default for anything else (missing, old or edited values)', () => {
    expect(parseTheme(null)).toBe(DEFAULT_THEME)
    expect(parseTheme('')).toBe(DEFAULT_THEME)
    expect(parseTheme('solarized')).toBe(DEFAULT_THEME)
    expect(parseTheme(42)).toBe(DEFAULT_THEME)
  })
})
