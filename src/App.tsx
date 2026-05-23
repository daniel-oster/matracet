import { useState, useEffect } from 'react'
import { WeekMenu, EatersData, RecipeIndex, RecipeIndexEntry, DayMeal, WeekNote } from './types'
import Binder from './components/Binder'
import { resolvePresenceRange, addDays } from './presence/resolver'
import { SEED_STORE } from './presence/seed'
import type { DayPlan } from './presence/types'

function getISOWeekString(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function dagFromDate(isoDate: string): string {
  const names = ['sondag', 'mandag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lordag']
  return names[new Date(isoDate + 'T00:00:00Z').getUTCDay()]
}

export default function App() {
  const [rollingDays, setRollingDays] = useState<DayMeal[]>([])
  const [weekNotes, setWeekNotes] = useState<WeekNote[]>([])
  const [weekLabel, setWeekLabel] = useState('')
  const [eaters, setEaters] = useState<EatersData | null>(null)
  const [recipeIndex, setRecipeIndex] = useState<RecipeIndexEntry[]>([])
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const windowDates = Array.from({ length: 7 }, (_, i) => addDays(today, i))
    const weeksNeeded = [...new Set(windowDates.map(getISOWeekString))]

    const weekFetches = weeksNeeded.map(w =>
      fetch(`/matracet/data/weeks/${w}.json`)
        .then(r => r.ok ? r.json() as Promise<WeekMenu> : null)
        .catch(() => null),
    )

    Promise.all([
      fetch('/matracet/data/eaters.json').then(r => r.json()),
      fetch('/matracet/data/recipes/_index.json').then(r => r.json()),
      ...weekFetches,
    ]).then(([eatersData, indexData, ...weekResults]: [EatersData, RecipeIndex, ...(WeekMenu | null)[]]) => {
      setEaters(eatersData)
      setRecipeIndex(indexData.recipes)

      const dayMap = new Map<string, DayMeal>()
      for (const weekData of weekResults) {
        if (weekData) {
          for (const day of weekData.middagar) dayMap.set(day.datum, day)
        }
      }

      const days = windowDates.map(date =>
        dayMap.get(date) ?? { dag: dagFromDate(date), datum: date, recept: null },
      )
      setRollingDays(days)

      const primaryWeek = weekResults[0]
      setWeekNotes(primaryWeek?.anteckningar ?? [])

      const todayWeek = getISOWeekString(today)
      const todayDate = new Date(today + 'T00:00:00Z')
      const month = todayDate.toLocaleDateString('sv-SE', { month: 'long' })
      const [year, isoWeek] = todayWeek.split('-W')
      setWeekLabel(`${month.charAt(0).toUpperCase() + month.slice(1)} ${year} · Vecka ${isoWeek}`)

      setDayPlans(resolvePresenceRange(today, addDays(today, 6), SEED_STORE))
    })
  }, [])

  if (!eaters || rollingDays.length === 0) {
    return (
      <div style={{ color: '#e0d4b8', fontFamily: 'Inter Tight, sans-serif', textAlign: 'center', paddingTop: '80px' }}>
        Laddar…
      </div>
    )
  }

  return (
    <Binder
      rollingDays={rollingDays}
      weekNotes={weekNotes}
      weekLabel={weekLabel}
      eaters={eaters.eaters}
      recipeIndex={recipeIndex}
      dayPlans={dayPlans}
    />
  )
}
