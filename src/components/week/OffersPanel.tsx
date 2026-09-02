import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { TaggedOffer } from '../../lib/bevaka'
import type { RankedSuggestion } from '../../lib/suggestions'
import { parseSavings } from '../../lib/suggestions'
import { validityNote, type DateRange } from '../../lib/offerValidity'
import type { Meal } from '../../types/meal'
import { resolveMealForRecipe } from '../../lib/mealResolve'
import CollapsibleSection from './CollapsibleSection'

interface Props {
  offers: TaggedOffer[]
  /** The days being planned — an offer not covering all of them gets a "t.o.m. …" note. */
  period: DateRange
  /** Set when no saved flyer covers `period`, e.g. "senast sparade veckan (v.35) gick ut
   * sön 30/8" — shown instead of a bare empty list, so an out-of-date import reads as an
   * out-of-date import rather than as "no offers this week". */
  staleNote: string | null
  /** True until the offer files have arrived. An empty list means "nothing valid these
   * days" only once loading is done — saying that while still fetching is just wrong. */
  loading: boolean
  isActiveForOffer: (namn: string, store: string) => boolean
  onToggleOffer: (o: TaggedOffer) => void
  fromOffers: RankedSuggestion[]
  meals: Meal[]
  onOpenRecipe: (slug: string) => void
  renderAssign: (key: string, namn: string, mealSlug: string, receptSlug: string | null, reuseEntryId?: string) => ReactNode
}

/**
 * "🏷 Veckans fynd" (food-only offers, ranked by value, tap-to-shop) + the collapsed-by-
 * default "💡 Förslag från fynden" (meals/recipes derivable from what's cheap) — the
 * inspiration-first heart of the 2026-08 Planera redesign (issue #93). Offers are already
 * filtered to `MEAL_PLANNING_GROUPS` by the caller; this component only ranks/renders them.
 */
export default function OffersPanel({ offers, period, staleNote, loading, isActiveForOffer, onToggleOffer, fromOffers, meals, onOpenRecipe, renderAssign }: Props) {
  const [showAll, setShowAll] = useState(false)
  const ranked = useMemo(
    () => [...offers].sort((a, b) => parseSavings(b.besparing) - parseSavings(a.besparing)),
    [offers],
  )
  const visible = showAll ? ranked : ranked.slice(0, 8)

  // Most of a week's offers share one end date, so repeating "t.o.m. sön 6/9" on every chip
  // is noise — the shared note goes in the section header once, and a chip only carries its
  // own when it differs (the mid-week coupon this whole thing exists to surface).
  const commonNote = useMemo(() => {
    const counts = new Map<string | null, number>()
    for (const o of ranked) {
      const note = validityNote(o.giltig, period)
      counts.set(note, (counts.get(note) ?? 0) + 1)
    }
    let best: string | null = null
    let bestCount = 0
    for (const [note, n] of counts) {
      if (n > bestCount) { best = note; bestCount = n }
    }
    return best
  }, [ranked, period])

  return (
    <>
      <CollapsibleSection id="offers" title="🏷 Veckans fynd" hint={commonNote ? `mat · ${commonNote}` : 'mat'} defaultCollapsed={false}>
        {commonNote && (
          // The section hint only renders while collapsed, and this is exactly the fact you
          // need while looking at the chips: most of them stop before the week you're planning
          // does. Chips that differ from this still carry their own note.
          <div className="offer-period">Fynden gäller {commonNote}</div>
        )}
        <div className="offer-cloud">
          {visible.map((o, i) => {
            const savings = parseSavings(o.besparing)
            const inList = isActiveForOffer(o.namn, o.store)
            const own = validityNote(o.giltig, period)
            const note = own === commonNote ? null : own
            return (
              <button
                key={`${o.store}-${o.namn}-${i}`}
                type="button"
                className={`offer-chip${savings > 0 ? ' offer-chip--fynd' : ''}${inList ? ' on' : ''}`}
                onClick={() => onToggleOffer(o)}
                title={note ? `Gäller ${note}` : undefined}
              >
                {inList ? '✓ ' : ''}{o.namn}
                {savings > 0 && <span className="offer-chip-save">−{savings}kr</span>}
                {note && <span className="offer-chip-when">{note}</span>}
              </button>
            )
          })}
          {ranked.length === 0 && (
            <div className="tray-empty">
              {loading
                ? 'Laddar erbjudanden…'
                : staleNote
                  ? `Inga erbjudanden gäller de här dagarna – ${staleNote}.`
                  : 'Inga matfynd den här veckan.'}
            </div>
          )}
        </div>
        {ranked.length > 8 && (
          <button type="button" className="offer-more" onClick={() => setShowAll(v => !v)}>
            {showAll ? '▲ visa färre' : `visa ${ranked.length - 8} till ▸`} · tryck = inköpslistan
          </button>
        )}
      </CollapsibleSection>

      <CollapsibleSection id="forslag-fynden" title="💡 Förslag från fynden" defaultCollapsed={false}>
        {fromOffers.length === 0 && <div className="tray-empty">Inga förslag från veckans fynd än.</div>}
        <div className="sugg-list">
          {fromOffers.slice(0, 8).map(s => {
            const meal = resolveMealForRecipe(s.entry.slug, s.entry.namn, meals)
            return (
              <div key={s.entry.slug} className="sugg-card">
                {s.entry.bildUrl
                  ? <img className="sugg-card-img" src={s.entry.bildUrl} alt="" />
                  : <div className="sugg-card-img sugg-card-img--empty" />}
                <div className="sugg-card-body">
                  <button type="button" className="sugg-card-name" onClick={() => onOpenRecipe(s.entry.slug)}>
                    {s.entry.namn}
                  </button>
                  <div className="sugg-card-tags">
                    {s.tags.map((t, i) => <span key={i} className={`tray-tag tray-tag--${t.kind}`}>{t.text}</span>)}
                  </div>
                </div>
                {renderAssign(s.entry.slug, s.entry.namn, meal.slug, s.entry.slug)}
              </div>
            )
          })}
        </div>
      </CollapsibleSection>
    </>
  )
}
