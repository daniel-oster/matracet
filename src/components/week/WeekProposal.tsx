import { useMemo, useState } from 'react'
import type { Eater, RecipeIndexEntry, Recipe } from '../../types'
import type { Meal } from '../../types/meal'
import type { UseFeedback } from '../../hooks/useFeedback'
import type { TaggedOffer } from '../../lib/bevaka'
import { proposeWeek, ProposalCandidate } from '../../lib/weekProposal'

export interface OpenNeedSlot { date: string; kind: 'lunch' | 'dinner'; presentIds: string[] | null; fast: boolean }

interface Props {
  /** Slots (lunch and dinner) that need a meal and are still empty, right now. */
  openSlots: OpenNeedSlot[]
  /** Unslotted, not-done pool entries: dishes already gathered. */
  gathered: number
  /** Meal slugs already in the pool (not offered again). */
  poolMealSlugs: string[]
  meals: Meal[]
  recipeIndex: RecipeIndexEntry[]
  fullRecipes: Record<string, Recipe>
  eaters: Eater[]
  offers: TaggedOffer[]
  getFeedback: UseFeedback['getFeedback']
  recentRecipeSlugs: string[]
  recentMealSlugs: string[]
  onKeep: (c: ProposalCandidate) => void
  onOpenRecipe: (slug: string) => void
  /** Number of dishes that "Fördela på dagar" would place (0 hides the button). */
  distributeCount: number
  onDistribute: () => void
}

const keyOf = (s: { date: string; kind: string }) => `${s.date}|${s.kind}`

/**
 * "Veckan behöver N måltider" — a list of dishes (no days) sized from the schedule: open
 * slots minus dishes already gathered. Candidates come from proposeWeek, keyed per slot, and are
 * computed at seed time (and when async data arrives) — not when the pool changes — so rows
 * stay put; a kept row just disappears.
 */
export default function WeekProposal(p: Props) {
  const [seed, setSeed] = useState(0)
  const [idx, setIdx] = useState<Record<string, number>>({})
  const [gone, setGone] = useState<Set<string>>(new Set())

  const recipeCount = Object.keys(p.fullRecipes).length
  const ordered = useMemo(() => [...p.openSlots].sort((a, b) =>
    (a.kind === b.kind ? 0 : a.kind === 'dinner' ? -1 : 1) || a.date.localeCompare(b.date)), [p.openSlots])

  const cands = useMemo(
    () => proposeWeek({
      slots: ordered.map(s => ({ date: keyOf(s), presentIds: s.presentIds, fast: s.fast })),
      meals: p.meals, recipeIndex: p.recipeIndex, fullRecipes: p.fullRecipes,
      eaters: p.eaters, offers: p.offers, getFeedback: p.getFeedback,
      recentRecipeSlugs: p.recentRecipeSlugs, recentMealSlugs: p.recentMealSlugs, seed,
    }),
    // Open slots are read at (re)compute time only; gathering a dish must not reshuffle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, recipeCount, p.offers, p.meals, p.recipeIndex, p.eaters, p.recentRecipeSlugs, p.recentMealSlugs, ordered.length],
  )

  const need = Math.max(0, p.openSlots.length - p.gathered)
  const inPool = new Set(p.poolMealSlugs)
  const openKeys = new Set(ordered.map(keyOf))
  const keys = ordered.map(keyOf)
    .filter(k => (cands[k]?.length ?? 0) > 0 && !gone.has(k) && openKeys.has(k))
    .slice(0, need)

  function curIdx(k: string): number {
    if (idx[k] !== undefined) return idx[k]
    const i = cands[k].findIndex(c => !inPool.has(c.mealSlug))
    return i < 0 ? 0 : i
  }
  function pickAt(k: string): ProposalCandidate { return cands[k][curIdx(k) % cands[k].length] }

  function swap(k: string) {
    const list = cands[k]
    const others = new Set(keys.filter(x => x !== k).map(x => pickAt(x).mealSlug))
    const cur = curIdx(k)
    for (let i = 1; i <= list.length; i++) {
      const j = (cur + i) % list.length
      if (!others.has(list[j].mealSlug) && !inPool.has(list[j].mealSlug)) { setIdx(m => ({ ...m, [k]: j })); return }
    }
  }
  function keep(k: string) {
    const c = pickAt(k)
    setGone(g => new Set(g).add(k))
    p.onKeep(c)
  }
  const reseed = () => { setSeed(x => x + 1); setIdx({}); setGone(new Set()) }

  if (need === 0) {
    return (
      <div className="wprop wprop--done">
        {p.gathered > 0 ? 'Veckans måltider är samlade ✓' : 'Veckans måltider är planerade ✓'}
        {p.distributeCount > 0 && (
          <button className="wprop-btn wprop-btn--keep wprop-dist" onClick={p.onDistribute}>Fördela på dagar ({p.distributeCount})</button>
        )}
      </div>
    )
  }

  const dinners = p.openSlots.filter(s => s.kind === 'dinner').length
  const lunches = p.openSlots.filter(s => s.kind === 'lunch').length
  const sub = [
    dinners > 0 ? `${dinners} middag${dinners === 1 ? '' : 'ar'}` : '',
    lunches > 0 ? `${lunches} lunch${lunches === 1 ? '' : 'er'}` : '',
    p.gathered > 0 ? `${p.gathered} redan på listan` : '',
  ].filter(Boolean).join(' · ')

  return (
    <div className="wprop">
      <div className="wprop-head">
        <span className="wprop-title">Veckan behöver {need} måltid{need === 1 ? '' : 'er'}</span>
      </div>
      <div className="wprop-def">{sub}</div>
      {keys.length === 0 && <div className="wprop-empty">Inga förslag att visa just nu.</div>}
      {keys.map(k => {
        const c = pickAt(k)
        return (
          <div className="wprop-row" key={k}>
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
              <button className="wprop-btn wprop-btn--keep" onClick={() => keep(k)}>Behåll</button>
              <button className="wprop-btn" onClick={() => swap(k)} disabled={cands[k].length < 2}>Byt</button>
              <button className="wprop-btn wprop-btn--x" aria-label="Dölj förslaget"
                onClick={() => setGone(g => new Set(g).add(k))}>✕</button>
            </div>
          </div>
        )
      })}
      <div className="wprop-foot">
        {keys.length > 0 && <button className="wprop-btn wprop-btn--keep" onClick={() => keys.forEach(keep)}>Behåll alla</button>}
        <button className="wprop-btn" onClick={reseed}>↻ Föreslå nytt</button>
        {p.distributeCount > 0 && <button className="wprop-btn wprop-dist" onClick={p.onDistribute}>Fördela på dagar ({p.distributeCount})</button>}
      </div>
    </div>
  )
}
