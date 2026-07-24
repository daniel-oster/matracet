import type { Eater, Recipe } from '../types'
import type { Meal } from '../types/meal'
import type { RecipeFeedbackRecord } from '../types/feedback'
import { looselyMatches } from './pantryMatch'

export interface DietConflict {
  personId: string
  reason: 'refuses' | 'avoid-ingredient' | 'vegan'
  detail: string
}

export interface RequiredSwap {
  from: string
  to: string
  reason: string
}

export interface DietFitResult {
  ok: boolean
  conflicts: DietConflict[]
  requiredSwaps: RequiredSwap[]
}

// A meal has no diet classification of its own (see CLAUDE.md's "Dietary fit is computed,
// not classified" section) — when a recipe backs a slot, Recipe.kategorier is the
// schema-given "is this vegan as written" signal. A recipe-less meal has nothing
// equivalent, and the worked example this stage is built around (Hamburgare: not vegan,
// but "nötfärsbiff" is substitutable) requires *some* way to tell whether a bare
// component name is a plausible animal product without one. These two small keyword lists
// are that fallback, and this check protects one specific eater — so the classification is
// fail-closed, tri-state (`vegan` | `animal` | `unknown`), not a boolean. Recognising the
// safe and the obviously unsafe is the job; admitting ignorance about everything else is
// the point (see CLAUDE.md's "Vegan classification is fail-closed" note). Checked in this
// order (safe first) so a name like "vegoost" or "svarta bönor" resolves via VEGAN_SAFE_RE
// before ANIMAL_PRODUCT_RE ever gets a look, same "narrower/more specific signal wins
// first" ordering already used throughout this codebase's other keyword classifiers (see
// the erbjudanden lessons in CLAUDE.md). This only ever affects which swaps get *suggested*
// for a recipe-less meal — a human still reviews and taps the swap, it never silently
// changes what's cooked.
const VEGAN_SAFE_RE = /vegan|vego|tofu|seitan|kikärt|böna|bönor|linser/i
const ANIMAL_PRODUCT_RE =
  /kött|fläsk|\bbiff\b|färs(?!k)|kyckling|fisk(?!e)|\blax\b|räk|skaldjur|mussl|hummer|ostron|krabba|ägg|(?<!veg)ost\b|(?<!kokos)grädd|(?<!kokos)mjölk|smör|honung|bacon|skinka|korv|tonfisk|kalkon|anka|yoghurt|kvarg|keso|cr[eè]me|filmjölk|majonnäs|aioli|hollandaise|bearnaise|buljong|fond|gelatin|salami|chorizo|prosciutto|pancetta|pastej|halloumi|mozzarella|parmesan|pecorino|cheddar|feta|ricotta|mascarpone|chèvre/i

export type VeganVerdict = 'vegan' | 'animal' | 'unknown'

/** Fail-closed: an unrecognised name is 'unknown', never silently 'vegan'. */
export function classifyVegan(name: string): VeganVerdict {
  if (VEGAN_SAFE_RE.test(name)) return 'vegan'
  if (ANIMAL_PRODUCT_RE.test(name)) return 'animal'
  return 'unknown'
}

/** Everything the dish is currently made of, as written (before any swap) — recipe
 *  ingredients when a recipe backs this slot, else the meal's own components. */
function baseNames(meal: Meal, recipe: Recipe | null): string[] {
  if (recipe) return recipe.ingredienser.map(i => i.vara)
  return meal.komponenter.map(c => c.vara)
}

/** Declared substitutes for a given ingredient/component name — every recipe variant's
 *  byt map (not just one keyed to the eater's specific requirement — a "vegansk" variant's
 *  swap is just as usable for someone who merely avoids that one ingredient) when a recipe
 *  backs this slot, else the meal's own komponenter[*].alternativ. */
function substitutesFor(name: string, meal: Meal, recipe: Recipe | null): string[] {
  if (recipe) {
    const subs: string[] = []
    for (const variant of Object.values(recipe.varianter ?? {})) {
      const byt = variant.byt[name]
      if (byt) subs.push(byt)
    }
    return subs
  }
  return meal.komponenter.find(c => c.vara === name)?.alternativ ?? []
}

function dedupeSwaps(swaps: RequiredSwap[]): RequiredSwap[] {
  const map = new Map<string, RequiredSwap>()
  for (const s of swaps) {
    const key = `${s.from}→${s.to}`
    const existing = map.get(key)
    if (existing) existing.reason += `; ${s.reason}`
    else map.set(key, { ...s })
  }
  return [...map.values()]
}

/**
 * Given the present eaters and their kost/undviker, does an assignment of component
 * substitutions exist that satisfies all of them? `feedback` is whatever record the
 * caller already looked up for this slot (recipe-keyed today — see CLAUDE.md's Stage 5
 * note on the pending move to meal-keyed feedback).
 *
 * Known scope limit, stated rather than silently glossed over: each conflict is resolved
 * independently against the dish's *as-written* state — this does not re-check whether a
 * swap proposed for one eater's requirement would introduce a new conflict for a different
 * present eater. A true fixpoint solve was judged more machinery than "a small solve"
 * calls for; a rare multi-eater conflicting-swap case will surface as two separate
 * suggested swaps rather than one coordinated resolution.
 */
export function evaluateFit(
  meal: Meal,
  recipe: Recipe | null,
  presentEaters: Eater[],
  feedback: RecipeFeedbackRecord | null,
): DietFitResult {
  const conflicts: DietConflict[] = []
  const requiredSwaps: RequiredSwap[] = []
  const names = baseNames(meal, recipe)
  const dishName = recipe?.namn ?? meal.namn

  for (const eater of presentEaters) {
    // Dish-level veto — no substitution fixes a refusal.
    const sentiment = feedback?.persons.find(p => p.personId === eater.id)?.sentiment
    if (sentiment === 'refuses') {
      conflicts.push({ personId: eater.id, reason: 'refuses', detail: `${eater.namn} vägrar äta ”${dishName}”` })
    }

    // Ingredient-level avoid list.
    for (const avoid of eater.undviker) {
      const hit = names.find(n => looselyMatches(n, avoid))
      if (!hit) continue
      const subs = substitutesFor(hit, meal, recipe)
      if (subs.length > 0) {
        requiredSwaps.push({ from: hit, to: subs[0], reason: `${eater.namn} undviker ${avoid}` })
      } else {
        conflicts.push({ personId: eater.id, reason: 'avoid-ingredient', detail: `${eater.namn} undviker ${avoid} — finns i ”${dishName}”` })
      }
    }

    // Vegan requirement.
    if (!eater.kost?.includes('vegan')) continue

    if (recipe) {
      if (recipe.kategorier.includes('vegansk')) continue
      const byt = recipe.varianter?.vegansk?.byt
      if (byt && Object.keys(byt).length > 0) {
        for (const [from, to] of Object.entries(byt)) {
          requiredSwaps.push({ from, to, reason: `${eater.namn} äter veganskt` })
        }
      } else {
        conflicts.push({ personId: eater.id, reason: 'vegan', detail: `${eater.namn} äter veganskt — ”${dishName}” är inte veganskt` })
      }
      continue
    }

    // Recipe-less meal — classify every component individually. Fail-closed: an empty
    // component list or an 'unknown' verdict is reported (as a conflict for now — this
    // function has no separate "unknown" channel yet; see CLAUDE.md's PR-follow-up
    // write-up for the Stage that adds one), never silently treated as vegan.
    if (meal.komponenter.length === 0) {
      conflicts.push({
        personId: eater.id,
        reason: 'vegan',
        detail: `${eater.namn} äter veganskt — inga komponenter kända för ”${dishName}”, går inte att kontrollera`,
      })
      continue
    }
    for (const c of meal.komponenter) {
      const verdict = classifyVegan(c.vara)
      if (verdict === 'vegan') continue
      if (verdict === 'unknown') {
        conflicts.push({
          personId: eater.id,
          reason: 'vegan',
          detail: `${eater.namn} äter veganskt — okänt om ”${c.vara}” i ”${dishName}” är veganskt`,
        })
        continue
      }
      const veganAlt = c.alternativ.find(alt => classifyVegan(alt) === 'vegan')
      if (veganAlt) {
        requiredSwaps.push({ from: c.vara, to: veganAlt, reason: `${eater.namn} äter veganskt` })
      } else {
        conflicts.push({
          personId: eater.id,
          reason: 'vegan',
          detail: `${eater.namn} äter veganskt — ”${c.vara}” i ”${dishName}” har inget veganskt alternativ`,
        })
      }
    }
  }

  return { ok: conflicts.length === 0, conflicts, requiredSwaps: dedupeSwaps(requiredSwaps) }
}
