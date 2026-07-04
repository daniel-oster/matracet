import { describe, it, expect } from 'vitest'
import { aggregateIngredients, buildShoppingListText } from './shoppingList'
import type { BevakaHit, TaggedOffer } from './bevaka'
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

describe('buildShoppingListText', () => {
  it('renders grouped sections and omits empty ones', () => {
    const text = buildShoppingListText({
      weekLabel: 'v.27',
      ingredients: [{ id: 'ing:laxfilé|g', vara: 'Laxfilé', mangd: 400, enhet: 'g', meals: ['Ugnsbakad lax'] }],
      bevakaHits: [],
      manualItems: [{ id: 'manual:1', vara: 'Tandkräm', addedAt: '2026-07-03T00:00:00Z' }],
      removedLabels: ['Vitlök'],
    })
    expect(text).toContain('Inköpslista – v.27')
    expect(text).toContain('Från veckans måltider')
    expect(text).toContain('- 400 g Laxfilé')
    expect(text).toContain('Eget tillägg')
    expect(text).toContain('- Tandkräm')
    expect(text).not.toContain('Fynd på bevakningslistan')
    expect(text).toContain('Bortmarkerat')
    expect(text).toContain('- Vitlök')
  })

  it('includes the store and product label for bevaka hits, not just the price', () => {
    const offer: TaggedOffer = {
      namn: 'Kaffe Zoégas', marke: 'Zoégas', storlek: '500g', pris_text: '39:90/st',
      pris: 39.9, pris_typ: 'st', jamforpris: null, ord_pris: null, pris_30dgr: null,
      besparing: null, klubbpris: false, max_kop: null, markeringar: [], ursprung: null,
      notering: null, kategori: 'torrvaror', store: 'ica',
    }
    const hit: BevakaHit = {
      item: { id: 'kaffe', vara: 'Kaffe', kategori: 'torrvaror', sok: ['kaffe'], undvik_marken: [], onskat_marke: null, storlek_hint: null, troskel_kr: null, anteckning: null },
      offers: [offer],
    }
    const text = buildShoppingListText({
      weekLabel: 'v.27',
      ingredients: [],
      bevakaHits: [hit],
      manualItems: [],
      removedLabels: [],
    })
    expect(text).toContain('- Kaffe — ICA · Zoégas · 500g, 39:90/st')
  })

  it('shows an empty-list marker when nothing is left', () => {
    const text = buildShoppingListText({
      weekLabel: 'v.27',
      ingredients: [],
      bevakaHits: [],
      manualItems: [],
      removedLabels: [],
    })
    expect(text).toContain('Listan är tom')
  })
})
