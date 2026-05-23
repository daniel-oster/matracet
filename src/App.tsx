import { useState, useEffect } from 'react'
import { WeekMenu, EatersData, RecipeIndex, RecipeIndexEntry } from './types'
import Binder from './components/Binder'
import { resolvePresenceRange } from './presence/resolver'
import { SEED_STORE } from './presence/seed'
import type { DayPlan } from './presence/types'

const CURRENT_WEEK = '2026-W21'

export default function App() {
  const [week, setWeek] = useState<WeekMenu | null>(null)
  const [eaters, setEaters] = useState<EatersData | null>(null)
  const [recipeIndex, setRecipeIndex] = useState<RecipeIndexEntry[]>([])
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([])

  useEffect(() => {
    Promise.all([
      fetch(`/matracet/data/weeks/${CURRENT_WEEK}.json`).then(r => r.json()),
      fetch('/matracet/data/eaters.json').then(r => r.json()),
      fetch('/matracet/data/recipes/_index.json').then(r => r.json()),
    ]).then(([weekData, eatersData, indexData]: [WeekMenu, EatersData, RecipeIndex]) => {
      setWeek(weekData)
      setEaters(eatersData)
      setRecipeIndex(indexData.recipes)
      if (weekData.middagar.length > 0) {
        const start = weekData.middagar[0].datum
        const end = weekData.middagar[weekData.middagar.length - 1].datum
        setDayPlans(resolvePresenceRange(start, end, SEED_STORE))
      }
    })
  }, [])

  if (!week || !eaters) {
    return (
      <div style={{ color: '#e0d4b8', fontFamily: 'Inter Tight, sans-serif', textAlign: 'center', paddingTop: '80px' }}>
        Laddar…
      </div>
    )
  }

  return <Binder week={week} eaters={eaters.eaters} recipeIndex={recipeIndex} dayPlans={dayPlans} />
}
