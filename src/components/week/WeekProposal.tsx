import { useMemo, useState } from 'react'
import type { Eater, RecipeIndexEntry, Recipe } from '../../types'
import type { Meal } from '../../types/meal'
import type { UseFeedback } from '../../hooks/useFeedback'
import type { TaggedOffer } from '../../lib/bevaka'
import { proposeWeek, ProposalSlot, ProposalCandidate } from '../../lib/weekProposal'

interface Props {
  /** Dinner slots that need a meal and are still empty, right now. */
  openSlots: ProposalSlot[]
  meals: Meal[]
  recipeIndex: RecipeIndexEntry[]
  fullRecipes: Record<string, Recipe>
  eaters: Eater[]
  offers: TaggedOffer[]
  getFeedback: UseFeedback['getFeedback']
  recentRecipeSlugs: string[]
  recentMealSlugs: string[]
  dayLabel: (date: string) => string
  onKeep: (date: string, c: ProposalCandidate) => void
  onOpenRecipe: (slug: string) => void
}

/**
 * "Veckans förslag" — one proposed dinner per open dinner slot (see src/lib/weekProposal.ts).
 * Candidates are computed from the open dates at seed time (and when async data such as
 * recipes/offers arrives) — not on every slot fill — so the list stays put while clicking;
 * filled dates simply drop out of the visible rows.
 */
export default function WeekProposal(p: Props) {
  const [seed, setSeed] = useState(0)
  const [idx, setIdx] = useState<Record<string, number>>({})
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const recipeCount = Object.keys(p.fullRecipes).length

  const cands = useMemo(
    () => proposeWeek({
      slots: p.openSlots, meals: p.meals, recipeIndex: p.recipeIndex, fullRecipes: p.fullRecipes,
      eaters: p.eaters, offers: p.offers, getFeedback: p.getFeedback,
      recentRecipeSlugs: p.recentRecipeSlugs, recentMealSlugs: p.recentMealSlugs, seed,
    }),
    // openSlots intentionally read at (re)compute time only; filling a slot must not reshuffle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, recipeCount, p.offers, p.meals, p.recipeIndex, p.eaters, p.recentRecipeSlugs, p.recentMealSlugs],
  )

  const openDates = new Set(p.openSlots.map(s => s.date))
  const dates = Object.keys(cands).sort().filter(d => cands[d].length > 0 && !hidden.has(d) && openDates.has(d))

  function pickAt(date: string): ProposalCandidate | undefined {
    const list = cands[date]
    return list?.[(idx[date] ?? 0) % list.length]
  }

  if (p.openSlots.length === 0) {
    return <div className="wprop wprop--done">Veckans middagar är planerade ✓</div>
  }
  if (dates.length === 0) {
    return (
      <div className="wprop">
        <div className="wprop-head"><span className="wprop-title">Veckans förslag</span></div>
        <div className="wprop-empty">Inga förslag att visa just nu.</div>
        <div className="wprop-foot">
          <button className="wprop-btn" onClick={() => { setSeed(s => s + 1); setIdx({}); setHidden(new Set()) }}>↻ Föreslå nytt</button>
        </div>
      </div>
    )
  }

  function swap(date: string) {
    const list = cands[date]
    const others = new Set(dates.filter(d => d !== date).map(d => pickAt(d)?.mealSlug))
    const cur = idx[date] ?? 0
    for (let i = 1; i <= list.length; i++) {
      const j = (cur + i) % list.length
      if (!others.has(list[j].mealSlug)) { setIdx(m => ({ ...m, [date]: j })); return }
    }
  }

  return (
    <div className="wprop">
      <div className="wprop-head">
        <span className="wprop-title">Veckans förslag</span>
        <span className="wprop-count">{dates.length} middag{dates.length === 1 ? '' : 'ar'}</span>
      </div>
      <div className="wprop-def">förslag för middagarna som saknar mat</div>
      {dates.map(date => {
        const c = pickAt(date)!
        return (
          <div className="wprop-row" key={date}>
            <div className="wprop-day">{p.dayLabel(date)}</div>
            <div className="wprop-main">
              <div className="wprop-meal">{c.mealNamn}</div>
              <button className="wprop-recipe" onClick={() => p.onOpenRecipe(c.receptSlug)}>{c.receptNamn} ›</button>
              {c.reasons.length > 0 && (
                <div className="wprop-reasons">
                  {c.reasons.map((r, i) => <span className="wprop-chip" key={i}>{r}</span>)}
                </div>
              )}
            </div>
            <div className="wprop-actions">
              <button className="wprop-btn wprop-btn--keep" onClick={() => p.onKeep(date, c)}>Behåll</button>
              <button className="wprop-btn" onClick={() => swap(date)} disabled={cands[date].length < 2}>Byt</button>
              <button className="wprop-btn wprop-btn--x" aria-label="Hoppa över dagen"
                onClick={() => setHidden(h => new Set(h).add(date))}>✕</button>
            </div>
          </div>
        )
      })}
      <div className="wprop-foot">
        <button className="wprop-btn wprop-btn--keep" onClick={() => dates.forEach(d => p.onKeep(d, pickAt(d)!))}>Behåll alla</button>
        <button className="wprop-btn" onClick={() => { setSeed(s => s + 1); setIdx({}) }}>↻ Föreslå nytt</button>
      </div>
    </div>
  )
}
