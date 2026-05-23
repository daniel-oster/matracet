/**
 * Acceptance test: prints a 28-day presence + eating-window table starting from
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
console.log(`  Närvaro + Matfönster  ${startDate} – ${endDate}  (${days} dagar)`)
console.log()
console.log('  Dag   Datum        Grupp              Port  Fönster     Tid    Notering')
console.log('  ─────────────────────────────────────────────────────────────────────────────────')

for (const p of plans) {
  const wd        = WEEKDAY_SV[isoWeekday(p.date)].padEnd(5)
  const groupName = (p.activeGroup?.name ?? '—').padEnd(18)
  const portions  = p.portions > 0 ? String(p.portions) : ' '

  let windowCol: string
  let timeCol: string

  switch (p.windowStatus) {
    case 'OPEN':
      windowCol = 'OPEN      '
      timeCol   = '          '
      break
    case 'BOUNDED':
      windowCol = 'BOUNDED   '
      timeCol   = `senast ${p.windowEndsBy ?? '?????'}`
      break
    case 'CONFLICT':
      windowCol = 'CONFLICT  '
      timeCol   = `ät senast ${p.eatEarlyBy ?? '?????'}`
      break
  }

  // First line: main row
  console.log(`  ${wd}  ${p.date}    ${groupName} ${portions}     ${windowCol} ${timeCol}`)

  // Indent additional window notes
  for (const note of p.windowNotes) {
    console.log(`                                                       ↳ ${note}`)
  }

  // Display-only entries: timeless (no startTime) and daytime-bounded (< 15:00)
  const displayOnly = p.activitiesToday.filter(a => {
    if (!a.affectsWindow) return true           // timeless
    const eff = a.leaveBy ?? a.arriveBy ?? a.startTime
    return eff !== null && eff < '15:00'        // daytime, not dinner-window
  })
  for (const a of displayOnly) {
    const name = a.personId === 'sarah' ? 'Sarah' : 'Annabelle'
    const timeStr = a.startTime ? ` ${a.startTime}` : ''
    console.log(`                                                         ◦ ${name}: ${a.label}${timeStr}`)
  }
}

console.log()
