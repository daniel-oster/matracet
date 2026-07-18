// GitHub-backed auto-sync — Phase 1: pure client for the GitHub Contents API.
// See CLAUDE.md's "Plan: GitHub-backed auto-sync" for the full architecture.
//
// This module only talks to GitHub. It knows nothing about which localStorage
// stores get synced, debouncing, or UI — that's Phase 2/3. Snapshot semantics:
// sync/state.json on the `device-sync` branch always holds the full current
// value of each synced store, last-write-wins (single-device-writer assumption
// — no diffing, no CRDTs).

const REPO_OWNER = 'daniel-oster'
const REPO_NAME = 'matracet'
const SYNC_BRANCH = 'device-sync'
const SYNC_PATH = 'sync/state.json'
const TOKEN_KEY = 'matracet:sync:token'
const API_BASE = 'https://api.github.com'

export interface SyncState {
  version: 1
  deviceId: string
  updatedAt: string
  stores: Record<string, { updatedAt: string; data: unknown }>
}

export type SyncStatus =
  | 'ok'
  | 'no-token'
  | 'unauthorized'
  | 'network'
  | 'conflict-exhausted'
  | 'not-found'

export interface FetchStateResult {
  status: SyncStatus
  state: SyncState | null
  sha: string | null
}

export interface PushStateResult {
  status: SyncStatus
  sha: string | null
}

// --- Token accessor. Deliberately outside the synced stores — never sync the token itself. ---

export function getToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(TOKEN_KEY)
  return raw && raw.trim() ? raw.trim() : null
}

export function setToken(token: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token.trim())
}

export function clearToken(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
}

function contentsUrl(): string {
  return `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SYNC_PATH}?ref=${SYNC_BRANCH}`
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

/** GitHub returns 403 both for a bad/expired token AND for rate-limiting (primary or
 * secondary) — conflating them as 'unauthorized' would tell a merely-rate-limited user their
 * token is broken, the one diagnosis that sends them off to regenerate a perfectly good PAT
 * for no reason (PR #83 review fix). A rate-limited response carries `x-ratelimit-remaining:
 * 0` (primary) or a `retry-after` header (secondary/abuse detection); classify only those as
 * the retryable 'network' status, everything else 403 as genuinely 'unauthorized'. */
function classifyAuthFailure(res: Response): 'unauthorized' | 'network' {
  if (res.status === 401) return 'unauthorized'
  if (res.headers.get('x-ratelimit-remaining') === '0' || res.headers.get('retry-after')) {
    return 'network'
  }
  return 'unauthorized'
}

/** UTF-8-safe base64 encode — bare `btoa` throws on non-Latin1 text (e.g. "Grönkålspaj"). */
function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** Inverse of encodeBase64. GitHub returns base64 content wrapped at 60 chars/line. */
function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** Serialize with sorted store keys so an unchanged snapshot re-serializes byte-identical
 * (lets a caller skip a push when nothing actually changed) and so diffs on GitHub stay
 * readable — a hard requirement from the plan's "one file, not a file tree" decision. */
export function serializeState(state: SyncState): string {
  const sortedStores: SyncState['stores'] = {}
  for (const key of Object.keys(state.stores).sort()) {
    sortedStores[key] = state.stores[key]
  }
  return JSON.stringify({ ...state, stores: sortedStores }, null, 2)
}

export async function fetchState(): Promise<FetchStateResult> {
  const token = getToken()
  if (!token) return { status: 'no-token', state: null, sha: null }

  let res: Response
  try {
    res = await fetch(contentsUrl(), { headers: authHeaders(token) })
  } catch {
    return { status: 'network', state: null, sha: null }
  }

  if (res.status === 404) return { status: 'not-found', state: null, sha: null }
  if (res.status === 401 || res.status === 403) return { status: classifyAuthFailure(res), state: null, sha: null }
  if (!res.ok) return { status: 'network', state: null, sha: null }

  try {
    const body = (await res.json()) as { content: string; sha: string }
    const state = JSON.parse(decodeBase64(body.content)) as SyncState
    return { status: 'ok', state, sha: body.sha }
  } catch {
    return { status: 'network', state: null, sha: null }
  }
}

// Chrome enforces a ~64KB total-request cap for `fetch(..., { keepalive: true })` (the same
// limit `navigator.sendBeacon` has, since keepalive uses the same transport) — warn well
// before a real snapshot could hit it, since weekplan + shopping list + sync tasks will only
// grow. Comparing against the base64 content specifically, not the full JSON body, is a
// deliberately conservative (i.e. early) proxy — the real body is that plus a small amount of
// envelope JSON around it.
const KEEPALIVE_WARN_THRESHOLD = 48_000

async function putOnce(token: string, state: SyncState, sha: string | null): Promise<Response | null> {
  const content = encodeBase64(serializeState(state))
  if (content.length > KEEPALIVE_WARN_THRESHOLD) {
    console.warn(
      `[matracet sync] snapshot is ${content.length} bytes (base64) — approaching the ~64KB ` +
      'limit for a keepalive push, which the visibilitychange-hidden flush relies on to ' +
      'survive the tab being backgrounded.',
    )
  }
  const payload: Record<string, unknown> = {
    message: `sync: update device state (${state.deviceId} @ ${state.updatedAt})`,
    content,
    branch: SYNC_BRANCH,
  }
  if (sha) payload.sha = sha

  try {
    return await fetch(contentsUrl(), {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // A background-tab flush (visibilitychange → hidden) is exactly when mobile browsers
      // are most likely to freeze/kill an in-flight request — keepalive lets it survive page
      // teardown the same way navigator.sendBeacon does (PR #83 review fix).
      keepalive: true,
    })
  } catch {
    return null
  }
}

/**
 * Push a snapshot. `knownSha` lets a caller that already holds a fresh sha (e.g. from the
 * last fetchState/pushState) skip a discovery GET — pass `undefined` to always discover,
 * or `null` explicitly to mean "known not to exist yet, create it".
 *
 * Conflict handling: a 409 means the branch changed since our sha was read (the device
 * racing itself — the merge Action never writes this branch, only reads it, per the
 * plan's architecture). On 409 we re-fetch the sha once and retry once more; a second
 * 409 returns 'conflict-exhausted' rather than looping — under the single-writer
 * assumption a repeat conflict signals something genuinely wrong, not a transient race.
 */
export async function pushState(state: SyncState, knownSha?: string | null): Promise<PushStateResult> {
  const token = getToken()
  if (!token) return { status: 'no-token', sha: null }

  let sha: string | null
  if (knownSha === undefined) {
    const current = await fetchState()
    if (current.status === 'unauthorized') return { status: 'unauthorized', sha: null }
    if (current.status === 'network') return { status: 'network', sha: null }
    sha = current.status === 'ok' ? current.sha : null
  } else {
    sha = knownSha
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await putOnce(token, state, sha)
    if (!res) return { status: 'network', sha: null }

    if (res.status === 200 || res.status === 201) {
      try {
        const body = (await res.json()) as { content: { sha: string } }
        return { status: 'ok', sha: body.content.sha }
      } catch {
        return { status: 'ok', sha: null }
      }
    }

    if (res.status === 401 || res.status === 403) return { status: classifyAuthFailure(res), sha: null }

    if (res.status === 409) {
      if (attempt === 1) break // no attempts left — don't spend a call re-fetching for nothing
      const fresh = await fetchState()
      if (fresh.status !== 'ok') return { status: 'conflict-exhausted', sha: null }
      sha = fresh.sha
      continue
    }

    return { status: 'network', sha: null }
  }

  return { status: 'conflict-exhausted', sha: null }
}
