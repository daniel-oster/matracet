// Fires the Läget-inkorg routine (Claude Code scheduled task with an API trigger).
// https://code.claude.com/docs/en/routines — POST <fire URL> with the task's bearer token; the body's
// `text` reaches the session wrapped in a <routine-fire-payload> block that marks it as untrusted
// data, which is why the routine's saved prompt has to say that the block is what to act on.
// Research-preview API: if the beta header version changes, this is the one place to update.

export const BETA_HEADER = 'experimental-cc-routine-2026-04-01'

/** Returns { ok, status, session } — never throws; a failed fire is reported, not fatal. */
export async function fireRoutine({ url, token, text, fetchImpl = fetch }) {
  if (!url || !token) return { ok: false, status: 0, error: 'LAGET_ROUTINE_URL/TOKEN saknas' }
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': BETA_HEADER,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` }
    const body = await res.json().catch(() => ({}))
    return { ok: true, status: res.status, session: body.claude_code_session_url ?? null }
  } catch (err) {
    return { ok: false, status: 0, error: err.message }
  }
}
