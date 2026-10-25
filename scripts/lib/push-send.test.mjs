import { describe, expect, it } from 'vitest'
import { normalizePrivateKey, privateKeyProblem, sendToAll } from './push-send.mjs'

describe('normalizePrivateKey', () => {
  it('strips whitespace, newlines and wrapping quotes/backticks', () => {
    expect(normalizePrivateKey('  `abc\n def`  ')).toBe('abcdef')
    expect(normalizePrivateKey('"abc"')).toBe('abc')
    expect(normalizePrivateKey(undefined)).toBe('')
  })
})

describe('privateKeyProblem', () => {
  it('accepts 32 bytes of base64url and reports the length (never the key) otherwise', () => {
    expect(privateKeyProblem(Buffer.alloc(32, 1).toString('base64url'))).toBeNull()
    const msg = privateKeyProblem('kort-nyckel')
    expect(msg).toContain('11 tecken')
    expect(msg).not.toContain('kort-nyckel')
  })
})

describe('sendToAll', () => {
  const subs = [
    { namn: 'a', subscription: { endpoint: 'e1' } },
    { namn: 'b', subscription: { endpoint: 'e2' } },
    { namn: 'c', subscription: { endpoint: 'e3' } },
  ]
  it('reports each subscription, flags revoked ones and keeps going after a failure', async () => {
    const send = async sub => {
      if (sub.endpoint === 'e2') throw Object.assign(new Error('gone'), { statusCode: 410 })
      if (sub.endpoint === 'e3') throw new Error('timeout')
    }
    const r = await sendToAll(subs, { title: 't' }, { send })
    expect(r.ok).toBe(1)
    expect(r.total).toBe(3)
    expect(r.lines[0]).toBe('✓ a')
    expect(r.lines[1]).toContain('avslutad')
    expect(r.lines[2]).toContain('timeout')
  })
  it('sends the payload as JSON with a TTL', async () => {
    const seen = []
    await sendToAll([subs[0]], { title: 'Läget idag' }, { send: async (s, body, opts) => seen.push([s, body, opts]) })
    expect(JSON.parse(seen[0][1])).toEqual({ title: 'Läget idag' })
    expect(seen[0][2].TTL).toBe(86400)
  })
})
