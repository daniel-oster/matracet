/**
 * Acceptance test: prints a 28-day presence table starting from
 * 2026-05-22 (a known Daniel-week Friday / biweekly anchor).
 *
 * Run: npx tsx scripts/presence-check.ts [YYYY-MM-DD [days]]
 */
import { resolvePresenceRange, addDays } from '../src/presence/resolver.ts'
import { SEED_STORE } from '../src/presence/seed.ts'

const WEEKDAY_SV = ['', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

function isoWeekday(date: string): number {
  const d = new Date(date + 'T00:00:00Z')
  const dow = d.getUTCDay()
  return dow === 0 ? 7 : dow
}

const startDate = process.argv[2] ?? '2026-05-22'
const days      = parseInt(process.argv[3] ?? '28', 10)
const endDate   = addDays(startDate, days - 1)

const plans = resolvePresenceRange(startDate, endDate, SEED_STORE)

console.log()
console.log(`  Närvaro-schema  ${startDate} – ${endDate}  (${days} dagar)`)
console.log()
console.log('  Veckodag   Datum         Grupp                Portioner')
console.log('  ─────────────────────────────────────────────────────────')

for (const p of plans) {
  const wd        = WEEKDAY_SV[isoWeekday(p.date)].padEnd(9)
  const groupName = (p.activeGroup?.name ?? '—').padEnd(20)
  console.log(`  ${wd}  ${p.date}    ${groupName} ${p.portions > 0 ? p.portions : ''}`)
}

console.log()
