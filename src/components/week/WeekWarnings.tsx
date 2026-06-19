import { useState } from 'react'
import type { DayMeal, Eater } from '../../types'
import type { DayPlan } from '../../presence/types'
import { useFeedback } from '../../hooks/useFeedback'
import { useWeekPlan, applyOverride } from '../../hooks/useWeekPlan'

interface Props {
  days: DayMeal[]
  dayPlans: DayPlan[]
  eaters: Eater[]
  onOpenRecipe?: (slug: string) => void
}

interface Warning {
  key: string
  date: string
  dateLabel: string
  text: string
  slug?: string
}

const DAY_SHORT: Record<string, string> = {
  mandag: 'mån', tisdag: 'tis', onsdag: 'ons',
  torsdag: 'tor', fredag: 'fre', lordag: 'lör', sondag: 'sön',
}

function dateLabel(day: DayMeal): string {
  const num = new Date(day.datum + 'T00:00:00Z').getUTCDate()
  return `${DAY_SHORT[day.dag] ?? day.dag} ${num}`
}

export default function WeekWarnings({ days, dayPlans, eaters, onOpenRecipe }: Props) {
  const [open, setOpen] = useState(true)
  const { getFeedback } = useFeedback()
  const { getOverride } = useWeekPlan()

  const eaterName = new Map(eaters.map(e => [e.id, e.namn]))
  const warnings: Warning[] = []

  for (const raw of days) {
    const day = applyOverride(raw, getOverride(raw.datum))
    const slug = day.receptSlug
    if (!slug) continue
    const record = getFeedback(slug)
    if (!record) continue

    if (record.excludeFromWeekPlan) {
      warnings.push({
        key: `${day.datum}-excluded`,
        date: day.datum,
        dateLabel: dateLabel(day),
        text: `”${day.recept}” är utesluten ur veckoplanen men ändå planerad`,
        slug,
      })
    }

    const plan = dayPlans.find(p => p.date === day.datum)
    const presentIds = plan?.presentPersons.map(p => p.id) ?? null
    for (const p of record.persons) {
      if (p.sentiment !== 'refuses') continue
      if (presentIds && !presentIds.includes(p.personId)) continue
      warnings.push({
        key: `${day.datum}-refuses-${p.personId}`,
        date: day.datum,
        dateLabel: dateLabel(day),
        text: `${eaterName.get(p.personId) ?? p.personId} vägrar äta ”${day.recept}”`,
        slug,
      })
    }
  }

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
            <li key={w.key} className="week-warning-row">
              <span className="week-warning-day">{w.dateLabel}</span>
              {w.slug && onOpenRecipe ? (
                <button
                  type="button"
                  className="week-warning-text week-warning-link"
                  onClick={() => onOpenRecipe(w.slug!)}
                >
                  {w.text}
                </button>
              ) : (
                <span className="week-warning-text">{w.text}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
