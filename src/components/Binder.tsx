import { useState } from 'react'
import { TabName, Eater, RecipeIndexEntry, DayMeal, WeekNote } from '../types'
import Page from './Page'
import Tabs from './Tabs'
import RecipeOverlay from './RecipeOverlay'
import ReplaceRecipeModal from './week/ReplaceRecipeModal'
import { useWeekPlan } from '../hooks/useWeekPlan'
import type { DayPlan } from '../presence/types'

interface Props {
  rollingDays: DayMeal[]
  weekNotes: WeekNote[]
  weekLabel: string
  eaters: Eater[]
  recipeIndex: RecipeIndexEntry[]
  dayPlans: DayPlan[]
}

export default function Binder({ rollingDays, weekNotes, weekLabel, eaters, recipeIndex, dayPlans }: Props) {
  const [activeTab, setActiveTab] = useState<TabName>('veckan')
  const [portraitSide, setPortraitSide] = useState<'left' | 'right'>('left')
  const [selectedRecipeSlug, setSelectedRecipeSlug] = useState<string | null>(null)
  const [overlaySlug, setOverlaySlug] = useState<string | null>(null)
  const [replaceDate, setReplaceDate] = useState<string | null>(null)
  const [offerStoreFilter, setOfferStoreFilter] = useState<Record<string, boolean>>({ willys: true, ica: true, hemkop: true })
  const [offerSwedishOnly, setOfferSwedishOnly] = useState(false)
  const [fyndMode, setFyndMode] = useState<'alla' | 'jamfor'>('alla')
  const [fyndWeek, setFyndWeek] = useState<string | null>(null)
  const { setMeal } = useWeekPlan()

  const toggleOfferStore = (store: string) =>
    setOfferStoreFilter(prev => ({ ...prev, [store]: !prev[store] }))

  const replaceDay = replaceDate ? rollingDays.find(d => d.datum === replaceDate) : undefined
  const replacePlan = replaceDate ? dayPlans.find(p => p.date === replaceDate) : undefined

  function handleTabChange(tab: TabName) {
    setActiveTab(tab)
    setPortraitSide('left')
    if (tab !== 'recept') setSelectedRecipeSlug(null)
  }

  return (
    <>
      <div className="header-bar">
        <h1>Matracet <em>· Life - as it should be</em></h1>
        <div className="meta">{weekLabel}</div>
      </div>

      <div className="binder">
        <div className="spread">
          <Page
            side="left"
            activeTab={activeTab}
            rollingDays={rollingDays}
            weekNotes={weekNotes}
            eaters={eaters}
            recipeIndex={recipeIndex}
            dayPlans={dayPlans}
            selectedRecipeSlug={selectedRecipeSlug}
            onSelectRecipe={setSelectedRecipeSlug}
            onOpenRecipe={setOverlaySlug}
            onReplaceDay={setReplaceDate}
            offerStoreFilter={offerStoreFilter}
            onToggleOfferStore={toggleOfferStore}
            offerSwedishOnly={offerSwedishOnly}
            onToggleOfferSwedish={() => setOfferSwedishOnly(v => !v)}
            fyndMode={fyndMode}
            onToggleFyndMode={() => setFyndMode(m => m === 'alla' ? 'jamfor' : 'alla')}
            fyndWeek={fyndWeek}
            onSelectFyndWeek={setFyndWeek}
            flippedOut={portraitSide === 'right'}
          />

          <div className="rings">
            {Array.from({ length: 6 }, (_, i) => <div className="ring" key={i} />)}
          </div>

          <Page
            side="right"
            activeTab={activeTab}
            rollingDays={rollingDays}
            weekNotes={weekNotes}
            eaters={eaters}
            recipeIndex={recipeIndex}
            dayPlans={dayPlans}
            selectedRecipeSlug={selectedRecipeSlug}
            onSelectRecipe={setSelectedRecipeSlug}
            onOpenRecipe={setOverlaySlug}
            onReplaceDay={setReplaceDate}
            offerStoreFilter={offerStoreFilter}
            onToggleOfferStore={toggleOfferStore}
            offerSwedishOnly={offerSwedishOnly}
            onToggleOfferSwedish={() => setOfferSwedishOnly(v => !v)}
            fyndMode={fyndMode}
            onToggleFyndMode={() => setFyndMode(m => m === 'alla' ? 'jamfor' : 'alla')}
            fyndWeek={fyndWeek}
            onSelectFyndWeek={setFyndWeek}
            flippedIn={portraitSide === 'right'}
          />

          <Tabs active={activeTab} onChange={handleTabChange} />
        </div>
      </div>

      <div className="flip-bar">
        <button
          className="flip-btn"
          disabled={portraitSide === 'left'}
          onClick={() => setPortraitSide('left')}
        >
          ← Vänster sida
        </button>
        <span className="flip-indicator">
          Sida {portraitSide === 'left' ? 1 : 2} av 2
        </span>
        <button
          className="flip-btn"
          disabled={portraitSide === 'right'}
          onClick={() => setPortraitSide('right')}
        >
          Höger sida →
        </button>
      </div>

      {overlaySlug && (
        <RecipeOverlay slug={overlaySlug} onClose={() => setOverlaySlug(null)} />
      )}

      {replaceDate && replaceDay && (
        <ReplaceRecipeModal
          dayLabel={formatDayLabel(replaceDay.dag, replaceDay.datum)}
          recipeIndex={recipeIndex}
          presentPersonIds={replacePlan?.presentPersons.map(p => p.id) ?? null}
          eaters={eaters}
          onSelect={entry => {
            setMeal(replaceDate, entry.namn, entry.slug)
            setReplaceDate(null)
          }}
          onClose={() => setReplaceDate(null)}
        />
      )}
    </>
  )
}

const DAY_NAMES: Record<string, string> = {
  mandag: 'Måndag', tisdag: 'Tisdag', onsdag: 'Onsdag',
  torsdag: 'Torsdag', fredag: 'Fredag', lordag: 'Lördag', sondag: 'Söndag',
}

function formatDayLabel(dag: string, datum: string): string {
  const d = new Date(datum + 'T00:00:00Z')
  const num = d.getUTCDate()
  const month = d.toLocaleDateString('sv-SE', { month: 'long', timeZone: 'UTC' })
  return `${DAY_NAMES[dag] ?? dag} ${num} ${month}`
}
