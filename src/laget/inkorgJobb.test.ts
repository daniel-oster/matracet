import { describe, expect, it } from 'vitest'
import { GAVE_UP_REPLY, MAX_REFIRES, classifyChange, confirmNotis, gaveUp, planStale } from './inkorgJobb'
import type { InkorgMeddelande } from './inkorg'

const m = (over: Partial<InkorgMeddelande> = {}): InkorgMeddelande => ({ id: 'i-20261025-0931-x7k', sent: '2026-10-25T08:31:00.000Z', text: 'Fixade busskortet', status: 'ny', ...over })

describe('classifyChange', () => {
  it('fires for a new message that is still ny', () => {
    expect(classifyChange(null, m())).toBe('fire')
  })
  it('confirms when a ny message has been answered, whichever way', () => {
    for (const status of ['klar', 'oklar', 'fel'] as const) expect(classifyChange(m(), m({ status, reply: 'x' }))).toBe('confirm')
  })
  it('does nothing for Claude’s own follow-up edits, or an edit while still ny', () => {
    expect(classifyChange(m({ status: 'klar' }), m({ status: 'klar', reply: 'ändrad' }))).toBeNull()
    expect(classifyChange(m(), m({ text: 'ändrad text' }))).toBeNull()
  })
  it('never fires for a message that arrives already answered (no loop on Claude’s commit)', () => {
    expect(classifyChange(null, m({ status: 'klar' }))).toBeNull()
  })
  it('an unanswered message reopened as ny does not re-fire', () => {
    expect(classifyChange(m({ status: 'klar' }), m())).toBeNull()
  })
})

describe('confirmNotis', () => {
  it('carries Claude’s reply and opens the start page', () => {
    expect(confirmNotis(m({ status: 'klar', reply: 'Inlagt: Förnya busskortet 25/11' }))).toMatchObject({
      title: 'Läget – inlagt', body: 'Inlagt: Förnya busskortet 25/11', url: '/matracet/laget/', tag: 'laget-inkorg-i-20261025-0931-x7k',
    })
  })
  it('titles a question and a failure differently', () => {
    expect(confirmNotis(m({ status: 'oklar', reply: 'vilken tid är mötet?' }))).toMatchObject({ title: 'Läget – en fråga', body: 'Oklart: vilken tid är mötet?' })
    expect(confirmNotis(m({ status: 'fel', reply: 'x' })).title).toBe('Läget – gick inte')
  })
  it('cuts a long reply to a notification-sized body', () => {
    const n = confirmNotis(m({ status: 'klar', reply: 'Inlagt: ' + 'a'.repeat(400) }))
    expect(n.body.length).toBe(160)
    expect(n.body.endsWith('…')).toBe(true)
  })
})

describe('planStale', () => {
  const now = new Date('2026-10-25T08:50:00Z') // 19 minutes after the message
  const empty = { skickade: [] }
  it('re-fires a message that has waited more than 15 minutes, recording a numbered key', () => {
    const plan = planStale([m()], empty, now)
    expect(plan.fire).toEqual([{ message: m(), key: '2026-10-25|fire|i-20261025-0931-x7k|1' }])
    expect(plan.giveUp).toEqual([])
  })
  it('leaves fresh and answered messages alone', () => {
    const fresh = m({ id: 'a', sent: '2026-10-25T08:45:00Z' })
    const done = m({ id: 'b', status: 'klar' })
    expect(planStale([fresh, done], empty, now)).toEqual({ fire: [], giveUp: [] })
  })
  it('counts earlier re-fires and gives up after the allowed number', () => {
    const once = { skickade: [{ key: '2026-10-25|fire|i-20261025-0931-x7k|1', sent: 'x' }] }
    expect(planStale([m()], once, now).fire[0].key).toBe('2026-10-25|fire|i-20261025-0931-x7k|2')
    const used = { skickade: Array.from({ length: MAX_REFIRES }, (_, i) => ({ key: `2026-10-25|fire|i-20261025-0931-x7k|${i + 1}`, sent: 'x' })) }
    expect(planStale([m()], used, now)).toEqual({ fire: [], giveUp: [m()] })
  })
  it('does not mix up the fire counts of two messages', () => {
    const other = { skickade: [{ key: '2026-10-25|fire|i-20261025-0900-zzz|1', sent: 'x' }, { key: '2026-10-25|fire|i-20261025-0900-zzz|2', sent: 'x' }] }
    expect(planStale([m()], other, now).fire).toHaveLength(1)
  })
})

describe('gaveUp', () => {
  it('marks the message as failed with an explanation the sender will see', () => {
    expect(gaveUp(m(), new Date('2026-10-25T10:00:00Z'))).toEqual({ ...m(), status: 'fel', reply: GAVE_UP_REPLY, processedAt: '2026-10-25T10:00:00.000Z' })
  })
})
