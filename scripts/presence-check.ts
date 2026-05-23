/**
 * Acceptance test: prints a 28-day presence + eating-window + meal-plan table.
 *
 * Run: npx tsx scripts/presence-check.ts [YYYY-MM-DD [days]]
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { resolvePresenceRange, addDays } from '../src/presence/resolver.ts'
import { SEED_STORE, PERSONS } from '../src/presence/seed.ts'
import { evaluateSlot, buildMealSlots, type RecipeLite } from '../src/meals/checks.ts'
import { SEED_PREFERENCES, ILLUSTRATIVE_PLAN } from '../src/meals/seed.ts'

// ── Load recipe index ─────────────────────────────────────────────────────────

const recipeIndex: RecipeLite[] = (JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/data/recipes/_index.json'), 'utf-8'),
) as { recipes: RecipeLite[] }).recipes

// ── Date helpers ──────────────────────────────────────────────────────────────

const WEEKDAY_SV = ['', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

function isoWeekday(date: string): number {
  const d = new Date(date + 'T00:00:00Z')
  const dow = d.getUTCDay()
  return dow === 0 ? 7 : dow
}

// ── Build plan ────────────────────────────────────────────────────────────────

const startDate = process.argv[2] ?? '2026-05-22'
const days = parseInt(process.argv[3] ?? '28', 10)
const endDate = addDays(startDate, days - 1)

const dayPlans = resolvePresenceRange(startDate, endDate, SEED_STORE)
const slots = buildMealSlots(dayPlans, ILLUSTRATIVE_PLAN)

const ctx = {
  cookingEvents: ILLUSTRATIVE_PLAN.cookingEvents,
  allAssignments: ILLUSTRATIVE_PLAN.assignments,
  allSlots: slots,
  recipeIndex,
  persons: PERSONS,
  preferences: SEED_PREFERENCES,
}

// ── Print ─────────────────────────────────────────────────────────────────────

console.log()
console.log(`  Matplan  ${startDate} – ${endDate}  (${days} dagar)`)
console.log()
console.log('  Dag   Datum        Grupp                Port  Fönster     Tid           Uppdrag')
console.log('  ─────────────────────────────────────────────────────────────────────────────────────')

for (const slot of slots) {
  const wd = WEEKDAY_SV[isoWeekday(slot.date)].padEnd(5)
  const p = slot.dayPlan
  const groupName = (p.activeGroup?.name ?? '—').padEnd(20)
  const portions = p.portions > 0 ? String(p.portions) : ' '

  let windowCol: string
  let timeCol: string
  switch (p.windowStatus) {
    case 'OPEN':     windowCol = 'OPEN      '; timeCol = '              '; break
    case 'BOUNDED':  windowCol = 'BOUNDED   '; timeCol = `senast ${p.windowEndsBy ?? '?????'}  `; break
    case 'CONFLICT': windowCol = 'CONFLICT  '; timeCol = `ät senast ${p.eatEarlyBy ?? '?????'}`; break
  }

  // Assignment column
  let assignCol = '—'
  const asgn = slot.assignment
  if (asgn) {
    if (asgn.kind === 'FRESH_COOK') {
      const ev = ILLUSTRATIVE_PLAN.cookingEvents.find(e => e.id === asgn.cookingEventId)
      const recipe = ev ? recipeIndex.find(r => r.slug === ev.recipeId) : null
      assignCol = `LAGAR: ${recipe?.namn ?? ev?.recipeId ?? '?'}`
    } else if (asgn.kind === 'LEFTOVER') {
      const ev = ILLUSTRATIVE_PLAN.cookingEvents.find(e => e.id === asgn.cookingEventId)
      const recipe = ev ? recipeIndex.find(r => r.slug === ev.recipeId) : null
      assignCol = `RESTER: ${recipe?.namn ?? '?'} (${ev?.date ?? '?'})`
    } else if (asgn.kind === 'EAT_OUT') {
      assignCol = `ÄT UTE: ${asgn.label ?? ''}`
    } else if (asgn.kind === 'NO_MEAL') {
      assignCol = `INGEN: ${asgn.label ?? ''}`
    }
  }

  console.log(`  ${wd}  ${slot.date}    ${groupName} ${portions}     ${windowCol} ${timeCol}`)
  console.log(`  ${''.padEnd(5)}  ${''.padEnd(10)}    ${''.padEnd(20)}              ${assignCol}`)

  // Window notes
  for (const note of p.windowNotes) {
    console.log(`  ${''.padEnd(47)}    ↳ ${note}`)
  }

  // Timeless / daytime activities (display context)
  const displayOnly = p.activitiesToday.filter(a => {
    if (!a.affectsWindow) return true
    const eff = a.leaveBy ?? a.arriveBy ?? a.startTime
    return eff !== null && eff < '15:00'
  })
  for (const a of displayOnly) {
    const name = a.personId === 'sarah' ? 'Sarah' : 'Annabelle'
    const timeStr = a.startTime ? ` ${a.startTime}` : ''
    console.log(`  ${''.padEnd(47)}    ◦ ${name}: ${a.label}${timeStr}`)
  }

  // Warnings
  if (asgn) {
    const warnings = evaluateSlot(slot, asgn, ctx)
    for (const w of warnings) {
      const badge = w.severity === 'HARD' ? '⚠ HARD' : '~ SOFT'
      console.log(`  ${''.padEnd(47)}    ${badge}: ${w.message}`)
    }
  }
}

console.log()
console.log('  Portioner per tillagning:')
for (const ev of ILLUSTRATIVE_PLAN.cookingEvents) {
  const recipe = recipeIndex.find(r => r.slug === ev.recipeId)
  const used = ILLUSTRATIVE_PLAN.assignments
    .filter(a => a.cookingEventId === ev.id)
    .reduce((s, a) => {
      const sl = slots.find(sl => sl.date === a.slotDate)
      return s + (sl?.dayPlan.portions ?? 0)
    }, 0)
  const status = used > ev.personMeals ? '⚠ OVER' : used === ev.personMeals ? '✓ exakt' : `✓ (${ev.personMeals - used} kvar)`
  console.log(`    ${ev.date}  ${(recipe?.namn ?? ev.recipeId).substring(0, 35).padEnd(35)} ${used}/${ev.personMeals}pm  ${status}`)
}
console.log()
