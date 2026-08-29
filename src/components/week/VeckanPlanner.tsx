import { useMemo, useState } from 'react'
import { DayMeal, Eater, MealKind, Recipe, RecipeIndexEntry } from '../../types'
import type { Meal } from '../../types/meal'
import type { DayPlan } from '../../presence/types'
import { addDays } from '../../presence/resolver'
import {
  useWeekPlan, applyOverride, effectivePresentIds, diffAttendance,
  MealAttendance, WeekPlanOverride,
} from '../../hooks/useWeekPlan'
import { useFeedback } from '../../hooks/useFeedback'
import { useRecipes } from '../../hooks/useRecipes'
import { useOffers } from '../../hooks/useOffers'
import { usePantry } from '../../hooks/usePantry'
import { useStash } from '../../hooks/useStash'
import { useShoppingList } from '../../hooks/useShoppingList'
import { useLocalMeals } from '../../hooks/useLocalMeals'
import { useMealPool } from '../../hooks/useMealPool'
import { useIrrelevantOffers } from '../../hooks/useIrrelevantOffers'
import { tagOffers, TaggedOffer } from '../../lib/bevaka'
import { rankSuggestions, SuggestionFilter, SuggestionSort, FAST_THRESHOLD_MIN } from '../../lib/suggestions'
import { findUnlockOpportunities } from '../../lib/unlockMatch'
import { filterPlannableRecipes } from '../../lib/recipeKind'
import { matchPantryRecipes } from '../../lib/pantryMatch'
import {
  resolveMealForRecipe, resolveComponents, resolveDayMeal, matchMealByName,
} from '../../lib/mealResolve'
import { evaluateFit, DietFitResult } from '../../lib/dietFit'
import { buildPoolRows, sortPoolRows, computeBudget, resolveDisplacedOccupant, filterEntriesToWindow, BudgetSlotFlags, FilledSlot, PoolRow } from '../../lib/mealPool'
import { MEAL_PLANNING_GROUPS, groupOf } from '../../lib/kategoriTaxonomy.mjs'
import MealEditorModal from '../MealEditorModal'
import CollapsibleSection from './CollapsibleSection'
import BudgetBar from './BudgetBar'
import SlotBoard, { BoardDayRow, BoardCell } from './SlotBoard'
import SlotDetail from './SlotDetail'
import MealPoolList from './MealPoolList'
import OffersPanel from './OffersPanel'
import AssignControls from './AssignControls'
import type { SlotChipData } from './SlotPicker'

const DAY_SHORT: Record<string, string> = {
  mandag: 'Mån', tisdag: 'Tis', onsdag: 'Ons',
  torsdag: 'Tor', fredag: 'Fre', lordag: 'Lör', sondag: 'Sön',
}
const DAY_NAMES: Record<string, string> = {
  mandag: 'Måndag', tisdag: 'Tisdag', onsdag: 'Onsdag',
  torsdag: 'Torsdag', fredag: 'Fredag', lordag: 'Lördag', sondag: 'Söndag',
}

function dateNum(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDate()
}

const FILTERS: { id: SuggestionFilter; label: string }[] = [
  { id: 'alla', label: 'Alla' },
  { id: 'fynd', label: '🏷 Fynd' },
  { id: 'snabbt', label: '⚡ Snabbt' },
  { id: 'vegansk', label: '🌱 Vegansk' },
]

const SORTS: { id: SuggestionSort; label: string }[] = [
  { id: 'match', label: 'Bäst' },
  { id: 'savings', label: '💰 Besparing' },
  { id: 'favorites', label: '❤ Favoriter' },
  { id: 'fastest', label: '⚡ Snabbast' },
]

interface SlotInfo {
  date: string
  kind: MealKind
  dag: string
  label: string | null
  slug: string | null
  mealSlug: string | undefined
  skip: boolean
  presentIds: string[] | null
  planPresentIds: string[] | null
  attendance: MealAttendance | undefined
  override: WeekPlanOverride | undefined
  fast: boolean
  meal: Meal | null
  recipeEntry: RecipeIndexEntry | null
  fullRecipe: Recipe | undefined
  fit: DietFitResult | null
}

interface Props {
  days: DayMeal[]
  lunches: DayMeal[]
  dayPlans: DayPlan[]
  eaters: Eater[]
  recipeIndex: RecipeIndexEntry[]
  meals: Meal[]
  onOpenRecipe: (slug: string) => void
}

/**
 * Planera — the 2026-08 meal-pool redesign (issue #93). Replaces the old day-first
 * "select a day, act below" flow: the week's meals are a flat pool first (slotted or not),
 * assignment happens via an inline slot picker attached to whichever row you're looking at,
 * and the day board becomes a read-only overview you drill into for per-slot detail
 * (attendance, "kort om tid", component swaps) rather than the thing that drives assignment.
 * See CLAUDE.md's "Planera redesign" section for the full data-model writeup.
 */
export default function VeckanPlanner({ days, lunches, dayPlans, eaters, recipeIndex, meals, onOpenRecipe }: Props) {
  const { getOverride, setMeal, clearOverride, setComponentSwap, getAttendance, setAttendance, clearAttendance, getFast, setFast } = useWeekPlan()
  const { getFeedback } = useFeedback()
  const allSlugs = useMemo(() => recipeIndex.map(r => r.slug), [recipeIndex])
  const fullRecipes = useRecipes(allSlugs)
  const { stores } = useOffers()
  const allOffers = useMemo(() => (stores ? tagOffers(stores) : []), [stores])
  const { isIrrelevant } = useIrrelevantOffers()
  const foodOffers = useMemo(
    () => allOffers.filter(o => MEAL_PLANNING_GROUPS.includes(groupOf(o.kategori)) && !isIrrelevant(o.namn)),
    [allOffers, isIrrelevant],
  )
  const pantry = usePantry()
  const { items: stashItems } = useStash()
  const { addOrRestoreByName, isActiveByName, isActiveForOffer, removeOrMarkForOffer } = useShoppingList()
  const { upsertMeal } = useLocalMeals()
  const pool = useMealPool()

  const haveNames = useMemo(() => [
    ...(pantry?.always_have ?? []),
    ...(pantry?.current_stock.map(i => i.vara) ?? []),
    ...stashItems.filter(i => !i.done && i.kind === 'stock').map(i => i.namn),
  ], [pantry, stashItems])

  const unlockOpportunities = useMemo(
    () => findUnlockOpportunities(recipeIndex, fullRecipes, haveNames),
    [recipeIndex, fullRecipes, haveNames],
  )
  const [expandedUnlock, setExpandedUnlock] = useState<string | null>(null)

  function buildSlotInfo(rawDay: DayMeal, kind: MealKind, plan: DayPlan | undefined): SlotInfo {
    const attendance = getAttendance(rawDay.datum, kind)
    const override = getOverride(rawDay.datum, kind)
    const fast = getFast(rawDay.datum, kind)
    const day = applyOverride(rawDay, override, meals, recipeIndex, attendance)
    const planPresentIds = plan?.presentPersons.map(p => p.id) ?? null
    const presentIds = effectivePresentIds(planPresentIds, attendance)
    const presentEaters = presentIds ? eaters.filter(e => presentIds.includes(e.id)) : eaters
    const meal = attendance?.skip ? null : resolveDayMeal(day, meals)
    const recipeEntry = day.receptSlug ? recipeIndex.find(r => r.slug === day.receptSlug) ?? null : null
    const fullRecipe = day.receptSlug ? fullRecipes[day.receptSlug] : undefined
    const feedback = meal ? getFeedback(meal.slug) : null
    const fit = meal ? evaluateFit(meal, fullRecipe ?? recipeEntry ?? null, presentEaters, feedback ?? null) : null
    return {
      date: rawDay.datum, kind, dag: rawDay.dag,
      label: attendance?.skip ? null : (day.recept ?? day.anteckning ?? null),
      slug: day.receptSlug ?? null,
      mealSlug: attendance?.skip ? undefined : day.mealSlug,
      skip: !!attendance?.skip,
      presentIds, planPresentIds, attendance, override, fast,
      meal, recipeEntry, fullRecipe, fit,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }

  const daySlots = useMemo(() => days.map(rawDay => {
    const plan = dayPlans.find(p => p.date === rawDay.datum)
    const rawLunch = lunches.find(l => l.datum === rawDay.datum) ?? { dag: rawDay.dag, datum: rawDay.datum, recept: null }
    return {
      date: rawDay.datum,
      dag: rawDay.dag,
      lunch: buildSlotInfo(rawLunch, 'lunch', plan),
      dinner: buildSlotInfo(rawDay, 'dinner', plan),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [days, lunches, dayPlans, meals, recipeIndex, fullRecipes, getOverride, getAttendance, getFast, eaters])

  const flatSlots = useMemo(() => daySlots.flatMap(d => [d.lunch, d.dinner]), [daySlots])

  const budgetSlotFlags: BudgetSlotFlags[] = useMemo(() => flatSlots.map(s => {
    const needsMeal = !s.skip && (s.presentIds === null || s.presentIds.length > 0)
    const veganRequired = (s.presentIds ? eaters.filter(e => s.presentIds!.includes(e.id)) : eaters).some(e => e.kost?.includes('vegan'))
    const veganSatisfied = !!s.meal && !!s.fit
      && !s.fit.conflicts.some(c => c.reason === 'vegan')
      && !s.fit.unknowns.some(u => u.reason === 'vegan-unknown')
    const tidMin = s.recipeEntry?.tid_min ?? s.meal?.tid_min
    const fastSatisfied = !!s.meal && tidMin != null && tidMin <= FAST_THRESHOLD_MIN
    const poolEntry = pool.entries.find(e => e.slot?.date === s.date && e.slot?.kind === s.kind)
    return { needsMeal, filled: !!s.label, veganRequired, veganSatisfied, fastFlag: s.fast, fastSatisfied, isLeftover: !!poolEntry?.resterAv }
  }), [flatSlots, eaters, pool.entries])

  const budget = useMemo(() => computeBudget(budgetSlotFlags), [budgetSlotFlags])

  const filledSlots: FilledSlot[] = useMemo(
    () => flatSlots.filter(s => s.mealSlug).map(s => ({
      date: s.date, kind: s.kind, mealSlug: s.mealSlug!, receptSlug: s.slug, label: s.label ?? s.mealSlug!,
    })),
    [flatSlots],
  )

  // "Veckans måltider" always shows every planned/pool meal regardless of the search box
  // above it — the search box is for finding something new to add, not for narrowing what
  // you've already added (a household report: typing to search for a new dish was hiding
  // already-planned meals that didn't match, reading as if they'd been removed).
  const windowDates = useMemo(() => days.map(d => d.datum), [days])
  const poolRows = useMemo(
    () => sortPoolRows(buildPoolRows(filterEntriesToWindow(pool.entries, windowDates), filledSlots)),
    [pool.entries, filledSlots, windowDates],
  )

  function dayLabel(date: string): string {
    const dag = days.find(d => d.datum === date)?.dag ?? ''
    return `${DAY_SHORT[dag] ?? dag} ${dateNum(date)}`
  }

  const [leftoverHints, setLeftoverHints] = useState<Record<string, string>>({}) // entryId -> preferred ISO date

  function buildSlotChips(preferredKey?: string): { free: SlotChipData[]; occupied: SlotChipData[] } {
    const free: SlotChipData[] = []
    const occupied: SlotChipData[] = []
    for (const s of flatSlots) {
      if (s.skip) continue
      const presentEaters = s.presentIds ? eaters.filter(e => s.presentIds!.includes(e.id)) : eaters
      const glyphs: string[] = []
      if (presentEaters.some(e => e.kost?.includes('vegan'))) glyphs.push('🌱')
      if (s.fast) glyphs.push('⚡')
      const chip: SlotChipData = { date: s.date, kind: s.kind, dayLabel: dayLabel(s.date), free: !s.label, glyphs, occupantLabel: s.label ?? undefined }
      if (s.label) occupied.push(chip)
      else free.push(chip)
    }
    if (preferredKey && leftoverHints[preferredKey]) {
      const preferredDate = leftoverHints[preferredKey]
      const idx = free.findIndex(f => f.date === preferredDate && f.kind === 'lunch')
      if (idx > 0) {
        const [item] = free.splice(idx, 1)
        free.unshift(item)
      }
    }
    return { free, occupied }
  }

  function assignToSlot(date: string, kind: MealKind, mealSlug: string, receptSlug: string | null, reuseEntryId?: string) {
    // Keyed off the slot's *resolved* current content (flatSlots), not off whether a local
    // WeekPlanOverride happens to exist — a git-planned static-week day has no override at
    // all, so keying off the override alone silently dropped exactly that case (a real bug
    // caught in review: swapping onto an unedited week-JSON day used to lose that meal
    // outright, contradicting the picker's own "the old meal becomes unplanned again"
    // promise). See resolveDisplacedOccupant's own doc comment.
    const currentSlot = flatSlots.find(s => s.date === date && s.kind === kind)
    const action = resolveDisplacedOccupant(pool.findBySlot(date, kind), {
      mealSlug: currentSlot?.mealSlug,
      receptSlug: currentSlot?.slug ?? null,
      filled: !!currentSlot?.label,
    })
    if (action.type === 'unslot-pool-entry') pool.setSlot(action.entryId, null)
    else if (action.type === 'create-pool-entry') pool.addEntry(action.mealSlug, action.receptSlug)

    const entryId = reuseEntryId ?? pool.addEntry(mealSlug, receptSlug)
    pool.setSlot(entryId, { date, kind })
    setMeal(date, kind, mealSlug, receptSlug)
    setPickerOpenFor(null)
  }

  function unslotSlot(date: string, kind: MealKind) {
    const occupant = pool.findBySlot(date, kind)
    clearOverride(date, kind)
    if (occupant) pool.setSlot(occupant.id, null)
    setExpandedSlot(null)
  }

  /**
   * Promotes a derived pool row (a git-planned week day, or any slot filled without going
   * through the pool — see PoolRow's own doc comment) to a real pool entry the moment the
   * user acts on it, per the 2026-08 "list-first" redesign's lazy-materialization fix
   * (docs/planera-list-first-2026-08.md, Problem 2). Returns the row's real id — either its
   * existing entry id (row.derived === false, a no-op) or the freshly created one.
   *
   * A derived row is always slotted (buildPoolRows only ever synthesizes one from a
   * FilledSlot), so materializing one also has to make that slot assignment durable, not just
   * the pool entry: writing the pool's own `slot` pointer alone isn't enough, because
   * `reconcilePoolEntries` only trusts a pointer that's backed by a real `WeekPlanOverride` —
   * a git-planned day has none (that's precisely what "derived" means), so the pointer would
   * be silently stripped again on the very next read. `setMeal` here writes an override with
   * the *same* mealSlug/receptSlug the day already (implicitly) shows, so nothing visibly
   * changes — it only makes the existing assignment explicit and durable.
   *
   * This deliberately does not attempt to make "✕ Avboka" (unslot) work for a still-derived
   * row — doing that would require a way to represent "explicitly cleared, still needs a
   * meal" distinct from both "no override" (shows the static file's dish again) and
   * attendance.skip ("no meal needed"), which needs a schema change (`DayOverride` currently
   * has no such field) touching `applyOverride`'s signature at every call site. The design
   * doc flags this exact gap as an open, unconfirmed question and this pass explicitly
   * doesn't touch Hub/VeckanOverview/WeekWarnings/FamiljView — so "Avboka" on a purely
   * git-planned day stays what it already was before this change (a no-op beyond closing the
   * detail panel), not a new duplicate-row bug.
   */
  function materializeRow(row: PoolRow): string {
    if (!row.derived) return row.id
    const id = pool.addEntry(row.mealSlug, row.receptSlug, { mealNamn: row.mealNamn })
    if (row.slot) {
      pool.setSlot(id, row.slot)
      setMeal(row.slot.date, row.slot.kind, row.mealSlug, row.receptSlug)
    }
    return id
  }

  function toggleRowDone(row: PoolRow) {
    pool.toggleDone(materializeRow(row))
  }

  function removeRow(row: PoolRow) {
    pool.removeEntry(materializeRow(row))
  }

  function addLeftover(row: PoolRow) {
    const sourceId = materializeRow(row)
    const newId = pool.addEntry(row.mealSlug, row.receptSlug, { resterAv: sourceId })
    if (row.slot) {
      const nextDate = addDays(row.slot.date, 1)
      setLeftoverHints(h => ({ ...h, [newId]: nextDate }))
    }
    setPickerOpenFor(newId)
  }

  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null)

  function renderAssign(key: string, namn: string, mealSlug: string, receptSlug: string | null, reuseEntryId?: string) {
    const { free, occupied } = buildSlotChips(key)
    return (
      <AssignControls
        key={key}
        namn={namn}
        isOpen={pickerOpenFor === key}
        onToggleOpen={() => setPickerOpenFor(o => (o === key ? null : key))}
        freeSlots={free}
        occupiedSlots={occupied}
        onPick={(date, kind) => assignToSlot(date, kind, mealSlug, receptSlug, reuseEntryId)}
        onAddUnslotted={reuseEntryId ? undefined : () => pool.addEntry(mealSlug, receptSlug)}
      />
    )
  }

  const [expandedSlot, setExpandedSlot] = useState<{ date: string; kind: MealKind } | null>(null)
  const [attendanceEditorOpen, setAttendanceEditorOpen] = useState(false)

  function openSlotDetail(date: string, kind: MealKind) {
    setExpandedSlot(prev => (prev?.date === date && prev?.kind === kind ? null : { date, kind }))
    setAttendanceEditorOpen(false)
  }

  const expandedInfo = expandedSlot ? flatSlots.find(s => s.date === expandedSlot.date && s.kind === expandedSlot.kind) : undefined

  const boardRows: BoardDayRow[] = useMemo(() => daySlots.map(d => {
    function toCell(s: SlotInfo): BoardCell {
      const glyphs: string[] = []
      if (!s.skip) {
        const presentEaters = s.presentIds ? eaters.filter(e => s.presentIds!.includes(e.id)) : eaters
        if (presentEaters.some(e => e.kost?.includes('vegan'))) glyphs.push('🌱')
        if (s.fast) glyphs.push('⚡')
        const { extra } = diffAttendance(s.planPresentIds, s.attendance)
        if (extra.length > 0) glyphs.push(`👪 +${extra.length}`)
      }
      const poolEntry = pool.entries.find(e => e.slot?.date === s.date && e.slot?.kind === s.kind)
      return { date: s.date, kind: s.kind, label: s.label, skip: s.skip, isLeftover: !!poolEntry?.resterAv, glyphs }
    }
    return {
      date: d.date,
      dayLabel: DAY_SHORT[d.dag] ?? d.dag,
      dateNum: dateNum(d.date),
      lunch: toCell(d.lunch),
      dinner: toCell(d.dinner),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [daySlots, eaters, pool.entries])

  const [mealQuery, setMealQuery] = useState('')
  const [editorState, setEditorState] = useState<
    { mode: 'closed' } | { mode: 'new'; prefill: string } | { mode: 'edit'; meal: Meal }
  >({ mode: 'closed' })
  const existingMealSlugs = useMemo(
    () => [...meals.map(m => m.slug), ...recipeIndex.map(r => r.slug)],
    [meals, recipeIndex],
  )
  // One search box across meals + recipes (2026-08 redesign item 4) — the mealMatches union
  // logic already covered both before this redesign, this just becomes the screen's one and
  // only add/search entry point instead of a second, separate box.
  const mealMatches = useMemo(() => {
    const needle = mealQuery.trim().toLowerCase()
    if (!needle) return []
    const mealHits = meals.filter(
      m => m.namn.toLowerCase().includes(needle) || m.alias.some(a => a.toLowerCase().includes(needle)),
    )
    const linkedReceptSlugs = new Set(meals.map(m => m.receptSlug).filter((s): s is string => !!s))
    // Baking/dessert recipes never surface here — this box exists to put something in a
    // lunch/middag slot (src/lib/recipeKind.ts). They're still findable in Receptbiblioteket.
    const recipeHits = filterPlannableRecipes(recipeIndex)
      .filter(r => r.namn.toLowerCase().includes(needle))
      .filter(r => !linkedReceptSlugs.has(r.slug) && !meals.some(m => m.slug === r.slug))
      .map(r => resolveMealForRecipe(r.slug, r.namn, meals))
    return [...mealHits, ...recipeHits].slice(0, 8)
  }, [mealQuery, meals, recipeIndex])
  const mealQueryExactMatch = useMemo(
    () =>
      matchMealByName(mealQuery, meals) ||
      // Same plannable filter as mealMatches above — otherwise typing a baking recipe's exact
      // name is a dead end: no hit (it's filtered out) and no "+ Skapa ny måltid" either.
      filterPlannableRecipes(recipeIndex).some(r => r.namn.trim().toLowerCase() === mealQuery.trim().toLowerCase()),
    [mealQuery, meals, recipeIndex],
  )

  const [browseQuery, setBrowseQuery] = useState('')
  const [browseFilter, setBrowseFilter] = useState<SuggestionFilter>('alla')
  const [browseSort, setBrowseSort] = useState<SuggestionSort>('match')
  const suggestions = rankSuggestions({
    recipeIndex, fullRecipes, meals, query: browseQuery, filter: browseFilter, sort: browseSort, eaters,
    presentPersonIds: null, offers: allOffers, getFeedback,
  })

  const fromOffers = useMemo(() => rankSuggestions({
    recipeIndex, fullRecipes, meals, query: '', filter: 'fynd', sort: 'savings', eaters,
    presentPersonIds: null, offers: foodOffers, getFeedback,
  }), [recipeIndex, fullRecipes, meals, eaters, foodOffers, getFeedback])

  const pantryMatches = useMemo(
    () => matchPantryRecipes(recipeIndex, fullRecipes, haveNames),
    [recipeIndex, fullRecipes, haveNames],
  )

  function toggleOffer(o: TaggedOffer) {
    if (isActiveForOffer(o.namn, o.store)) removeOrMarkForOffer(o.namn, o.store)
    else addOrRestoreByName(o.namn, { offerRef: { store: o.store, week: o.week } })
  }

  const freeSlotCount = useMemo(() => flatSlots.filter(s => !s.skip && !s.label).length, [flatSlots])

  return (
    <div className="planner">
      <div className="plan-cols">
        <div className="plan-supply">
          {/* The list is the top of the screen and owns the header (2026-08 "list-first"
              redesign, docs/planera-list-first-2026-08.md, Problem 3) — the budget line +
              definition replace the old always-visible standalone BudgetBar, and add/search
              sits directly beneath it, since building the list is the primary job. */}
          <div className="plan-list-card">
            <div className="plan-list-head-top">
              <span className="plan-list-title">Veckans måltider</span>
              <span className="plan-list-count">{budget.filled} av {budget.total} klara</span>
            </div>
            <div className="plan-list-def">allt vi behöver kunna laga den här veckan</div>
            <BudgetBar summary={budget} hideLabel />

            <div className="plan-search-row">
              <input
                className="tray-search"
                type="search"
                placeholder="Sök måltid eller recept…"
                value={mealQuery}
                onChange={e => setMealQuery(e.target.value)}
              />
              <button type="button" className="meal-add-new-btn" onClick={() => setEditorState({ mode: 'new', prefill: mealQuery.trim() })}>
                + Ny måltid
              </button>
            </div>

            {mealQuery.trim() && (
              <div className="meal-add-results">
                {mealMatches.map(m => {
                  const isRecipeOnly = !meals.some(x => x.slug === m.slug)
                  return (
                    <div key={m.slug} className="meal-chip">
                      <span className="meal-chip-name">
                        {m.namn}
                        {isRecipeOnly && <span className="meal-chip-kind">recept</span>}
                      </span>
                      <button type="button" className="meal-chip-edit" title="Redigera måltid" onClick={() => setEditorState({ mode: 'edit', meal: m })}>
                        ✎
                      </button>
                      {renderAssign(`search:${m.slug}`, m.namn, m.slug, m.receptSlug)}
                    </div>
                  )
                })}
                {mealMatches.length === 0 && <div className="tray-empty">Inga måltider eller recept matchar.</div>}
                {!mealQueryExactMatch && (
                  <button type="button" className="meal-add-create" onClick={() => setEditorState({ mode: 'new', prefill: mealQuery.trim() })}>
                    + Skapa ny måltid: "{mealQuery.trim()}"
                  </button>
                )}
              </div>
            )}

            <MealPoolList
              rows={poolRows}
              meals={meals}
              recipeIndex={recipeIndex}
              fullRecipes={fullRecipes}
              eaters={eaters}
              getFeedback={getFeedback}
              offers={allOffers}
              dayLabel={dayLabel}
              onOpenRecipe={onOpenRecipe}
              onToggleDone={toggleRowDone}
              onRemove={removeRow}
              onUnslot={unslotSlot}
              onAddLeftover={addLeftover}
              renderAssign={renderAssign}
            />
          </div>

          {/* The board, demoted to a secondary step (Problem 3): no strip above the list
              anymore — in portrait it lives below the list, collapsed by default; in
              landscape this whole block is hidden (see plan-board-portrait's media query),
              since the always-visible sticky column on the right already covers it. */}
          <div className="plan-board-portrait">
            <CollapsibleSection
              id="board"
              title="📅 Placera på dagar"
              defaultCollapsed
              hint={freeSlotCount > 0 ? `${freeSlotCount} platser lediga` : undefined}
            >
              <SlotBoard rows={boardRows} selected={expandedSlot} onSelectCell={openSlotDetail} />
            </CollapsibleSection>
          </div>

          {/* Deliberately a sibling of plan-board-portrait, not nested inside it — that
              wrapper is display:none in landscape (the sticky plan-board-col takes over), and
              a cell tap there still needs to open this somewhere visible. Left in the supply
              column rather than duplicated into plan-board-col: still reachable, and it keeps
              a single render path regardless of which board triggered it. */}
          {expandedSlot && expandedInfo && (() => {
            const { away, extra } = diffAttendance(expandedInfo.planPresentIds, expandedInfo.attendance)
            return (
              <SlotDetail
                kind={expandedSlot.kind}
                dayLabel={`${DAY_NAMES[expandedInfo.dag] ?? expandedInfo.dag} ${dateNum(expandedInfo.date)}`}
                label={expandedInfo.label}
                slug={expandedInfo.slug}
                meal={expandedInfo.meal}
                override={expandedInfo.override}
                attendance={expandedInfo.attendance}
                away={away}
                extra={extra}
                eaters={eaters}
                activePlanIds={expandedInfo.planPresentIds ?? []}
                fit={expandedInfo.fit}
                fast={expandedInfo.fast}
                haveNames={haveNames}
                attendanceOpen={attendanceEditorOpen}
                onOpenRecipe={onOpenRecipe}
                onClear={() => unslotSlot(expandedSlot.date, expandedSlot.kind)}
                onToggleAttendanceOpen={() => setAttendanceEditorOpen(o => !o)}
                onToggleAttendee={eaterId => {
                  const base = expandedInfo.attendance?.presentIds ?? expandedInfo.planPresentIds ?? []
                  const nextIds = base.includes(eaterId) ? base.filter(id => id !== eaterId) : [...base, eaterId]
                  setAttendance(expandedSlot.date, expandedSlot.kind, { presentIds: nextIds, skip: false, updatedAt: new Date().toISOString() })
                }}
                onToggleSkip={() => {
                  if (expandedInfo.attendance?.skip) clearAttendance(expandedSlot.date, expandedSlot.kind)
                  else setAttendance(expandedSlot.date, expandedSlot.kind, { presentIds: expandedInfo.attendance?.presentIds ?? null, skip: true, updatedAt: new Date().toISOString() })
                }}
                onResetAttendance={() => { clearAttendance(expandedSlot.date, expandedSlot.kind); setAttendanceEditorOpen(false) }}
                onSetFast={value => setFast(expandedSlot.date, expandedSlot.kind, value)}
                onComponentSwap={(vara, chosen) => setComponentSwap(expandedSlot.date, expandedSlot.kind, vara, chosen)}
                onShopComponents={() => {
                  if (!expandedInfo.meal || !expandedInfo.override) return
                  for (const c of resolveComponents(expandedInfo.meal, expandedInfo.override.komponentByten)) {
                    addOrRestoreByName(c.vara, { source: expandedInfo.meal.namn })
                  }
                }}
                onClose={() => setExpandedSlot(null)}
              />
            )
          })()}

          <OffersPanel
            offers={foodOffers}
            isActiveForOffer={isActiveForOffer}
            onToggleOffer={toggleOffer}
            fromOffers={fromOffers}
            meals={meals}
            onOpenRecipe={onOpenRecipe}
            renderAssign={renderAssign}
          />

          <CollapsibleSection
            id="pantry-match"
            title="Vad kan vi laga hemma?"
            defaultCollapsed
            hint={pantryMatches.length > 0 ? `${pantryMatches.length} rätter matchar skafferiet` : undefined}
          >
            {pantryMatches.length === 0 && <div className="fynd-empty">Inget matchar än — plocka in fynd eller råvaror i skafferiet.</div>}
            <div className="sugg-list">
              {pantryMatches.slice(0, 12).map(m => {
                const meal = resolveMealForRecipe(m.entry.slug, m.entry.namn, meals)
                return (
                  <div key={m.entry.slug} className="sugg-card">
                    {m.entry.bildUrl
                      ? <img className="sugg-card-img" src={m.entry.bildUrl} alt="" />
                      : <div className="sugg-card-img sugg-card-img--empty" />}
                    <div className="sugg-card-body">
                      <button type="button" className="sugg-card-name" onClick={() => onOpenRecipe(m.entry.slug)}>{m.entry.namn}</button>
                      <div className="sugg-card-tags">
                        <span className="tray-tag tray-tag--vegan">🧺 {m.matchedNames.join(', ')}</span>
                      </div>
                    </div>
                    {renderAssign(`pantry:${m.entry.slug}`, m.entry.namn, meal.slug, m.entry.slug)}
                  </div>
                )
              })}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="unlock"
            title="🔓 Ett köp bort"
            defaultCollapsed
            hint={unlockOpportunities[0] ? `${unlockOpportunities[0].ingredient} låser upp ${unlockOpportunities[0].recipes.length} rätter` : undefined}
          >
            {unlockOpportunities.length === 0 && <div className="tray-empty">Inga nära-kompletta rätter just nu.</div>}
            <div className="unlock-list">
              {unlockOpportunities.slice(0, 6).map(o => (
                <div className="unlock-chip" key={o.ingredient}>
                  <button type="button" className="unlock-chip-main" onClick={() => setExpandedUnlock(x => (x === o.ingredient ? null : o.ingredient))}>
                    <span className="unlock-chip-name">{o.ingredient}</span>
                    <span className="unlock-chip-count">→ {o.recipes.length} rätter</span>
                  </button>
                  <button
                    type="button"
                    className="unlock-chip-add"
                    onClick={() => addOrRestoreByName(o.ingredient)}
                    title="Lägg till på inköpslistan"
                    disabled={isActiveByName(o.ingredient)}
                  >
                    {isActiveByName(o.ingredient) ? '✓' : '+ handla'}
                  </button>
                </div>
              ))}
            </div>
            {expandedUnlock && (
              <div className="unlock-recipes">
                {unlockOpportunities.find(o => o.ingredient === expandedUnlock)?.recipes.map(r => (
                  <button key={r.slug} type="button" className="unlock-recipe-link" onClick={() => onOpenRecipe(r.slug)}>{r.namn}</button>
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection id="alla-recept" title="Alla recept" defaultCollapsed hint={`bläddra & filtrera · ${recipeIndex.length}`}>
            <div className="sugg-controls">
              <div className="sugg-filters">
                {FILTERS.map(f => (
                  <button key={f.id} type="button" className={`tray-fbtn${browseFilter === f.id ? ' on' : ''}`} onClick={() => setBrowseFilter(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="sugg-sorts">
                {SORTS.map(s => (
                  <button key={s.id} type="button" className={`sugg-sortbtn${browseSort === s.id ? ' on' : ''}`} onClick={() => setBrowseSort(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <input className="tray-search" type="search" placeholder="Sök recept…" value={browseQuery} onChange={e => setBrowseQuery(e.target.value)} />
            </div>
            <div className="sugg-list">
              {suggestions.map(s => (
                <div key={s.entry.slug} className={`sugg-card${s.excluded ? ' excluded' : ''}`}>
                  {s.entry.bildUrl
                    ? <img className="sugg-card-img" src={s.entry.bildUrl} alt="" />
                    : <div className="sugg-card-img sugg-card-img--empty" />}
                  <div className="sugg-card-body">
                    <button type="button" className="sugg-card-name" onClick={() => onOpenRecipe(s.entry.slug)}>{s.entry.namn}</button>
                    <div className="sugg-card-tags">
                      {s.tags.map((t, i) => <span key={i} className={`tray-tag tray-tag--${t.kind}`}>{t.text}</span>)}
                    </div>
                  </div>
                  {renderAssign(`browse:${s.entry.slug}`, s.entry.namn, resolveMealForRecipe(s.entry.slug, s.entry.namn, meals).slug, s.entry.slug)}
                </div>
              ))}
              {suggestions.length === 0 && <div className="tray-empty">Inga recept matchar.</div>}
            </div>
          </CollapsibleSection>
        </div>

        <div className="plan-board-col">
          <div className="plan-board-step">Steg 2 · placera på dagar</div>
          <SlotBoard rows={boardRows} selected={expandedSlot} onSelectCell={openSlotDetail} />
        </div>
      </div>

      {editorState.mode !== 'closed' && (
        <MealEditorModal
          meal={editorState.mode === 'edit' ? editorState.meal : null}
          initialName={editorState.mode === 'new' ? editorState.prefill : undefined}
          recipeIndex={recipeIndex}
          existingSlugs={existingMealSlugs}
          onSave={m => {
            upsertMeal(m)
            // Saving a new meal from Planera's search puts it straight into this week's
            // pool, unslotted — the picker (already visible on its new pool row) is the one
            // assignment mechanism, so there's no separate "save & assign to today" shortcut
            // anymore (there's no "today" selection left to assign to).
            if (editorState.mode === 'new') pool.addEntry(m.slug, m.receptSlug)
            setEditorState({ mode: 'closed' })
            setMealQuery('')
          }}
          onClose={() => setEditorState({ mode: 'closed' })}
        />
      )}
    </div>
  )
}
