import { describe, expect, it } from 'vitest'
import { BETA_HEADER, fireRoutine } from './routine.mjs'

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

describe('fireRoutine', () => {
  it('POSTs the text with the bearer token and the beta headers', async () => {
    let seen
    const r = await fireRoutine({
      url: 'https://api.anthropic.com/v1/claude_code/routines/trig_X/fire', token: 'tok', text: 'Fixade busskortet',
      fetchImpl: async (u, init) => { seen = [u, init]; return res(200, { claude_code_session_url: 'https://claude.ai/code/session_1' }) },
    })
    expect(r).toEqual({ ok: true, status: 200, session: 'https://claude.ai/code/session_1' })
    expect(seen[0]).toContain('/fire')
    expect(seen[1].method).toBe('POST')
    expect(seen[1].headers).toMatchObject({ Authorization: 'Bearer tok', 'anthropic-beta': BETA_HEADER, 'anthropic-version': '2023-06-01' })
    expect(JSON.parse(seen[1].body)).toEqual({ text: 'Fixade busskortet' })
  })
  it('reports (never throws) on HTTP errors, network errors and missing secrets', async () => {
    expect(await fireRoutine({ url: 'u', token: 't', text: 'x', fetchImpl: async () => res(401) })).toMatchObject({ ok: false, status: 401 })
    expect(await fireRoutine({ url: 'u', token: 't', text: 'x', fetchImpl: async () => { throw new Error('offline') } })).toMatchObject({ ok: false, error: 'offline' })
    expect(await fireRoutine({ url: '', token: '', text: 'x' })).toMatchObject({ ok: false })
  })
  it('tolerates a success response without a JSON body', async () => {
    const r = await fireRoutine({ url: 'u', token: 't', text: 'x', fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error('no body') } }) })
    expect(r).toEqual({ ok: true, status: 200, session: null })
  })
})
