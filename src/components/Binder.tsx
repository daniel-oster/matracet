import { useState } from 'react'
import { TabName, WeekMenu, Eater, RecipeIndexEntry } from '../types'
import Page from './Page'
import Tabs from './Tabs'

interface Props {
  week: WeekMenu
  eaters: Eater[]
  recipeIndex: RecipeIndexEntry[]
}

export default function Binder({ week, eaters, recipeIndex }: Props) {
  const [activeTab, setActiveTab] = useState<TabName>('veckan')
  const [portraitSide, setPortraitSide] = useState<'left' | 'right'>('left')
  const [selectedRecipeSlug, setSelectedRecipeSlug] = useState<string | null>(null)

  function handleTabChange(tab: TabName) {
    setActiveTab(tab)
    setPortraitSide('left')
    if (tab !== 'recept') setSelectedRecipeSlug(null)
  }

  const [year, isoWeek] = week.vecka.split('-W')
  const firstDay = week.middagar[0]
  const month = firstDay
    ? new Date(firstDay.datum).toLocaleDateString('sv-SE', { month: 'long' })
    : ''

  return (
    <>
      <div className="header-bar">
        <h1>Matracet <em>· Life - as it should be</em></h1>
        <div className="meta">
          Vecka {isoWeek} · {month ? `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}` : year}
        </div>
      </div>

      <div className="binder">
        <div className="spread">
          <Page
            side="left"
            activeTab={activeTab}
            week={week}
            eaters={eaters}
            recipeIndex={recipeIndex}
            selectedRecipeSlug={selectedRecipeSlug}
            onSelectRecipe={setSelectedRecipeSlug}
            flippedOut={portraitSide === 'right'}
          />

          <div className="rings">
            {Array.from({ length: 6 }, (_, i) => <div className="ring" key={i} />)}
          </div>

          <Page
            side="right"
            activeTab={activeTab}
            week={week}
            eaters={eaters}
            recipeIndex={recipeIndex}
            selectedRecipeSlug={selectedRecipeSlug}
            onSelectRecipe={setSelectedRecipeSlug}
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
    </>
  )
}
