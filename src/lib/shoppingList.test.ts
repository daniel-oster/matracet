import { describe, it, expect } from 'vitest'
import { aggregateIngredients, buildShoppingListText, formatShopLine } from './shoppingList'
import type { DayMeal, Recipe, Pantry } from '../types'

function makeRecipe(slug: string, namn: string, ingredienser: Recipe['ingredienser']): Recipe {
  return {
    schema_version: '1',
    slug,
    nummer: 1,
    namn,
    tid_min: 20,
    portioner: 4,
    kategorier: [],
    sasong: [],
    svarighet: 'latt',
    barnvanlig: 'ja',
    taggar: [],
    dagkedja: null,
    ingredienser,
    instruktioner: [],
    komplett: true,
  }
}

const LAX = makeRecipe('lax', 'Ugnsbakad lax', [
  { vara: 'Laxfilé', mangd: 400, enhet: 'g' },
  { vara: 'Gul lök', mangd: 1, enhet: 'st' },
  { vara: 'Vitlök', mangd: 2, enhet: 'st' },
])
const PASTA = makeRecipe('pasta', 'Pasta pomodoro', [
  { vara: 'Pasta', mangd: 500, enhet: 'g' },
  { vara: 'Gul lök', mangd: 1, enhet: 'st' },
])

// A mix of dinners and lunches — aggregateIngredients treats them uniformly.
const MEALS: DayMeal[] = [
  { dag: 'fredag', datum: '2026-07-03', recept: 'Ugnsbakad lax', receptSlug: 'lax' },
  { dag: 'lordag', datum: '2026-07-04', recept: 'Pasta pomodoro', receptSlug: 'pasta' },
  { dag: 'lordag', datum: '2026-07-04', recept: 'Pasta pomodoro (lunch)', receptSlug: 'pasta' },
  { dag: 'sondag', datum: '2026-07-05', recept: null },
]

describe('aggregateIngredients', () => {
  it('sums matching vara+enhet across meals and tracks which dishes need it', () => {
    const result = aggregateIngredients(MEALS, { lax: LAX, pasta: PASTA }, null)
    const lok = result.find(i => i.vara === 'Gul lök')
    expect(lok?.mangd).toBe(3)
    expect(lok?.meals).toEqual(['Ugnsbakad lax', 'Pasta pomodoro', 'Pasta pomodoro (lunch)'])
  })

  it('skips pantry staples and current stock', () => {
    const pantry: Pantry = { always_have: ['gul lök'], current_stock: [{ vara: 'vitlök' }] }
    const result = aggregateIngredients(MEALS, { lax: LAX, pasta: PASTA }, pantry)
    expect(result.some(i => i.vara === 'Gul lök')).toBe(false)
    expect(result.some(i => i.vara === 'Vitlök')).toBe(false)
    expect(result.some(i => i.vara === 'Laxfilé')).toBe(true)
  })

  it('ignores meals with no recipe or unresolved recipe data', () => {
    const result = aggregateIngredients(MEALS, { lax: LAX }, null)
    expect(result.some(i => i.vara === 'Pasta')).toBe(false)
  })
})

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
