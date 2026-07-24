import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadSnapshot, mergeFeedback, runMerge, FEEDBACK_KEY } from './merge-device-sync.mjs'

const SNAPSHOT_FIXTURE = new URL('./__fixtures__/device-sync-snapshot.json', import.meta.url).pathname
const FEEDBACK_FIXTURE = new URL('./__fixtures__/feedback-baseline.json', import.meta.url).pathname

describe('loadSnapshot', () => {
  it('refuses invalid JSON', () => {
    expect(() => loadSnapshot('{not json')).toThrow(/unparseable/)
  })

  it('refuses a schema-version mismatch', () => {
    expect(() => loadSnapshot(JSON.stringify({ version: 2, stores: {} }))).toThrow(/schema-version mismatch/)
  })

  it('refuses a snapshot missing "stores"', () => {
    expect(() => loadSnapshot(JSON.stringify({ version: 1 }))).toThrow(/missing or malformed "stores"/)
  })

  it('refuses a non-object snapshot', () => {
    expect(() => loadSnapshot('[]')).toThrow(/not an object/)
  })

  it('accepts a well-formed v1 snapshot', () => {
    const snapshot = loadSnapshot(JSON.stringify({ version: 1, stores: {} }))
    expect(snapshot.version).toBe(1)
  })
})

describe('mergeFeedback', () => {
  it('adopts a person entry missing locally', () => {
    const existing = { r1: { mealId: 'r1', excludeFromWeekPlan: false, updatedAt: 't0', persons: [] } }
    const incoming = {
      r1: {
        mealId: 'r1',
        excludeFromWeekPlan: false,
        updatedAt: '2026-01-02T00:00:00.000Z',
        persons: [{ personId: 'anna', sentiment: 'likes', updatedAt: '2026-01-02T00:00:00.000Z' }],
      },
    }
    const result = mergeFeedback(existing, incoming)
    expect(result.r1.persons).toEqual([{ personId: 'anna', sentiment: 'likes', updatedAt: '2026-01-02T00:00:00.000Z' }])
  })

  it('keeps the existing person entry when it is strictly newer than the incoming one', () => {
    const existing = {
      r1: {
        mealId: 'r1',
        excludeFromWeekPlan: false,
        updatedAt: '2026-02-01T00:00:00.000Z',
        persons: [{ personId: 'anna', sentiment: 'refuses', updatedAt: '2026-02-01T00:00:00.000Z' }],
      },
    }
    const incoming = {
      r1: {
        mealId: 'r1',
        excludeFromWeekPlan: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
        persons: [{ personId: 'anna', sentiment: 'likes', updatedAt: '2026-01-01T00:00:00.000Z' }],
      },
    }
    const result = mergeFeedback(existing, incoming)
    expect(result.r1.persons[0].sentiment).toBe('refuses')
  })

  it('adopts the incoming person entry when it is strictly newer', () => {
    const existing = {
      r1: {
        mealId: 'r1',
        excludeFromWeekPlan: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
        persons: [{ personId: 'anna', sentiment: 'refuses', updatedAt: '2026-01-01T00:00:00.000Z' }],
      },
    }
    const incoming = {
      r1: {
        mealId: 'r1',
        excludeFromWeekPlan: false,
        updatedAt: '2026-02-01T00:00:00.000Z',
        persons: [{ personId: 'anna', sentiment: 'likes', updatedAt: '2026-02-01T00:00:00.000Z' }],
      },
    }
    const result = mergeFeedback(existing, incoming)
    expect(result.r1.persons[0].sentiment).toBe('likes')
  })

  it('OR-merges excludeFromWeekPlan — true from either side wins, never silently cleared', () => {
    const existing = { r1: { mealId: 'r1', excludeFromWeekPlan: true, updatedAt: 't0', persons: [] } }
    const incoming = { r1: { mealId: 'r1', excludeFromWeekPlan: false, updatedAt: 't1', persons: [] } }
    expect(mergeFeedback(existing, incoming).r1.excludeFromWeekPlan).toBe(true)
  })

  it('leaves a mealId absent from the incoming snapshot untouched', () => {
    const existing = {
      untouched: { mealId: 'untouched', excludeFromWeekPlan: true, updatedAt: 't0', persons: [{ personId: 'anna', sentiment: 'likes', updatedAt: 't0' }] },
    }
    const result = mergeFeedback(existing, {})
    expect(result.untouched).toEqual(existing.untouched)
  })

  it('is idempotent — merging the same incoming data twice produces the same result', () => {
    const existing = { r1: { mealId: 'r1', excludeFromWeekPlan: false, updatedAt: 't0', persons: [] } }
    const incoming = {
      r1: {
        mealId: 'r1',
        excludeFromWeekPlan: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
        persons: [{ personId: 'anna', sentiment: 'likes', updatedAt: '2026-01-01T00:00:00.000Z' }],
      },
    }
    const once = mergeFeedback(existing, incoming)
    const twice = mergeFeedback(once, incoming)
    expect(twice).toEqual(once)
  })
})

describe('runMerge against fixtures', () => {
  const snapshotRaw = readFileSync(SNAPSHOT_FIXTURE, 'utf8')
  const feedbackFile = JSON.parse(readFileSync(FEEDBACK_FIXTURE, 'utf8'))

  it('merges the fixture snapshot into the fixture feedback baseline correctly', () => {
    const result = runMerge(snapshotRaw, feedbackFile)
    expect(result.changed).toBe(true)

    // erik's local rating (2026-07-16) is newer than the snapshot's (2026-07-10) — kept.
    expect(result.feedbackFile.feedback['ugnsbakad-lax'].persons.find(p => p.personId === 'erik').sentiment).toBe('likes')
    // anna wasn't rated locally at all — gap-filled from the snapshot.
    expect(result.feedbackFile.feedback['ugnsbakad-lax'].persons.find(p => p.personId === 'anna').sentiment).toBe('likes')

    // korvstroganoff didn't exist locally — created from the snapshot.
    expect(result.feedbackFile.feedback.korvstroganoff.excludeFromWeekPlan).toBe(true)

    // kycklinggryta isn't in the snapshot at all — must survive completely untouched.
    expect(result.feedbackFile.feedback.kycklinggryta).toEqual(feedbackFile.feedback.kycklinggryta)

    // Non-feedback store keys are skipped, not silently dropped without a trace.
    expect(result.skipped).toContain('matracet:weekplan:v2')
    expect(result.skipped).toContain('matracet:category-feedback:v1')
    expect(result.skipped).not.toContain(FEEDBACK_KEY)

    // The _om/app/version fields survive the merge unchanged.
    expect(result.feedbackFile._om).toBe(feedbackFile._om)
  })

  it('is idempotent end-to-end: running the merge again on its own output changes nothing', () => {
    const first = runMerge(snapshotRaw, feedbackFile)
    const second = runMerge(snapshotRaw, first.feedbackFile)
    expect(second.changed).toBe(false)
    expect(second.feedbackFile).toEqual(first.feedbackFile)
  })

  it('refuses to run on a corrupted snapshot and leaves the feedback file untouched', () => {
    expect(() => runMerge('{ "version": 999, "stores": {} }', feedbackFile)).toThrow(/schema-version mismatch/)
  })
})
