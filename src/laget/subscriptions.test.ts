import { describe, expect, it } from 'vitest'
import { withSubscription } from './subscriptions'

const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } })

describe('withSubscription', () => {
  it('creates the file shape from nothing', () => {
    expect(withSubscription(null, sub('e1'), 'telefon', '2026-10-25')).toEqual({
      subscriptions: [{ namn: 'telefon', skapad: '2026-10-25', subscription: sub('e1') }],
    })
  })
  it('keeps other devices and appends the new one', () => {
    const file = { subscriptions: [{ namn: 'a', subscription: sub('e1') }] }
    const out = withSubscription(file, sub('e2'), 'b', '2026-10-25')
    expect(out.subscriptions.map(s => s.subscription.endpoint)).toEqual(['e1', 'e2'])
  })
  it('replaces an older entry for the same endpoint instead of duplicating it', () => {
    const file = { subscriptions: [{ namn: 'a', subscription: sub('e1') }, { namn: 'b', subscription: sub('e2') }] }
    const out = withSubscription(file, { ...sub('e1'), keys: { p256dh: 'ny', auth: 'ny' } }, 'a', '2026-10-26')
    expect(out.subscriptions).toHaveLength(2)
    expect(out.subscriptions.find(s => s.subscription.endpoint === 'e1')?.subscription.keys?.auth).toBe('ny')
  })
  it('does not mutate its input', () => {
    const file = { subscriptions: [{ namn: 'a', subscription: sub('e1') }] }
    const before = JSON.stringify(file)
    withSubscription(file, sub('e2'), 'b', '2026-10-25')
    expect(JSON.stringify(file)).toBe(before)
  })
})
