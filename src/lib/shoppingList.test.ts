import { describe, it, expect } from 'vitest'
import { buildShoppingListText, formatOfferWeek, formatShopLine } from './shoppingList'

describe('formatShopLine', () => {
  it('appends why and price only when given', () => {
    expect(formatShopLine('400 g Laxfilé')).toBe('400 g Laxfilé')
    expect(formatShopLine('400 g Laxfilé', 'Ugnsbakad lax')).toBe('400 g Laxfilé (Ugnsbakad lax)')
    expect(formatShopLine('Kaffe', 'ICA · Zoégas · 500g', '39:90/st')).toBe('Kaffe (ICA · Zoégas · 500g) — 39:90/st')
  })

  it('folds the offer week into the same parenthetical as why', () => {
    expect(formatShopLine('Kaffe', 'ICA · Zoégas · 500g', '39:90/st', 'v.29 · 2026'))
      .toBe('Kaffe (ICA · Zoégas · 500g, v.29 · 2026) — 39:90/st')
    expect(formatShopLine('Kaffe', undefined, undefined, 'v.29 · 2026')).toBe('Kaffe (v.29 · 2026)')
  })
})

describe('formatOfferWeek', () => {
  it('formats an ISO week as a short label', () => {
    expect(formatOfferWeek('2026-W29')).toBe('v.29 · 2026')
  })
})

describe('buildShoppingListText', () => {
  it('lists every line as one flat list and includes removed items', () => {
    const text = buildShoppingListText({
      weekLabel: 'v.27',
      lines: ['400 g Laxfilé (Ugnsbakad lax)', 'Tandkräm'],
      removedLabels: ['Vitlök'],
    })
    expect(text).toContain('Inköpslista – v.27')
    expect(text).toContain('- 400 g Laxfilé (Ugnsbakad lax)')
    expect(text).toContain('- Tandkräm')
    expect(text).toContain('Bortmarkerat')
    expect(text).toContain('- Vitlök')
  })

  it('shows an empty-list marker when nothing is left', () => {
    const text = buildShoppingListText({ weekLabel: 'v.27', lines: [], removedLabels: [] })
    expect(text).toContain('Listan är tom')
  })
})
