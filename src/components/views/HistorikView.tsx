import { Eater, RecipeIndexEntry } from '../../types'
import type { HistoryEntry } from '../../types/history'
import TopBar from '../TopBar'

interface Props {
  onBack: () => void
  entries: HistoryEntry[]
  eaters: Eater[]
  recipeIndex: RecipeIndexEntry[]
  onOpenRecipe: (slug: string) => void
}

const SOURCE_LABEL: Record<HistoryEntry['kalla'], string> = {
  planerat: 'Planerat',
  spontant: 'Spontant',
}

function weekdayLabel(datum: string): string {
  const d = new Date(datum + 'T00:00:00Z')
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })
}

export default function HistorikView({ onBack, entries, eaters, recipeIndex, onOpenRecipe }: Props) {
  const eaterName = (id: string) => eaters.find(e => e.id === id)?.namn ?? id
  const sorted = [...entries].sort((a, b) => (a.datum === b.datum ? b.loggad.localeCompare(a.loggad) : b.datum.localeCompare(a.datum)))

  return (
    <div className="screen">
      <TopBar onBack={onBack} eyebrow="Vad vi faktiskt ätit" title="Historik" />
      <div className="screen-body">
        {sorted.length === 0 && (
          <div className="fynd-empty">
            Ingen historik ännu — berätta för Claude vad ni faktiskt ätit, särskilt sånt som inte
            var planerat (t.ex. under en kaosvecka). Claude loggar det här via skillen "log-meal".
          </div>
        )}
        {sorted.map(entry => {
          const recipe = entry.recipeSlug ? recipeIndex.find(r => r.slug === entry.recipeSlug) : undefined
          return (
            <div
              key={entry.id}
              className={`shop-row historik-row${entry.recipeSlug ? ' historik-row--clickable' : ''}`}
              onClick={() => entry.recipeSlug && onOpenRecipe(entry.recipeSlug)}
            >
              <div className="historik-row-main">
                <div className="historik-row-top">
                  <span className="historik-date">{weekdayLabel(entry.datum)}</span>
                  <span className="historik-meal">{entry.maltid === 'lunch' ? '☼ Lunch' : '☾ Middag'}</span>
                  <span className={`historik-badge historik-badge--${entry.kalla}`}>{SOURCE_LABEL[entry.kalla]}</span>
                </div>
                <div className="historik-dish">{entry.beskrivning}{recipe && ' ›'}</div>
                {entry.narvarande.length > 0 && (
                  <div className="historik-present">{entry.narvarande.map(eaterName).join(', ')}</div>
                )}
                {entry.anteckning && <div className="historik-note">{entry.anteckning}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
