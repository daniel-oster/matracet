import { useState } from 'react'
import { DayMeal, Eater, RecipeIndexEntry } from '../../types'
import type { Meal } from '../../types/meal'
import type { DayPlan } from '../../presence/types'
import TopBar from '../TopBar'
import VeckanOverview from '../week/VeckanOverview'
import VeckanPlanner from '../week/VeckanPlanner'

interface Props {
  onBack: () => void
  weekLabel: string
  rollingDays: DayMeal[]
  rollingLunches: DayMeal[]
  dayPlans: DayPlan[]
  eaters: Eater[]
  recipeIndex: RecipeIndexEntry[]
  meals: Meal[]
  onOpenRecipe: (slug: string) => void
}

export default function VeckanView({ onBack, weekLabel, rollingDays, rollingLunches, dayPlans, eaters, recipeIndex, meals, onOpenRecipe }: Props) {
  const [mode, setMode] = useState<'view' | 'plan'>('view')

  return (
    <div className="screen screen--veckan">
      <TopBar onBack={onBack} eyebrow={weekLabel} title="Veckan" />
      <div className="mode-toggle">
        <button className={mode === 'view' ? 'on' : ''} onClick={() => setMode('view')}>Vecka</button>
        <button className={mode === 'plan' ? 'on' : ''} onClick={() => setMode('plan')}>Planera</button>
      </div>
      <div className="screen-body">
        {mode === 'view' ? (
          <VeckanOverview
            days={rollingDays}
            lunches={rollingLunches}
            dayPlans={dayPlans}
            eaters={eaters}
            recipeIndex={recipeIndex}
            meals={meals}
            onOpenRecipe={onOpenRecipe}
            onEdit={() => setMode('plan')}
          />
        ) : (
          <VeckanPlanner
            days={rollingDays}
            lunches={rollingLunches}
            dayPlans={dayPlans}
            eaters={eaters}
            recipeIndex={recipeIndex}
            meals={meals}
            onOpenRecipe={onOpenRecipe}
          />
        )}
      </div>
    </div>
  )
}
