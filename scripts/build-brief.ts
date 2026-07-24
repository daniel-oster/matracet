/**
 * build-brief — deterministisk datafogning för veckoplanering.
 *
 * Löser ut den KOMMANDE veckan och skriver planning-brief.json. Allt underlag
 * härleds enbart från committad git-data (public/data) plus närvaro-/preferens-
 * modellen i src/. Ingen LLM, inga nätverksanrop, ingen säsongslogik, ingen
 * slump — samma referensdatum in ger byte-identisk brief ut.
 *
 * Kör:  npm run brief            (referensdatum = idag)
 *       npx tsx scripts/build-brief.ts 2026-06-19              (valfritt datum)
 *       npx tsx scripts/build-brief.ts 2026-06-19 out.json     (valfri utfil)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { resolvePresence } from '../src/presence/resolver.ts'
import { SEED_STORE, PERSONS } from '../src/presence/seed.ts'
import { matchMealByName } from '../src/lib/mealResolve.ts'
import type { Meal, MealsFile } from '../src/types/meal.ts'

/** Derive vegan status from a recipe's kategorier array — true = marked vegansk,
 *  false = marked vegetarisk/kott/fisk, undefined = can't tell (warn softly).
 *  Ported from the deleted src/meals/checks.ts (see CLAUDE.md's "Meals as the
 *  plannable unit" section, Stage 0) — this one pure helper was still needed here. */
function getRecipeVegan(kategorier: string[]): boolean | undefined {
  if (kategorier.includes('vegansk')) return true
  if (kategorier.some(k => ['vegetarisk', 'kott', 'fisk'].includes(k))) return false
  return undefined
}

// ── Konfiguration ───────────────────────────────────────────────────────────────

/** Tak för hur många middagar per vecka som får dela proteinkategori. null = ingen
 *  gräns (planeraren bryr sig inte om proteinupprepning). Den verkliga, datadrivna
 *  variationsregeln är per-person `minRepeatGapDays` (se constraints.spacingByPerson). */
const MAX_REPEAT_PROTEIN_PER_WEEK: number | null = null

const SCHEMA_VERSION = '1.3'

// ── Datum-helpers (UTC, ISO-vecka) ──────────────────────────────────────────────

const WEEKDAY_SV = ['', 'mandag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lordag', 'sondag']

function utc(isoDate: string): Date {
  return new Date(isoDate + 'T00:00:00Z')
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(isoDate: string, n: number): string {
  const d = utc(isoDate)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}

function isoWeekday(isoDate: string): number {
  const dow = utc(isoDate).getUTCDay()
  return dow === 0 ? 7 : dow
}

/** Måndagen som inleder ISO-veckan för isoDate. */
function isoWeekMonday(isoDate: string): string {
  return addDays(isoDate, -(isoWeekday(isoDate) - 1))
}

/** { isoWeek: "2026-W26", year, week } för en given måndag. */
function isoWeekParts(monday: string): { isoWeek: string; year: number; week: number } {
  // ISO-veckonummer: torsdagen i veckan bestämmer årtalet.
  const thursday = addDays(monday, 3)
  const t = utc(thursday)
  const year = t.getUTCFullYear()
  const jan1 = utc(`${year}-01-01`)
  const week = Math.ceil(((t.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return { isoWeek: `${year}-W${String(week).padStart(2, '0')}`, year, week }
}

// ── Data-inläsning ──────────────────────────────────────────────────────────────

const root = process.cwd()

function readJson<T>(relPath: string): T | null {
  const abs = resolve(root, relPath)
  if (!existsSync(abs)) return null
  return JSON.parse(readFileSync(abs, 'utf-8')) as T
}

interface IndexEntry {
  slug: string
  nummer: number
  namn: string
  tid_min: number
  kategorier: string[]
  bildUrl?: string
}

interface WeekDay {
  dag: string
  datum: string
  recept: string | null
  receptSlug?: string
  kommentar?: string
  anteckning?: string
}

interface WeekFile {
  vecka: string
  middagar: WeekDay[]
}

interface Pantry {
  always_have: string[]
}

const recipeIndex = (readJson<{ recipes: IndexEntry[] }>('public/data/recipes/_index.json')?.recipes) ?? []
const pantry = readJson<Pantry>('public/data/pantry.json')
const eatersData = readJson<{ eaters: { id: string; kost?: string[] }[] }>('public/data/eaters.json')
const mealLibrary = readJson<MealsFile>('public/data/meals.json')?.meals ?? []

const indexBySlug = new Map(recipeIndex.map(r => [r.slug, r]))
// present[]/portioner already derive person-level facts from src/presence/seed.ts (custody);
// this is the equivalent derivation for diet — Eater.kost is the live source of truth, not the
// deleted Side B SEED_PREFERENCES (see CLAUDE.md's "Meals as the plannable unit" section).
const veganEaterIds = new Set((eatersData?.eaters ?? []).filter(e => e.kost?.includes('vegan')).map(e => e.id))

// ── Feedback (sentiment + uteslutningar) ────────────────────────────────────────
// Detta är den enda datakällan som lever utanför git: appens localStorage. Den
// exporteras via "Ladda ner mina data" och committas som public/data/feedback.json.
// Filen är antingen hela export-payloaden ({ feedback: {...} }) eller en bar store.

interface PersonSentiment {
  personId: string
  sentiment: 'likes' | 'dislikes' | 'refuses'
  note?: string
}
interface FeedbackRecord {
  persons?: PersonSentiment[]
  excludeFromWeekPlan?: boolean
}
type FeedbackStore = Record<string, FeedbackRecord>

const feedbackRaw = readJson<{ feedback?: FeedbackStore } & FeedbackStore>('public/data/feedback.json')
const feedbackStore: FeedbackStore = feedbackRaw?.feedback ?? (feedbackRaw as FeedbackStore) ?? {}
// Drop the export wrapper keys if a bare-ish payload slipped through.
const feedbackRecords: FeedbackStore = Object.fromEntries(
  Object.entries(feedbackStore).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v)),
)
const feedbackCount = Object.keys(feedbackRecords).length

/** Per-recipe sentiment as recorded per person, or null when nobody has rated it. */
function sentimentFor(slug: string): PersonSentiment[] | null {
  const persons = feedbackRecords[slug]?.persons
  return persons && persons.length > 0
    ? persons.map(p => ({ personId: p.personId, sentiment: p.sentiment, ...(p.note ? { note: p.note } : {}) }))
    : null
}

const exclusions = Object.entries(feedbackRecords)
  .filter(([, r]) => r.excludeFromWeekPlan === true)
  .map(([slug]) => slug)

// ── Härledning ──────────────────────────────────────────────────────────────────

/** Härled "protein"-klass ur kategorier — det finns inget eget proteinfält.
 *  Prioritet: kott > fisk > vegansk > vegetarisk. */
function deriveProtein(kategorier: string[]): string {
  if (kategorier.includes('kott')) return 'kott'
  if (kategorier.includes('fisk')) return 'fisk'
  if (kategorier.includes('vegansk')) return 'vegansk'
  if (kategorier.includes('vegetarisk')) return 'vegetarisk'
  return 'okant'
}

/** veganRequired = sant om någon med kost:"vegan" (eaters.json) är hemma denna dag. */
function veganRequiredFor(presentIds: Set<string>): boolean {
  return [...veganEaterIds].some(id => presentIds.has(id))
}

// ── Bygg veckan ─────────────────────────────────────────────────────────────────

const referenceDate = process.argv[2] ?? iso(new Date())
const outPath = process.argv[3] ?? 'planning-brief.json'

// KOMMANDE vecka = nästa ISO-veckas måndag relativt referensdatumet.
const upcomingMonday = addDays(isoWeekMonday(referenceDate), 7)
const weekParts = isoWeekParts(upcomingMonday)

const days = Array.from({ length: 7 }, (_, i) => {
  const date = addDays(upcomingMonday, i)
  const plan = resolvePresence(date, SEED_STORE)
  const presentIds = new Set(plan.presentPersons.map(p => p.id))

  const notes: string[] = []
  if (plan.windowStatus === 'BOUNDED' && plan.windowEndsBy) {
    notes.push(`Middag senast ${plan.windowEndsBy}`)
  } else if (plan.windowStatus === 'CONFLICT' && plan.eatEarlyBy) {
    notes.push(`Trångt middagsfönster — ät senast ${plan.eatEarlyBy}`)
  }
  notes.push(...plan.windowNotes)

  return {
    date,
    weekday: WEEKDAY_SV[isoWeekday(date)],
    weekdayIso: isoWeekday(date),
    present: plan.presentPersons.map(p => ({ id: p.id, name: p.name })),
    portions: plan.portions,
    veganRequired: veganRequiredFor(presentIds),
    notes,
  }
})

// ── Senaste historik (1–2 föregående ISO-veckor + matdagbok.json) ──────────────
// Två källor: de planerade veckofilerna (vad som stod i matsedeln) och
// history.json (vad som faktiskt loggats som ätet — särskilt spontana/oplanerade
// måltider under t.ex. kaosveckor, som aldrig syns i weeks/*.json alls).

interface HistoryEntry {
  date: string
  recipeId: string
  title: string
  protein: string
  cuisine: null
  sentiment: PersonSentiment[] | null
  source: 'planerat' | 'spontant'
}

interface HistoryFile {
  entries: {
    datum: string
    recipeSlug: string | null
    mealSlug?: string
    beskrivning: string
    kalla: 'planerat' | 'spontant'
  }[]
}

const recentHistory: HistoryEntry[] = []
for (const back of [2, 1]) {
  const monday = addDays(upcomingMonday, -7 * back)
  const label = isoWeekParts(monday).isoWeek
  const wf = readJson<WeekFile>(`public/data/weeks/${label}.json`)
  if (!wf) continue
  for (const m of wf.middagar) {
    if (!m.receptSlug) continue // hoppa över bortakvällar / fri text utan recept
    const idx = indexBySlug.get(m.receptSlug)
    recentHistory.push({
      date: m.datum,
      recipeId: m.receptSlug,
      title: m.recept ?? idx?.namn ?? m.receptSlug,
      protein: idx ? deriveProtein(idx.kategorier) : 'okant',
      cuisine: null, // spåras inte i datamodellen
      sentiment: sentimentFor(m.receptSlug),
      source: 'planerat',
    })
  }
}

// history.json — bara loggade måltider inom samma tvåveckorsfönster, och bara
// de som länkats till ett riktigt recept (annars finns inget att härleda protein/sentiment ur).
const historyWindowStart = addDays(upcomingMonday, -14)
const historyFile = readJson<HistoryFile>('public/data/history.json')
for (const e of historyFile?.entries ?? []) {
  if (!e.recipeSlug || e.datum < historyWindowStart || e.datum >= upcomingMonday) continue
  const idx = indexBySlug.get(e.recipeSlug)
  recentHistory.push({
    date: e.datum,
    recipeId: e.recipeSlug,
    title: e.beskrivning || idx?.namn || e.recipeSlug,
    protein: idx ? deriveProtein(idx.kategorier) : 'okant',
    cuisine: null,
    sentiment: sentimentFor(e.recipeSlug),
    source: e.kalla,
  })
}

recentHistory.sort((a, b) => (a.date < b.date ? -1 : 1))

// ── Måltidsbiblioteket (meals.json) + härledd frekvens ur hela history.json ────
// antalGånger/senastÄten är medvetet inte fält i meals.json (se CLAUDE.md) — härleds
// här ur *hela* history.json (inte bara recentHistory's tvåveckorsfönster ovan), så
// frekvensen är en genuin livstidssiffra, inte "hur ofta senaste två veckorna".
function matchesHistoryEntry(meal: Meal, e: HistoryFile['entries'][number]): boolean {
  if (e.mealSlug) return e.mealSlug === meal.slug
  if (e.recipeSlug && meal.receptSlug === e.recipeSlug) return true
  return matchMealByName(e.beskrivning, [meal]) !== undefined
}

const mealLibrarySlim = mealLibrary.map(meal => {
  const matches = (historyFile?.entries ?? []).filter(e => matchesHistoryEntry(meal, e))
  const senastAten = matches.length > 0 ? matches.map(e => e.datum).sort().at(-1)! : null
  return {
    slug: meal.slug,
    namn: meal.namn,
    receptSlug: meal.receptSlug,
    taggar: meal.taggar,
    antalGanger: matches.length,
    senastAten,
  }
})

// ── Slimmat receptregister ──────────────────────────────────────────────────────

const recipeIndexSlim = recipeIndex.map(r => ({
  id: r.slug,
  title: r.namn,
  protein: deriveProtein(r.kategorier),
  vegan: getRecipeVegan(r.kategorier) === true,
  sentiment: sentimentFor(r.slug),
  tags: r.kategorier, // _index.json bär bara kategorier; fria `taggar` finns i fulla receptfiler
}))

// ── Sätt ihop briefen ───────────────────────────────────────────────────────────

const brief = {
  schemaVersion: SCHEMA_VERSION,
  week: {
    isoWeek: weekParts.isoWeek,
    year: weekParts.year,
    startDate: upcomingMonday,
  },
  days,
  constraints: {
    // Recept som ska uteslutas ur planen — härlett ur feedback.json (excludeFromWeekPlan).
    exclusions,
    // null = ingen proteinupprepningsgräns (per användarens val).
    maxRepeatProteinPerWeek: MAX_REPEAT_PROTEIN_PER_WEEK,
    // Verklig, datadriven spacing-regel per person (Person.minRepeatGapDays).
    spacingByPerson: PERSONS.map(p => ({
      personId: p.id,
      minRepeatGapDays: p.minRepeatGapDays ?? 0,
    })),
  },
  recentHistory,
  recipeIndex: recipeIndexSlim,
  mealLibrary: mealLibrarySlim,
  pantryStaples: pantry?.always_have ?? [],
  meta: {
    referenceDate,
    generatedBy: 'scripts/build-brief.ts',
    sources: [
      'public/data/recipes/_index.json',
      'public/data/meals.json (måltidsbibliotek; antalGånger/senastÄten härlett ur hela history.json)',
      'public/data/weeks/*.json',
      'public/data/history.json (spontana/oplanerade måltider, senaste 2 veckorna + all-tid för mealLibrary-frekvens)',
      'public/data/pantry.json',
      'public/data/feedback.json (sentiment + uteslutningar)',
      'public/data/eaters.json (kost: vegan → veganRequired)',
      'src/presence/seed.ts + activities.ts (närvaro/vårdnadsschema)',
    ],
    // Den enda inmatningen som inte lever i git: appens localStorage, exporterad och committad.
    externalInputs: [
      feedbackCount > 0
        ? `feedback.json: ${feedbackCount} recept importerade → sentiment och exclusions ifyllda.`
        : 'feedback.json är tom — exportera "Ladda ner mina data" i appen och committa för att fylla sentiment + exclusions.',
    ],
    assumptions: [
      'present[] och portioner härleds helt ur vårdnadsschemat (src/presence/seed.ts): barn=3, Daniel+Erika=2, Daniel ensam=1. Varje dag har en bestämd uppsättning — inga okända dagar.',
      'protein härleds ur recept-kategorier (kott>fisk>vegansk>vegetarisk); inget eget proteinfält finns.',
      'veganRequired = sant när en person med kost:"vegan" (eaters.json) är hemma (presence-gated).',
      'mealLibrary.antalGanger/senastAten är beräknade, inte hand-underhållna fält i meals.json — se matchesHistoryEntry.',
      'recipeIndex.tags = kategorier (slimmade indexet bär inte de fria taggarna).',
      'maxRepeatProteinPerWeek = null (ingen gräns, per användarens val).',
    ],
    // Fält som varken finns i git-datan eller i localStorage-exporten.
    notTracked: [
      'cuisine: det finns inget kök-/cuisine-fält i datamodellen → null. Säg till om du vill att jag lägger till det per recept.',
    ],
  },
}

writeFileSync(resolve(root, outPath), JSON.stringify(brief, null, 2) + '\n', 'utf-8')

console.log(`planning-brief skriven: ${outPath}`)
console.log(`  kommande vecka : ${brief.week.isoWeek} (start ${brief.week.startDate}, ref ${referenceDate})`)
console.log(`  dagar          : ${days.length}  ·  recept i register: ${recipeIndexSlim.length}  ·  måltider i bibliotek: ${mealLibrarySlim.length}`)
console.log(`  historik       : ${recentHistory.length} middagar  ·  pantryStaples: ${brief.pantryStaples.length}`)
