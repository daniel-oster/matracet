import { TabName, PageSide, Eater, RecipeIndexEntry, DayMeal, WeekNote } from '../types'
import VeckanView from './views/VeckanView'
import HandlaView from './views/HandlaView'
import ReceptView from './views/ReceptView'
import FamiljView from './views/FamiljView'
import AnteckningarView from './views/AnteckningarView'
import FyndView from './views/FyndView'
import type { DayPlan } from '../presence/types'

interface Props {
  side: PageSide
  activeTab: TabName
  rollingDays: DayMeal[]
  weekNotes: WeekNote[]
  eaters: Eater[]
  recipeIndex: RecipeIndexEntry[]
  dayPlans: DayPlan[]
  selectedRecipeSlug: string | null
  onSelectRecipe: (slug: string) => void
  onOpenRecipe?: (slug: string) => void
  onReplaceDay?: (date: string) => void
  offerStoreFilter: Record<string, boolean>
  onToggleOfferStore: (store: string) => void
  offerSwedishOnly: boolean
  onToggleOfferSwedish: () => void
  flippedOut?: boolean
  flippedIn?: boolean
}

export default function Page({ side, activeTab, rollingDays, weekNotes, eaters, recipeIndex, dayPlans, selectedRecipeSlug, onSelectRecipe, onOpenRecipe, onReplaceDay, offerStoreFilter, onToggleOfferStore, offerSwedishOnly, onToggleOfferSwedish, flippedOut, flippedIn }: Props) {
  const classes = [
    'page',
    side,
    flippedOut ? 'flipped-out' : '',
    flippedIn  ? 'flipped-in'  : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className="page-view" key={`${activeTab}-${side}`}>
        {activeTab === 'veckan'       && <VeckanView       side={side} days={rollingDays} dayPlans={dayPlans} eaters={eaters} onOpenRecipe={onOpenRecipe} onReplaceDay={onReplaceDay} />}
        {activeTab === 'fynd'         && <FyndView          side={side} storeFilter={offerStoreFilter} onToggleStore={onToggleOfferStore} swedishOnly={offerSwedishOnly} onToggleSwedish={onToggleOfferSwedish} />}
        {activeTab === 'handla'       && <HandlaView        side={side} />}
        {activeTab === 'recept'       && <ReceptView        side={side} recipeIndex={recipeIndex} eaters={eaters} selectedSlug={selectedRecipeSlug} onSelect={onSelectRecipe} />}
        {activeTab === 'familj'       && <FamiljView        side={side} eaters={eaters} dayPlans={dayPlans} />}
        {activeTab === 'anteckningar' && <AnteckningarView  side={side} weekNotes={weekNotes} />}
      </div>
    </div>
  )
}
