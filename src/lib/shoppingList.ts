import { DayMeal, Recipe, Pantry } from '../types'
import { describeOffer, type BevakaHit } from './bevaka'
import type { ManualShoppingItem } from '../hooks/useShoppingList'

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

  return [...map.values()].sort((a, b) => a.vara.localeCompare(b.vara, 'sv'))
}

export function formatAmount(mangd: number, enhet: string): string {
  const n = Number.isInteger(mangd) ? mangd : Math.round(mangd * 10) / 10
  return enhet ? `${n} ${enhet}` : `${n}`
}

export interface ShoppingListTextInput {
  weekLabel: string
  ingredients: AggregatedIngredient[]
  bevakaHits: BevakaHit[]
  manualItems: ManualShoppingItem[]
  removedLabels: string[]
}

/** Plain-text snapshot of the current list, meant to be copied and pasted back as a prompt. */
export function buildShoppingListText({
  weekLabel,
  ingredients,
  bevakaHits,
  manualItems,
  removedLabels,
}: ShoppingListTextInput): string {
  const lines: string[] = [`Inköpslista – ${weekLabel}`, '']

  if (ingredients.length > 0) {
    lines.push('Från veckans måltider')
    for (const i of ingredients) lines.push(`- ${formatAmount(i.mangd, i.enhet)} ${i.vara}`)
    lines.push('')
  }

  if (bevakaHits.length > 0) {
    lines.push('Fynd på bevakningslistan')
    for (const h of bevakaHits) {
      const best = h.offers[0]
      lines.push(`- ${h.item.vara}${best ? ` — ${describeOffer(best)}, ${best.pris_text}` : ''}`)
    }
    lines.push('')
  }

  if (manualItems.length > 0) {
    lines.push('Eget tillägg')
    for (const m of manualItems) lines.push(`- ${m.vara}`)
    lines.push('')
  }

  if (ingredients.length === 0 && bevakaHits.length === 0 && manualItems.length === 0) {
    lines.push('(Listan är tom.)')
    lines.push('')
  }

  if (removedLabels.length > 0) {
    lines.push('—')
    lines.push('Bortmarkerat (redan hemma / inte längre aktuellt)')
    for (const r of removedLabels) lines.push(`- ${r}`)
  }

  return lines.join('\n').trim()
}
