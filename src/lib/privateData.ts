// Read-only client for the private data repo (daniel-oster/livet-data), see
// docs/laget-spec-2026-10.md ("Integritet"). Same token as the device-sync client
// (githubSync.ts), same Contents API, but a different repo: the schedule, periods and
// everything else personal lives there, never in this public repo.
//
// Every file is cached on the device together with its ETag. A conditional request that
// answers 304 doesn't count against the rate limit, and the cache is also the offline
// fallback — a flaky connection serves the last copy (`stale: true`) instead of nothing.
// The cache is deliberately NOT under the `matracet:` prefix: exportData.ts dumps every
// `matracet:*` key into the manual export file, and private data shouldn't end up in it.

import { classifyAuthFailure, decodeBase64, encodeBase64, getToken } from './githubSync'

const OWNER = 'daniel-oster'
const REPO = 'livet-data'
const API_BASE = 'https://api.github.com'
const CACHE_PREFIX = 'private-cache:v1:'

export type PrivateStatus = 'ok' | 'no-token' | 'unauthorized' | 'network' | 'not-found'

export interface PrivateResult<T> {
  status: PrivateStatus
  /** null when there is nothing to show (no token, unauthorized, not found, or offline with no cache). */
  data: T | null
  /** true when `data` is the cached copy because the network request failed. */
  stale: boolean
}

interface CacheEntry {
  etag: string | null
  data: unknown
}

function readCache(path: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + path)
    return raw ? (JSON.parse(raw) as CacheEntry) : null
  } catch {
    return null
  }
}

function writeCache(path: string, entry: CacheEntry): void {
  try {
    localStorage.setItem(CACHE_PREFIX + path, JSON.stringify(entry))
  } catch {
    // Quota or private mode: the cache is an optimisation, never a requirement.
  }
}

/** Drop every cached private file — call when the token is removed. */
export function clearPrivateCache(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function fileUrl(path: string, ref?: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  const base = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encoded}`
  return ref ? `${base}?ref=${encodeURIComponent(ref)}` : base
}

/**
 * Fetch and parse one JSON file from livet-data (default branch unless `ref` is given).
 * Never throws: failures come back as a status, with the cached copy when one exists and
 * the failure is transient. A missing token, a rejected token or a deleted file never serve
 * the cache — an old copy of private data must not outlive its access.
 */
export async function fetchPrivateJson<T>(path: string, ref?: string): Promise<PrivateResult<T>> {
  const token = getToken()
  if (!token) return { status: 'no-token', data: null, stale: false }

  const cached = readCache(path)
  const fallback = (status: PrivateStatus): PrivateResult<T> =>
    cached ? { status, data: cached.data as T, stale: true } : { status, data: null, stale: false }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.raw+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (cached?.etag) headers['If-None-Match'] = cached.etag

  let res: Response
  try {
    // no-store: the browser's own HTTP cache must not answer (or add validators) on our behalf.
    res = await fetch(fileUrl(path, ref), { headers, cache: 'no-store' })
  } catch {
    return fallback('network')
  }

  if (res.status === 304 && cached) return { status: 'ok', data: cached.data as T, stale: false }
  if (res.status === 404) return { status: 'not-found', data: null, stale: false }
  if (res.status === 401 || res.status === 403) {
    const kind = classifyAuthFailure(res)
    return kind === 'network' ? fallback('network') : { status: 'unauthorized', data: null, stale: false }
  }
  if (!res.ok) return fallback('network')

  try {
    const data = (await res.json()) as T
    writeCache(path, { etag: res.headers.get('etag'), data })
    return { status: 'ok', data, stale: false }
  } catch {
    return fallback('network')
  }
}

export type UpdateStatus = 'ok' | 'no-token' | 'unauthorized' | 'network' | 'conflict'

/**
 * Read–modify–write one JSON file in livet-data through the Contents API. `update` gets the
 * current value (null when the file doesn't exist yet) and returns the new one; returning the
 * same reference means "nothing to change" and skips the write. A 409 (the file changed since we
 * read it — another device, or a workflow) re-reads and retries once, so `update` must be safe to
 * run again on fresher data; a second conflict is reported rather than looped on.
 */
export async function updatePrivateJson<T>(
  path: string,
  update: (current: T | null) => T,
  message: string,
  ref?: string,
): Promise<UpdateStatus> {
  const token = getToken()
  if (!token) return 'no-token'
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    let current: T | null = null
    let sha: string | undefined
    try {
      const res = await fetch(fileUrl(path, ref), { headers, cache: 'no-store' })
      if (res.status === 401 || res.status === 403) {
        return classifyAuthFailure(res) === 'network' ? 'network' : 'unauthorized'
      }
      if (res.ok) {
        const body = (await res.json()) as { content: string; sha: string }
        current = JSON.parse(decodeBase64(body.content)) as T
        sha = body.sha
      } else if (res.status !== 404) {
        return 'network'
      }
    } catch {
      return 'network'
    }

    const next = update(current)
    if (next === current) return 'ok'

    const payload: Record<string, unknown> = {
      message,
      content: encodeBase64(JSON.stringify(next, null, 2) + '\n'),
    }
    if (sha) payload.sha = sha
    if (ref) payload.branch = ref

    let put: Response
    try {
      put = await fetch(fileUrl(path), { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } catch {
      return 'network'
    }
    if (put.status === 200 || put.status === 201) {
      writeCache(path, { etag: null, data: next })
      return 'ok'
    }
    if (put.status === 401 || put.status === 403) return classifyAuthFailure(put) === 'network' ? 'network' : 'unauthorized'
    // 409 = stale sha; 422 = "sha wasn't supplied" when the file appeared since our 404. Re-read once.
    if (put.status === 409 || put.status === 422) continue
    return 'network'
  }
  return 'conflict'
}
