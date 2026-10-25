import { describe, it, expect } from 'vitest'
import { validatePeriods, validateSchema } from './validate'
import { TEST_STORE } from './__fixtures__/testStore'
import type { Period, PresenceStore } from './types'

const clone = (): PresenceStore => JSON.parse(JSON.stringify(TEST_STORE))

describe('validateSchema', () => {
  it('accepts the fixture', () => {
    expect(validateSchema(TEST_STORE)).toEqual([])
  })
  it('flags a rule that points at a missing group', () => {
    const s = clone()
    s.rules[0].groupId = 'finns-inte'
    expect(validateSchema(s)).toEqual([expect.stringContaining('okänd grupp "finns-inte"')])
  })
  it('flags a BIWEEKLY rule without an anchor', () => {
    const s = clone()
    const r = s.rules.find(x => x.cadence === 'BIWEEKLY')!
    r.anchorDate = null
    expect(validateSchema(s).join('\n')).toContain('BIWEEKLY kräver')
  })
  it('flags times that are not HH:MM', () => {
    const s = clone()
    s.activities![0].startTime = '7:30'
    s.rules.find(r => r.handoverByWeekday)!.handoverByWeekday = { 1: '19.00' }
    const out = validateSchema(s).join('\n')
    expect(out).toContain('startTime="7:30"')
    expect(out).toContain('överlämningstid')
  })
  it('flags inverted validity ranges and duplicate ids', () => {
    const s = clone()
    s.rules[0].validFrom = '2026-09-01'
    s.rules[0].validUntil = '2026-01-01'
    s.groups.push({ ...s.groups[0] })
    const out = validateSchema(s).join('\n')
    expect(out).toContain('validUntil före validFrom')
    expect(out).toContain('dubblett-id')
  })
  it('flags an activity for an unknown person', () => {
    const s = clone()
    s.activities![0].personId = 'ingen'
    expect(validateSchema(s).join('\n')).toContain('okänd person "ingen"')
  })
  it('flags an impossible calendar date', () => {
    const s = clone()
    s.rules[0].validFrom = '2026-02-30'
    expect(validateSchema(s).join('\n')).toContain('ogiltigt validFrom')
  })
})

describe('validatePeriods', () => {
  const ok: Period[] = [{ id: 'a', kind: 'termin', name: 'T', from: '2026-08-17', to: null, personIds: ['barn-a'] }]
  it('accepts a valid open-ended term', () => {
    expect(validatePeriods(ok, TEST_STORE)).toEqual([])
  })
  it('flags unknown people, bad kinds and inverted ranges', () => {
    const bad = [{ id: 'b', kind: 'semester', name: 'S', from: '2026-10-30', to: '2026-10-26', personIds: ['ingen'] }] as unknown as Period[]
    const out = validatePeriods(bad, TEST_STORE).join('\n')
    expect(out).toContain('kind måste vara')
    expect(out).toContain('to före from')
    expect(out).toContain('okänd person "ingen"')
  })
})
