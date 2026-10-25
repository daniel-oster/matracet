/**
 * verify-schedule — skyddsnät för det privata schemat (daniel-oster/livet-data).
 *
 *   npx tsx scripts/verify-schedule.ts <livet-data-dir>                  # kontrollera
 *   npx tsx scripts/verify-schedule.ts <livet-data-dir> --update-golden  # skriv om golden-filen
 *
 * 1. Strukturkontroll av data/schema.json, perioder.json, handelser.json och attgora.json
 *    (src/presence/validate.ts, src/laget/validate.ts) — Claude skriver de två sista från fritext.
 * 2. Golden: data/schema.golden.json håller hur varje dag FRAM TILL golden-filens slutdatum
 *    löstes ut (grupp, ätfönster, portioner). Regler följer "duplicera, skriv inte om"
 *    (se CLAUDE.md om "duplicate-don.t-rewrite"), så en ändring som flyttar en redan
 *    passerad dag är nästan alltid ett misstag – i datan eller i resolvern. Golden är en
 *    ögonblicksbild, inte ett facit: den fångar att något *ändrats*, inte att det var rätt.
 *    Skriv om den med --update-golden först när ändringen av ett förflutet datum är avsiktlig.
 *    --update-golden sätter slutdatumet till gårdagen.
 *
 * Körs av .github/workflows/verifiera-schema.yml i livet-data och lokalt när resolvern ändras.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { addDays, resolvePresenceRange } from '../src/presence/resolver.ts'
import { validatePeriods, validateSchema } from '../src/presence/validate.ts'
import { validateEvents, validateTodos } from '../src/laget/validate.ts'
import type { LagetEvent, Todo } from '../src/laget/types.ts'
import type { Period, PresenceStore } from '../src/presence/types.ts'
import { existsSync } from 'node:fs'

const FIRST_DAY = '2026-01-01'
const dir = process.argv[2]
const update = process.argv.includes('--update-golden')
if (!dir) {
  console.error('usage: verify-schedule.ts <livet-data-dir> [--update-golden]')
  process.exit(2)
}

const read = <T>(f: string): T => JSON.parse(readFileSync(resolve(dir, f), 'utf8')) as T
const store = read<PresenceStore>('data/schema.json')
const periods = read<Period[]>('data/perioder.json')

const optional = <T>(f: string): T[] => (existsSync(resolve(dir, f)) ? read<T[]>(f) : [])
const personIds = store.persons.map(p => p.id)
const errors = [
  ...validateSchema(store),
  ...validatePeriods(periods, store),
  ...validateEvents(optional<LagetEvent>('data/handelser.json'), personIds),
  ...validateTodos(optional<Todo>('data/attgora.json'), personIds),
]
if (errors.length) {
  console.error(`Strukturfel (${errors.length}):\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

interface GoldenDay { date: string; group: string | null; status: string; endsBy: string | null; eatEarlyBy: string | null; portions: number }
interface Golden { _om: string; through: string; days: GoldenDay[] }

function snapshot(through: string): GoldenDay[] {
  return resolvePresenceRange(FIRST_DAY, through, store).map(p => ({
    date: p.date,
    group: p.activeGroup?.id ?? null,
    status: p.windowStatus,
    endsBy: p.windowEndsBy,
    eatEarlyBy: p.eatEarlyBy,
    portions: p.portions,
  }))
}

const goldenPath = resolve(dir, 'data/schema.golden.json')
if (update) {
  const through = addDays(new Date().toISOString().slice(0, 10), -1)
  const golden: Golden = {
    _om: 'Ögonblicksbild av hur varje dag fram till "through" löstes ut. Skapad av scripts/verify-schedule.ts i matracet. Ändra inte för hand.',
    through,
    days: snapshot(through),
  }
  writeFileSync(goldenPath, JSON.stringify(golden, null, 2) + '\n')
  console.log(`Golden skriven: ${golden.days.length} dagar, ${FIRST_DAY} – ${through}`)
  process.exit(0)
}

const golden = read<Golden>('data/schema.golden.json')
const now = snapshot(golden.through)
const diffs: string[] = []
if (now.length !== golden.days.length) diffs.push(`antal dagar ${now.length} ≠ ${golden.days.length}`)
for (let i = 0; i < Math.min(now.length, golden.days.length); i++) {
  const a = JSON.stringify(golden.days[i])
  const b = JSON.stringify(now[i])
  if (a !== b) diffs.push(`${golden.days[i].date}: var ${a}\n            är nu ${b}`)
}
if (diffs.length) {
  console.error(`Golden avviker på ${diffs.length} dag(ar):\n${diffs.slice(0, 20).join('\n')}${diffs.length > 20 ? '\n…' : ''}`)
  console.error('\nÄr ändringen avsiktlig? Kör med --update-golden.')
  process.exit(1)
}
console.log(`OK: struktur giltig, ${golden.days.length} dagar (${FIRST_DAY} – ${golden.through}) oförändrade.`)
