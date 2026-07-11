import { DayMeal, Recipe, Pantry } from '../types'
import { sortByAisle } from './storeOrder'

export interface AggregatedIngredient {
  id: string
  vara: string
  mangd: number
  enhet: string
  /** Display names of the planned dishes this ingredient is needed for. */
  meals: string[]
}

/** Sums ingredients across this week's planned meals (dinners + lunches), skipping pantry staples. */
export function aggregateIngredients(
  meals: DayMeal[],
  recipes: Record<string, Recipe>,
  pantry: Pantry | null,
): AggregatedIngredient[] {
  const skip = new Set(
    [...(pantry?.always_have ?? []), ...(pantry?.current_stock.map(p => p.vara) ?? [])].map(s =>
      s.toLowerCase(),
    ),
  )
  const map = new Map<string, AggregatedIngredient>()

  for (const day of meals) {
    if (!day.receptSlug) continue
    const recipe = recipes[day.receptSlug]
    if (!recipe) continue
    const mealName = day.recept ?? recipe.namn

    for (const ing of recipe.ingredienser) {
      const varaKey = ing.vara.trim().toLowerCase()
      if (skip.has(varaKey)) continue
      const key = `${varaKey}|${ing.enhet}`
      const existing = map.get(key)
      if (existing) {
        existing.mangd += ing.mangd
        if (!existing.meals.includes(mealName)) existing.meals.push(mealName)
      } else {
        map.set(key, { id: `ing:${key}`, vara: ing.vara, mangd: ing.mangd, enhet: ing.enhet, meals: [mealName] })
      }
    }
  }

  // "Normal order" placeholder (see storeOrder.ts) until real per-store aisle order exists.
  return sortByAisle([...map.values()], i => i.vara)
}

export function formatAmount(mangd: number, enhet: string): string {
  const n = Number.isInteger(mangd) ? mangd : Math.round(mangd * 10) / 10
  return enhet ? `${n} ${enhet}` : `${n}`
}

/** One shopping-list line: the item, optionally why it's there (a meal name, a matched
 * bargain's store/brand), and optionally its price — same shape on screen and in the
 * copy-to-clipboard text. */
export function formatShopLine(main: string, why?: string | null, price?: string | null): string {
  let line = main
  if (why) line += ` (${why})`
  if (price) line += ` — ${price}`
  return line
}

export interface ShoppingListTextInput {
  weekLabel: string
  /** Already-formatted lines, one per item, in the same (aisle-walk) order shown on screen. */
  lines: string[]
  removedLabels: string[]
}

/** Plain-text snapshot of the current list, meant to be copied and pasted back as a prompt. */
export function buildShoppingListText({ weekLabel, lines, removedLabels }: ShoppingListTextInput): string {
  const out: string[] = [`Inköpslista – ${weekLabel}`, '']

  if (lines.length > 0) {
    for (const l of lines) out.push(`- ${l}`)
    out.push('')
  } else {
    out.push('(Listan är tom.)')
    out.push('')
  }

  if (removedLabels.length > 0) {
    out.push('—')
    out.push('Bortmarkerat (redan hemma / inte längre aktuellt)')
    for (const r of removedLabels) out.push(`- ${r}`)
  }

  return out.join('\n').trim()
}
