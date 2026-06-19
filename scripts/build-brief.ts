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
import { SEED_PREFERENCES } from '../src/meals/seed.ts'
import { getRecipeVegan } from '../src/meals/checks.ts'

// ── Konfigurerade antaganden (inte härledda ur data) ────────────────────────────

/** Standardtak som planeringssteget kan respektera. Det finns INGEN sådan siffra
 *  i datan — den närmaste verkliga regeln är per-person `minRepeatGapDays`. Värdet
 *  exponeras som en justerbar knapp och listas under meta.assumptions. */
const MAX_REPEAT_PROTEIN_PER_WEEK = 2

const SCHEMA_VERSION = '1.0'

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

const indexBySlug = new Map(recipeIndex.map(r => [r.slug, r]))

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

/** REQUIRE_VEGAN-preferenser är presence-gated. veganRequired = sant om någon
 *  som kräver veganskt är hemma denna dag. */
function veganRequiredFor(presentIds: Set<string>): boolean {
  return SEED_PREFERENCES.some(
    p =>
      p.rule.type === 'REQUIRE_VEGAN' &&
      p.origin === 'PERSON' &&
      p.personId !== null &&
      presentIds.has(p.personId),
  )
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
  if (plan.presentPersons.length === 0) {
    notes.push(
      'Ingen vårdnadsregel träffar denna dag — närvaro ej modellerad i presence-datan ' +
        '(t.ex. Erika-helger saknas). Sätt en Override eller fyll i manuellt.',
    )
  } else {
    if (plan.windowStatus === 'BOUNDED' && plan.windowEndsBy) {
      notes.push(`Middag senast ${plan.windowEndsBy}`)
    } else if (plan.windowStatus === 'CONFLICT' && plan.eatEarlyBy) {
      notes.push(`Trångt middagsfönster — ät senast ${plan.eatEarlyBy}`)
    }
    notes.push(...plan.windowNotes)
  }

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

// ── Senaste historik (1–2 föregående ISO-veckor) ────────────────────────────────

interface HistoryEntry {
  date: string
  recipeId: string
  title: string
  protein: string
  cuisine: null
  sentiment: null
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
      cuisine: null, // finns inte i datan
      sentiment: null, // finns bara i localStorage (matracet:feedback:v1), ej committad
    })
  }
}
recentHistory.sort((a, b) => (a.date < b.date ? -1 : 1))

// ── Slimmat receptregister ──────────────────────────────────────────────────────

const recipeIndexSlim = recipeIndex.map(r => ({
  id: r.slug,
  title: r.namn,
  protein: deriveProtein(r.kategorier),
  vegan: getRecipeVegan(r.kategorier) === true,
  sentiment: null, // finns bara i localStorage, ej committad
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
    // Recept som ska uteslutas ur planen. Källan (excludeFromWeekPlan) lever bara
    // i localStorage och är inte committad → tom här. Se meta.dataGaps.
    exclusions: [] as string[],
    maxRepeatProteinPerWeek: MAX_REPEAT_PROTEIN_PER_WEEK,
    // Verklig, datadriven spacing-regel per person (Person.minRepeatGapDays).
    spacingByPerson: PERSONS.map(p => ({
      personId: p.id,
      minRepeatGapDays: p.minRepeatGapDays ?? 0,
    })),
  },
  recentHistory,
  recipeIndex: recipeIndexSlim,
  pantryStaples: pantry?.always_have ?? [],
  meta: {
    referenceDate,
    generatedBy: 'scripts/build-brief.ts',
    sources: [
      'public/data/recipes/_index.json',
      'public/data/weeks/*.json',
      'public/data/pantry.json',
      'src/presence/seed.ts + activities.ts (närvaro/vårdnadsschema)',
      'src/meals/seed.ts (preferenser: REQUIRE_VEGAN)',
    ],
    assumptions: [
      `maxRepeatProteinPerWeek=${MAX_REPEAT_PROTEIN_PER_WEEK} är en konfigurerad standard, inte härledd ur data.`,
      'protein härleds ur recept-kategorier (kott>fisk>vegansk>vegetarisk); inget eget proteinfält finns.',
      'veganRequired = sant när en person med HARD REQUIRE_VEGAN är hemma (presence-gated).',
      'recipeIndex.tags = kategorier (slimmade indexet bär inte de fria taggarna).',
    ],
    dataGaps: [
      'sentiment: finns endast i localStorage (matracet:feedback:v1) — inte committad, satt till null.',
      'constraints.exclusions: excludeFromWeekPlan finns bara i localStorage — inte committad, tom lista.',
      'cuisine: inget kök-/cuisine-fält finns i datamodellen — satt till null.',
      'närvaro icke-vårdnadsdagar (t.ex. Erika-helger): presence-modellen saknar regler, dagar utan träff får tom present[].',
    ],
  },
}

writeFileSync(resolve(root, outPath), JSON.stringify(brief, null, 2) + '\n', 'utf-8')

console.log(`planning-brief skriven: ${outPath}`)
console.log(`  kommande vecka : ${brief.week.isoWeek} (start ${brief.week.startDate}, ref ${referenceDate})`)
console.log(`  dagar          : ${days.length}  ·  recept i register: ${recipeIndexSlim.length}`)
console.log(`  historik       : ${recentHistory.length} middagar  ·  pantryStaples: ${brief.pantryStaples.length}`)
