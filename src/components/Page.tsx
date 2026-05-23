import { TabName, PageSide, WeekMenu, Eater, RecipeIndexEntry } from '../types'
import VeckanView from './views/VeckanView'
import HandlaView from './views/HandlaView'
import ReceptView from './views/ReceptView'
import FamiljView from './views/FamiljView'
import AnteckningarView from './views/AnteckningarView'
import type { DayPlan } from '../presence/types'

interface Props {
  side: PageSide
  activeTab: TabName
  week: WeekMenu
  eaters: Eater[]
  recipeIndex: RecipeIndexEntry[]
  dayPlans: DayPlan[]
  selectedRecipeSlug: string | null
  onSelectRecipe: (slug: string) => void
  onOpenRecipe?: (slug: string) => void
  flippedOut?: boolean
  flippedIn?: boolean
}

export default function Page({ side, activeTab, week, eaters, recipeIndex, dayPlans, selectedRecipeSlug, onSelectRecipe, onOpenRecipe, flippedOut, flippedIn }: Props) {
  const classes = [
    'page',
    side,
    flippedOut ? 'flipped-out' : '',
    flippedIn  ? 'flipped-in'  : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className="page-view" key={`${activeTab}-${side}`}>
        {activeTab === 'veckan'       && <VeckanView       side={side} week={week} dayPlans={dayPlans} onOpenRecipe={onOpenRecipe} />}
        {activeTab === 'handla'       && <HandlaView        side={side} />}
        {activeTab === 'recept'       && <ReceptView        side={side} recipeIndex={recipeIndex} selectedSlug={selectedRecipeSlug} onSelect={onSelectRecipe} />}
        {activeTab === 'familj'       && <FamiljView        side={side} eaters={eaters} dayPlans={dayPlans} />}
        {activeTab === 'anteckningar' && <AnteckningarView  side={side} />}
      </div>
    </div>
  )
}
