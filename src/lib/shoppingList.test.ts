import { describe, it, expect } from 'vitest'
import { buildShoppingListText, formatShopLine } from './shoppingList'

describe('formatShopLine', () => {
  it('appends why and price only when given', () => {
    expect(formatShopLine('400 g Laxfilé')).toBe('400 g Laxfilé')
    expect(formatShopLine('400 g Laxfilé', 'Ugnsbakad lax')).toBe('400 g Laxfilé (Ugnsbakad lax)')
    expect(formatShopLine('Kaffe', 'ICA · Zoégas · 500g', '39:90/st')).toBe('Kaffe (ICA · Zoégas · 500g) — 39:90/st')
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
