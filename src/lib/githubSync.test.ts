import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearToken,
  fetchState,
  getToken,
  pushState,
  serializeState,
  setToken,
  type SyncState,
} from './githubSync'

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
}

function encodeBase64ForTest(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64ForTest(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function makeState(overrides?: Partial<SyncState>): SyncState {
  return {
    version: 1,
    deviceId: 'device-1',
    updatedAt: '2026-07-18T12:00:00.000Z',
    stores: {
      'matracet:weekplan:v2': { updatedAt: '2026-07-18T12:00:00.000Z', data: { foo: 'bar' } },
    },
    ...overrides,
  }
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('token accessor', () => {
  it('returns null when no token is set', () => {
    expect(getToken()).toBeNull()
  })

  it('round-trips a token through set/get/clear', () => {
    setToken('  ghp_abc123  ')
    expect(getToken()).toBe('ghp_abc123')
    clearToken()
    expect(getToken()).toBeNull()
  })
})

describe('fetchState', () => {
  it('returns no-token when nothing is stored', async () => {
    const result = await fetchState()
    expect(result).toEqual({ status: 'no-token', state: null, sha: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('happy path: decodes base64 content into the state, including Swedish characters', async () => {
    setToken('tok')
    const state = makeState({
      stores: {
        'matracet:feedback:v1': {
          updatedAt: '2026-07-18T12:00:00.000Z',
          data: { note: 'Grönkålspaj – ½ tsk' },
        },
      },
    })
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { content: encodeBase64ForTest(serializeState(state)), sha: 'sha-1' }),
    )

    const result = await fetchState()
    expect(result.status).toBe('ok')
    expect(result.sha).toBe('sha-1')
    expect(result.state?.stores['matracet:feedback:v1'].data).toEqual({
      note: 'Grönkålspaj – ½ tsk',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('ref=device-sync')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('returns not-found on a 404 (file does not exist yet)', async () => {
    setToken('tok')
    fetchMock.mockResolvedValueOnce(jsonResponse(404, {}))
    const result = await fetchState()
    expect(result).toEqual({ status: 'not-found', state: null, sha: null })
  })

  it('returns unauthorized on a 401', async () => {
    setToken('bad-token')
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}))
    const result = await fetchState()
    expect(result.status).toBe('unauthorized')
  })

  it('returns network on a thrown fetch error', async () => {
    setToken('tok')
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    const result = await fetchState()
    expect(result.status).toBe('network')
  })
})

describe('pushState', () => {
  it('returns no-token when nothing is stored', async () => {
    const result = await pushState(makeState())
    expect(result).toEqual({ status: 'no-token', sha: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('happy path: discovers sha then PUTs with it', async () => {
    setToken('tok')
    const state = makeState()
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { content: encodeBase64ForTest(serializeState(makeState())), sha: 'sha-old' }),
      )
      .mockResolvedValueOnce(jsonResponse(201, { content: { sha: 'sha-new' } }))

    const result = await pushState(state)
    expect(result).toEqual({ status: 'ok', sha: 'sha-new' })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const putCall = fetchMock.mock.calls[1]
    expect(putCall[1].method).toBe('PUT')
    const body = JSON.parse(putCall[1].body as string)
    expect(body.sha).toBe('sha-old')
    expect(body.branch).toBe('device-sync')
  })

  it('creates without a sha when the file does not exist yet (404 on discovery)', async () => {
    setToken('tok')
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValueOnce(jsonResponse(201, { content: { sha: 'sha-created' } }))

    const result = await pushState(makeState())
    expect(result).toEqual({ status: 'ok', sha: 'sha-created' })

    const putBody = JSON.parse(fetchMock.mock.calls[1][1].body as string)
    expect(putBody.sha).toBeUndefined()
  })

  it('skips discovery when a known sha is passed explicitly (including null)', async () => {
    setToken('tok')
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { content: { sha: 'sha-created' } }))

    const result = await pushState(makeState(), null)
    expect(result).toEqual({ status: 'ok', sha: 'sha-created' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries once on 409 then succeeds', async () => {
    setToken('tok')
    fetchMock
      .mockResolvedValueOnce(jsonResponse(409, {})) // first PUT attempt (knownSha provided)
      .mockResolvedValueOnce(
        jsonResponse(200, { content: encodeBase64ForTest(serializeState(makeState())), sha: 'sha-fresh' }),
      ) // re-fetch sha after conflict
      .mockResolvedValueOnce(jsonResponse(200, { content: { sha: 'sha-final' } })) // second PUT succeeds

    const result = await pushState(makeState(), 'sha-stale')
    expect(result).toEqual({ status: 'ok', sha: 'sha-final' })
    expect(fetchMock).toHaveBeenCalledTimes(3)

    const secondPutBody = JSON.parse(fetchMock.mock.calls[2][1].body as string)
    expect(secondPutBody.sha).toBe('sha-fresh')
  })

  it('returns conflict-exhausted after a second 409', async () => {
    setToken('tok')
    fetchMock
      .mockResolvedValueOnce(jsonResponse(409, {})) // first PUT
      .mockResolvedValueOnce(
        jsonResponse(200, { content: encodeBase64ForTest(serializeState(makeState())), sha: 'sha-fresh' }),
      ) // re-fetch sha
      .mockResolvedValueOnce(jsonResponse(409, {})) // second PUT, still conflicting

    const result = await pushState(makeState(), 'sha-stale')
    expect(result).toEqual({ status: 'conflict-exhausted', sha: null })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('returns unauthorized on a 401 without retrying', async () => {
    setToken('tok')
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}))
    const result = await pushState(makeState(), 'some-sha')
    expect(result).toEqual({ status: 'unauthorized', sha: null })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('round-trips Swedish characters through the PUT body', async () => {
    setToken('tok')
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { content: { sha: 'sha-x' } }))

    const state = makeState({
      stores: {
        'matracet:feedback:v1': {
          updatedAt: '2026-07-18T12:00:00.000Z',
          data: { note: 'Grönkålspaj – ½ tsk' },
        },
      },
    })
    await pushState(state, null)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    const decoded = JSON.parse(decodeBase64ForTest(body.content))
    expect(decoded.stores['matracet:feedback:v1'].data.note).toBe('Grönkålspaj – ½ tsk')
  })
})

describe('serializeState', () => {
  it('sorts store keys so unchanged snapshots serialize byte-identically', () => {
    const a = makeState({
      stores: {
        b: { updatedAt: 't', data: 1 },
        a: { updatedAt: 't', data: 2 },
      },
    })
    const b = makeState({
      stores: {
        a: { updatedAt: 't', data: 2 },
        b: { updatedAt: 't', data: 1 },
      },
    })
    expect(serializeState(a)).toBe(serializeState(b))
  })
})
