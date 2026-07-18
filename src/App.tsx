import { useState, useEffect } from 'react'
import { WeekMenu, EatersData, RecipeIndex, RecipeIndexEntry, DayMeal, WeekNote, ScreenName } from './types'
import type { HistoryEntry, HistoryFile } from './types/history'
import type { FeedbackFile, FeedbackStore } from './types/feedback'
import type { TaskLogFile } from './types/taskLog'
import Hub from './components/Hub'
import VeckanView from './components/views/VeckanView'
import HandlaView from './components/views/HandlaView'
import ReceptView from './components/views/ReceptView'
import FamiljView from './components/views/FamiljView'
import AnteckningarView from './components/views/AnteckningarView'
import FyndView from './components/views/FyndView'
import BevakaView from './components/views/BevakaView'
import SkafferiView from './components/views/SkafferiView'
import HistorikView from './components/views/HistorikView'
import SynkaView from './components/views/SynkaView'
import RecipeOverlay from './components/RecipeOverlay'
import FloatingNav from './components/FloatingNav'
import { resolvePresenceRange, addDays } from './presence/resolver'
import { SEED_STORE } from './presence/seed'
import type { DayPlan } from './presence/types'
import { mergeFeedbackBaseline } from './hooks/useFeedback'
import { pruneSyncTasks } from './hooks/useSyncTasks'
import { applyTaskOutcome } from './lib/syncTaskOutcomes'
import { hydrateFromSync } from './lib/syncHydration'
import { startSyncPusher, seedKnownSha } from './lib/syncPusher'

function getISOWeekString(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function dagFromDate(isoDate: string): string {
  const names = ['sondag', 'mandag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lordag']
  return names[new Date(isoDate + 'T00:00:00Z').getUTCDay()]
}

export default function App() {
  const [rollingDays, setRollingDays] = useState<DayMeal[]>([])
  const [rollingLunches, setRollingLunches] = useState<DayMeal[]>([])
  const [weekNotes, setWeekNotes] = useState<WeekNote[]>([])
  const [weekLabel, setWeekLabel] = useState('')
  const [eaters, setEaters] = useState<EatersData | null>(null)
  const [recipeIndex, setRecipeIndex] = useState<RecipeIndexEntry[]>([])
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([])
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [screen, setScreen] = useState<ScreenName>('hub')
  const [screenHistory, setScreenHistory] = useState<ScreenName[]>([])
  const [overlaySlug, setOverlaySlug] = useState<string | null>(null)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const windowDates = Array.from({ length: 7 }, (_, i) => addDays(today, i))
    const weeksNeeded = [...new Set(windowDates.map(getISOWeekString))]

    const weekFetches = weeksNeeded.map(w =>
      fetch(`/matracet/data/weeks/${w}.json`)
        .then(r => r.ok ? r.json() as Promise<WeekMenu> : null)
        .catch(() => null),
    )

    Promise.all([
      fetch('/matracet/data/eaters.json').then(r => r.json()),
      fetch('/matracet/data/recipes/_index.json').then(r => r.json()),
      fetch('/matracet/data/history.json').then(r => r.ok ? r.json() as Promise<HistoryFile> : null).catch(() => null),
      fetch('/matracet/data/feedback.json').then(r => r.ok ? r.json() as Promise<FeedbackFile> : null).catch(() => null),
      fetch('/matracet/data/task-log.json').then(r => r.ok ? r.json() as Promise<TaskLogFile> : null).catch(() => null),
      ...weekFetches,
    ]).then(([eatersData, indexData, historyData, feedbackData, taskLogData, ...weekResults]: [EatersData, RecipeIndex, HistoryFile | null, FeedbackFile | null, TaskLogFile | null, ...(WeekMenu | null)[]]) => {
      setEaters(eatersData)
      setRecipeIndex(indexData.recipes)
      setHistoryEntries(historyData?.entries ?? [])
      // Tolerant unwrap — mirrors scripts/build-brief.ts's handling of this same file,
      // in case it's ever a bare feedback map instead of the { feedback: {...} } wrapper.
      const feedbackBaseline = feedbackData?.feedback ?? (feedbackData as unknown as FeedbackStore | null)
      if (feedbackBaseline) mergeFeedbackBaseline(feedbackBaseline)

      // Sync task acknowledgment (see CLAUDE.md's "GitHub-backed auto-sync" Phase 5) — like
      // the feedback baseline above, task-log.json is a static git-tracked file every device
      // fetches directly, not something routed through device-sync.
      if (taskLogData?.entries?.length) {
        for (const entry of taskLogData.entries) applyTaskOutcome(entry)
        pruneSyncTasks(new Set(taskLogData.entries.map(e => e.id)))
      }

      const dayMap = new Map<string, DayMeal>()
      const lunchMap = new Map<string, DayMeal>()
      for (const weekData of weekResults) {
        if (weekData) {
          for (const day of weekData.middagar) dayMap.set(day.datum, day)
          for (const lunch of weekData.luncher ?? []) lunchMap.set(lunch.datum, lunch)
        }
      }

      const days = windowDates.map(date =>
        dayMap.get(date) ?? { dag: dagFromDate(date), datum: date, recept: null },
      )
      setRollingDays(days)

      const lunches = windowDates.map(date =>
        lunchMap.get(date) ?? { dag: dagFromDate(date), datum: date, recept: null },
      )
      setRollingLunches(lunches)

      const primaryWeek = weekResults[0]
      setWeekNotes(primaryWeek?.anteckningar ?? [])

      const todayWeek = getISOWeekString(today)
      const todayDate = new Date(today + 'T00:00:00Z')
      const month = todayDate.toLocaleDateString('sv-SE', { month: 'long' })
      const [year, isoWeek] = todayWeek.split('-W')
      setWeekLabel(`${month.charAt(0).toUpperCase() + month.slice(1)} ${year} · Vecka ${isoWeek}`)

      setDayPlans(resolvePresenceRange(today, addDays(today, 6), SEED_STORE))
    })
  }, [])

  // GitHub-sync hydration (see CLAUDE.md's "GitHub-backed auto-sync" section) — a fully
  // independent effect on purpose: it never sets any state the loading gate below depends
  // on, so a slow or failing device-sync fetch can't add a second way for "Laddar…" to spin
  // forever. No token → hydrateFromSync resolves immediately with zero network calls.
  useEffect(() => {
    hydrateFromSync().then(outcome => {
      if (outcome.status === 'applied') {
        console.info('[matracet sync] hydrated from device-sync', outcome.decisions)
      } else if (outcome.status === 'error') {
        console.warn('[matracet sync] hydration failed:', outcome.reason)
      }
      // Hand the already-fetched state to the pusher so its first push this session doesn't
      // pay for a second, redundant discovery-and-merge fetch, and so its "skip a no-op
      // push" guard is warm from boot (see seedKnownSha's own doc).
      if (outcome.sha !== undefined) seedKnownSha(outcome.sha, outcome.storesKey)
    })
  }, [])

  // Auto-push (see CLAUDE.md's "GitHub-backed auto-sync" section) — independent of both
  // effects above for the same reason hydration is: it must never block app boot. No token
  // stored → every push attempt no-ops with zero network calls (pushState's own guard).
  useEffect(() => startSyncPusher(), [])

  if (!eaters || rollingDays.length === 0) {
    return <div className="app-loading">Laddar…</div>
  }

  function navigate(next: ScreenName) {
    if (next === screen) return
    if (next === 'hub') {
      setScreenHistory([])
      setScreen('hub')
      return
    }
    setScreenHistory(prev => [...prev, screen])
    setScreen(next)
  }

  const toHub = () => navigate('hub')

  function goBack() {
    setScreenHistory(prev => {
      if (prev.length === 0) {
        setScreen('hub')
        return prev
      }
      const next = [...prev]
      const last = next.pop() as ScreenName
      setScreen(last)
      return next
    })
  }

  return (
    <div className="app-shell">
      {screen === 'hub' && (
        <Hub
          weekLabel={weekLabel}
          rollingDays={rollingDays}
          recipeIndex={recipeIndex}
          dayPlans={dayPlans}
          onNavigate={navigate}
          onOpenRecipe={setOverlaySlug}
        />
      )}
      {screen === 'veckan' && (
        <VeckanView
          onBack={toHub}
          weekLabel={weekLabel}
          rollingDays={rollingDays}
          rollingLunches={rollingLunches}
          dayPlans={dayPlans}
          eaters={eaters.eaters}
          recipeIndex={recipeIndex}
          onOpenRecipe={setOverlaySlug}
        />
      )}
      {screen === 'handla' && <HandlaView onBack={toHub} />}
      {screen === 'recept' && (
        <ReceptView onBack={toHub} recipeIndex={recipeIndex} eaters={eaters.eaters} onOpenRecipe={setOverlaySlug} />
      )}
      {screen === 'familj' && (
        <FamiljView
          onBack={toHub}
          eaters={eaters.eaters}
          dayPlans={dayPlans}
          rollingDays={rollingDays}
          rollingLunches={rollingLunches}
        />
      )}
      {screen === 'anteckningar' && (
        <AnteckningarView onBack={toHub} weekNotes={weekNotes} />
      )}
      {screen === 'fynd' && <FyndView onBack={toHub} />}
      {screen === 'bevaka' && <BevakaView onBack={toHub} />}
      {screen === 'skafferi' && (
        <SkafferiView onBack={toHub} recipeIndex={recipeIndex} eaters={eaters.eaters} onOpenRecipe={setOverlaySlug} />
      )}
      {screen === 'historik' && (
        <HistorikView
          onBack={toHub}
          entries={historyEntries}
          eaters={eaters.eaters}
          recipeIndex={recipeIndex}
          onOpenRecipe={setOverlaySlug}
        />
      )}
      {screen === 'synka' && <SynkaView onBack={toHub} />}

      {screen !== 'hub' && !overlaySlug && (
        <FloatingNav
          currentScreen={screen}
          hasHistory={screenHistory.length > 0}
          onBack={goBack}
          onHub={toHub}
          onNavigate={navigate}
        />
      )}

      {overlaySlug && (
        <RecipeOverlay slug={overlaySlug} onClose={() => setOverlaySlug(null)} />
      )}
    </div>
  )
}
