import type { Period, PresenceStore } from './types'

// Structural checks for the private schedule files (data/schema.json, data/perioder.json).
// Those files are edited by hand and — from step 2 of Läget — by Claude, so a typo (a group id
// that doesn't exist, a time like "7:30", an inverted date range) must be caught before it
// silently turns into a wrong eating window. Pure; returns human-readable errors, [] = valid.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DATE.test(v)) return false
  // Round-trip: Date.parse happily rolls "2026-02-30" over to March.
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

function dup(ids: string[]): string[] {
  return ids.filter((id, i) => ids.indexOf(id) !== i)
}

export function validateSchema(store: PresenceStore): string[] {
  const errors: string[] = []
  const personIds = new Set(store.persons.map(p => p.id))
  const groupIds = new Set(store.groups.map(g => g.id))
  const ruleIds = new Set(store.rules.map(r => r.id))

  for (const id of dup(store.persons.map(p => p.id))) errors.push(`person: dubblett-id "${id}"`)
  for (const id of dup(store.groups.map(g => g.id))) errors.push(`group: dubblett-id "${id}"`)
  for (const id of dup(store.rules.map(r => r.id))) errors.push(`rule: dubblett-id "${id}"`)
  for (const id of dup((store.activities ?? []).map(a => a.id))) errors.push(`activity: dubblett-id "${id}"`)

  for (const g of store.groups) {
    for (const m of g.memberPersonIds) if (!personIds.has(m)) errors.push(`group ${g.id}: okänd person "${m}"`)
  }

  for (const r of store.rules) {
    const at = `rule ${r.id}`
    if (!groupIds.has(r.groupId)) errors.push(`${at}: okänd grupp "${r.groupId}"`)
    if (r.weekdays.length === 0 || r.weekdays.some(w => !Number.isInteger(w) || w < 1 || w > 7)) errors.push(`${at}: ogiltiga veckodagar`)
    if (r.cadence === 'BIWEEKLY' && !isDate(r.anchorDate)) errors.push(`${at}: BIWEEKLY kräver ett giltigt anchorDate`)
    if (!isDate(r.validFrom)) errors.push(`${at}: ogiltigt validFrom`)
    if (r.validUntil !== null && !isDate(r.validUntil)) errors.push(`${at}: ogiltigt validUntil`)
    if (isDate(r.validFrom) && isDate(r.validUntil) && r.validUntil < r.validFrom) errors.push(`${at}: validUntil före validFrom`)
    for (const [wd, t] of Object.entries(r.handoverByWeekday ?? {})) {
      if (!HHMM.test(String(t))) errors.push(`${at}: överlämningstid ${wd}="${t}" är inte HH:MM`)
    }
  }

  for (const o of store.overrides) {
    const at = `override ${o.id}`
    if (!isDate(o.date)) errors.push(`${at}: ogiltigt datum`)
    if (o.type === 'SET_GROUP' && (!o.groupId || !groupIds.has(o.groupId))) errors.push(`${at}: okänd grupp "${o.groupId}"`)
    if (o.type === 'PHASE_FLIP' && (!o.appliesToRuleId || !ruleIds.has(o.appliesToRuleId))) errors.push(`${at}: okänd regel "${o.appliesToRuleId}"`)
  }

  for (const a of store.activities ?? []) {
    const at = `activity ${a.id}`
    if (!personIds.has(a.personId)) errors.push(`${at}: okänd person "${a.personId}"`)
    if (!Number.isInteger(a.weekday) || a.weekday < 1 || a.weekday > 7) errors.push(`${at}: ogiltig veckodag`)
    for (const f of ['startTime', 'arriveBy', 'leaveBy', 'endTime'] as const) {
      if (a[f] !== null && !HHMM.test(String(a[f]))) errors.push(`${at}: ${f}="${a[f]}" är inte HH:MM`)
    }
    if (!isDate(a.validFrom)) errors.push(`${at}: ogiltigt validFrom`)
    if (a.validUntil !== null && !isDate(a.validUntil)) errors.push(`${at}: ogiltigt validUntil`)
    if (isDate(a.validFrom) && isDate(a.validUntil) && a.validUntil < a.validFrom) errors.push(`${at}: validUntil före validFrom`)
    for (const [i, pr] of (a.prepare ?? []).entries()) {
      if (!pr.text?.trim()) errors.push(`${at}: prepare[${i}] saknar text`)
      if (!Number.isInteger(pr.daysBefore) || pr.daysBefore < 0 || pr.daysBefore > 14) errors.push(`${at}: prepare[${i}].daysBefore måste vara 0–14`)
    }
  }

  return errors
}

export function validatePeriods(periods: Period[], store: PresenceStore): string[] {
  const errors: string[] = []
  const personIds = new Set(store.persons.map(p => p.id))
  for (const id of dup(periods.map(p => p.id))) errors.push(`period: dubblett-id "${id}"`)
  for (const p of periods) {
    const at = `period ${p.id}`
    if (p.kind !== 'termin' && p.kind !== 'lov') errors.push(`${at}: kind måste vara termin eller lov`)
    if (!isDate(p.from)) errors.push(`${at}: ogiltigt from`)
    if (p.to !== null && !isDate(p.to)) errors.push(`${at}: ogiltigt to`)
    if (isDate(p.from) && isDate(p.to) && p.to < p.from) errors.push(`${at}: to före from`)
    for (const id of p.personIds) if (!personIds.has(id)) errors.push(`${at}: okänd person "${id}"`)
  }
  return errors
}
