import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setToken } from './githubSync'
import { clearPrivateCache, fetchPrivateJson } from './privateData'

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
  get length(): number {
    return this.store.size
  }
  key(i: number): string | null {
    return [...this.store.keys()][i] ?? null
  }
  keys(): string[] {
    return [...this.store.keys()]
  }
}

function res(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  const h = new Headers(headers)
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: h,
    json: async () => body,
  } as unknown as Response
}

let storage: MemoryStorage
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('fetchPrivateJson', () => {
  it('makes no request without a token', async () => {
    const r = await fetchPrivateJson('data/schema.json')
    expect(r).toEqual({ status: 'no-token', data: null, stale: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches raw JSON from livet-data and sends the token', async () => {
    setToken('tok')
    fetchMock.mockResolvedValue(res(200, { a: 1 }, { etag: '"e1"' }))
    const r = await fetchPrivateJson<{ a: number }>('data/schema.json')
    expect(r).toEqual({ status: 'ok', data: { a: 1 }, stale: false })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.github.com/repos/daniel-oster/livet-data/contents/data/schema.json')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(init.headers.Accept).toBe('application/vnd.github.raw+json')
  })

  it('passes ref as a query parameter', async () => {
    setToken('tok')
    fetchMock.mockResolvedValue(res(200, {}))
    await fetchPrivateJson('matracet/sync/state.json', 'device-sync')
    expect(fetchMock.mock.calls[0][0]).toContain('?ref=device-sync')
  })

  it('revalidates with the stored ETag and serves the cache on 304', async () => {
    setToken('tok')
    fetchMock.mockResolvedValueOnce(res(200, { a: 1 }, { etag: '"e1"' }))
    await fetchPrivateJson('data/schema.json')
    fetchMock.mockResolvedValueOnce(res(304))
    const r = await fetchPrivateJson('data/schema.json')
    expect(fetchMock.mock.calls[1][1].headers['If-None-Match']).toBe('"e1"')
    expect(r).toEqual({ status: 'ok', data: { a: 1 }, stale: false })
  })

  it('serves the cached copy, marked stale, when offline', async () => {
    setToken('tok')
    fetchMock.mockResolvedValueOnce(res(200, { a: 1 }, { etag: '"e1"' }))
    await fetchPrivateJson('data/schema.json')
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    expect(await fetchPrivateJson('data/schema.json')).toEqual({ status: 'network', data: { a: 1 }, stale: true })
  })

  it('returns network with no data when offline and nothing is cached', async () => {
    setToken('tok')
    fetchMock.mockRejectedValue(new TypeError('offline'))
    expect(await fetchPrivateJson('data/schema.json')).toEqual({ status: 'network', data: null, stale: false })
  })

  it('treats a rate-limited 403 as transient and serves the cache', async () => {
    setToken('tok')
    fetchMock.mockResolvedValueOnce(res(200, { a: 1 }, { etag: '"e1"' }))
    await fetchPrivateJson('data/schema.json')
    fetchMock.mockResolvedValueOnce(res(403, null, { 'x-ratelimit-remaining': '0' }))
    expect(await fetchPrivateJson('data/schema.json')).toEqual({ status: 'network', data: { a: 1 }, stale: true })
  })

  it.each([401, 403])('does not serve the cache after a rejected token (%i)', async code => {
    setToken('tok')
    fetchMock.mockResolvedValueOnce(res(200, { a: 1 }, { etag: '"e1"' }))
    await fetchPrivateJson('data/schema.json')
    fetchMock.mockResolvedValueOnce(res(code))
    expect(await fetchPrivateJson('data/schema.json')).toEqual({ status: 'unauthorized', data: null, stale: false })
  })

  it('reports 404 as not-found and does not serve the cache', async () => {
    setToken('tok')
    fetchMock.mockResolvedValueOnce(res(200, { a: 1 }, { etag: '"e1"' }))
    await fetchPrivateJson('data/schema.json')
    fetchMock.mockResolvedValueOnce(res(404))
    expect(await fetchPrivateJson('data/schema.json')).toEqual({ status: 'not-found', data: null, stale: false })
  })

  it('keeps the cache out of the matracet: export namespace', async () => {
    setToken('tok')
    fetchMock.mockResolvedValue(res(200, { a: 1 }, { etag: '"e1"' }))
    await fetchPrivateJson('data/schema.json')
    expect(storage.keys().filter(k => k.startsWith('matracet:') && k !== 'matracet:sync:token')).toEqual([])
  })

  it('clearPrivateCache removes cached files only', async () => {
    setToken('tok')
    fetchMock.mockResolvedValue(res(200, { a: 1 }))
    await fetchPrivateJson('data/schema.json')
    clearPrivateCache()
    expect(storage.keys()).toEqual(['matracet:sync:token'])
  })
})
