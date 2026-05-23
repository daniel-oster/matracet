import { useState } from 'react'
import { TabName, Eater, RecipeIndexEntry, DayMeal, WeekNote } from '../types'
import Page from './Page'
import Tabs from './Tabs'
import RecipeOverlay from './RecipeOverlay'
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
    </>
  )
}
