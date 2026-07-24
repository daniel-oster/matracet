import { useState } from 'react'
import type { DayMeal, Eater, MealKind, RecipeIndexEntry } from '../../types'
import type { Meal } from '../../types/meal'
import type { DayPlan } from '../../presence/types'
import { useFeedback } from '../../hooks/useFeedback'
import { useWeekPlan, applyOverride, effectivePresentIds } from '../../hooks/useWeekPlan'
import { evaluateFit } from '../../lib/dietFit'
import { resolveDayMeal } from '../../lib/mealResolve'

interface Props {
  days: DayMeal[]
  lunches?: DayMeal[]
  dayPlans: DayPlan[]
  eaters: Eater[]
  recipeIndex: RecipeIndexEntry[]
  meals: Meal[]
  onOpenRecipe?: (slug: string) => void
}

interface Warning {
  key: string
  dateLabel: string
  text: string
  slug?: string
  /** 'unknown' = couldn't be checked one way or the other (see dietFit.ts's DietUnknown) —
   *  rendered in a muted, lower-urgency style, distinct from a real conflict. */
  kind: 'conflict' | 'unknown'
}

const DAY_SHORT: Record<string, string> = {
  mandag: 'mån', tisdag: 'tis', onsdag: 'ons',
  torsdag: 'tor', fredag: 'fre', lordag: 'lör', sondag: 'sön',
}

function dateLabel(day: DayMeal): string {
  const num = new Date(day.datum + 'T00:00:00Z').getUTCDate()
  return `${DAY_SHORT[day.dag] ?? day.dag} ${num}`
}

export default function WeekWarnings({ days, lunches, dayPlans, eaters, recipeIndex, meals, onOpenRecipe }: Props) {
  const [open, setOpen] = useState(true)
  const { getFeedback } = useFeedback()
  const { getOverride, getAttendance } = useWeekPlan()

  const warnings: Warning[] = []

  function collect(raw: DayMeal, kind: MealKind) {
    const attendance = getAttendance(raw.datum, kind)
    const day = applyOverride(raw, getOverride(raw.datum, kind), meals, recipeIndex, attendance)
    const slug = day.receptSlug

    // evaluateFit replaces the old hand-rolled "loop feedback.persons, filter refuses,
    // presence-gate" logic — same shared solve suggestions.ts uses, so a meal-only
    // assignment (no recipe at all) gets checked too, not just recipe-backed days. Passing
    // recipe: null here is a deliberate scope choice, not an oversight: this view has no
    // full Recipe data loaded (only the lightweight recipeIndex), and the refusal check
    // that mattered here before never needed ingredient/kategori data anyway — see
    // CLAUDE.md's Stage 4 note.
    const meal = resolveDayMeal(day, meals)
    if (!meal) return
    // Feedback is keyed by meal, not recipe (Stage 5).
    const record = getFeedback(meal.slug)

    if (record?.excludeFromWeekPlan) {
      warnings.push({
        key: `${day.datum}-${kind}-excluded`,
        dateLabel: dateLabel(day),
        text: `”${day.recept}” är utesluten ur veckoplanen men ändå planerad`,
        slug,
        kind: 'conflict',
      })
    }

    const plan = dayPlans.find(p => p.date === day.datum)
    const presentIds = effectivePresentIds(plan?.presentPersons.map(p => p.id) ?? null, attendance)
    const presentEaters = presentIds ? eaters.filter(e => presentIds.includes(e.id)) : eaters
    const fit = evaluateFit(meal, null, presentEaters, record ?? null)
    for (const c of fit.conflicts) {
      warnings.push({
        key: `${day.datum}-${kind}-${c.reason}-${c.personId}`,
        dateLabel: dateLabel(day),
        text: c.detail,
        slug,
        kind: 'conflict',
      })
    }
    for (const u of fit.unknowns) {
      warnings.push({
        key: `${day.datum}-${kind}-${u.reason}-${u.personId}`,
        dateLabel: dateLabel(day),
        text: u.detail,
        slug,
        kind: 'unknown',
      })
    }
  }

  for (const raw of days) collect(raw, 'dinner')
  for (const raw of lunches ?? []) collect(raw, 'lunch')

  if (warnings.length === 0) return null

  return (
    <div className="week-warnings">
      <button
        type="button"
        className="week-warnings-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="week-warnings-icon">⚠️</span>
        Varningar denna vecka
        <span className="week-warnings-count">{warnings.length}</span>
        <span className="week-warnings-chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="week-warnings-list">
          {warnings.map(w => (
            <li key={w.key} className={`week-warning-row${w.kind === 'unknown' ? ' week-warning-row--unknown' : ''}`}>
              <span className="week-warning-day">{w.dateLabel}</span>
              {w.slug && onOpenRecipe ? (
                <button
                  type="button"
                  className={`week-warning-text week-warning-link${w.kind === 'unknown' ? ' week-warning-text--unknown' : ''}`}
                  onClick={() => onOpenRecipe(w.slug!)}
                >
                  {w.text}
                </button>
              ) : (
                <span className={`week-warning-text${w.kind === 'unknown' ? ' week-warning-text--unknown' : ''}`}>{w.text}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
