// Shared web-push sending, used by scripts/send-push.mjs (Matracet's offer notifications, run in
// this repo) and scripts/laget-notiser.ts (Läget's notifications, run from livet-data's
// notiser.yml, which checks this repo out). One place for key handling and per-subscription
// reporting so the two can't drift.

import { readFileSync } from 'node:fs'
import webpush from 'web-push'

/** Tolerate what a pasted GitHub secret usually picks up: whitespace/newlines, wrapping quotes or
 *  backticks, and a `NAME=` / `"privateKey":` prefix around the key. A real VAPID private key is
 *  43 base64url chars (32 bytes); when the value isn't one but holds exactly one 43-char token
 *  (the public key is 87, so it can't be mistaken for it), that token is the key. */
export function normalizePrivateKey(raw) {
  const cleaned = (raw ?? '').replace(/\s+/g, '').replace(/^[`'"]+|[`'"]+$/g, '')
  if (cleaned.length === 43) return cleaned
  const tokens = cleaned.match(/(?<![\w-])[\w-]{43}(?![\w-])/g)
  return tokens?.length === 1 ? tokens[0] : cleaned
}

/** The VAPID public key is committed in src/lib/push.ts (one source for app and senders). */
export function readPublicKey(pushTsUrl) {
  return readFileSync(pushTsUrl, 'utf8').match(/'(B[\w-]{80,})'/)?.[1]
}

/** null when fine, otherwise a message that never contains the key itself — only its shape. */
export function privateKeyProblem(privateKey) {
  if (Buffer.from(privateKey, 'base64url').length === 32) return null
  const other = (privateKey.match(/[^A-Za-z0-9_-]/g) ?? []).length
  const hint = privateKey.length === 87 && privateKey.startsWith('B')
    ? ' Det ser ut som den PUBLIKA nyckeln – den privata är den andra, 43 tecken.'
    : ''
  return `VAPID_PRIVATE_KEY har fel längd (${privateKey.length} tecken, väntat 43; ${other} tecken utanför A–Z a–z 0–9 - _).${hint} Klistra in den igen i repots Actions-secrets.`
}

/**
 * Send one payload to every subscription. `send` is injectable for tests. A subscription answered
 * with 404/410 has been revoked — it's reported, never deleted, so the files stay hand-maintained.
 * Returns { ok, total, lines } where `lines` is a printable per-subscription report.
 */
export async function sendToAll(subscriptions, payload, { send = (sub, body, opts) => webpush.sendNotification(sub, body, opts) } = {}) {
  let ok = 0
  const lines = []
  for (const { namn, subscription } of subscriptions) {
    try {
      await send(subscription, JSON.stringify(payload), { TTL: 60 * 60 * 24 })
      ok++
      lines.push(`✓ ${namn}`)
    } catch (err) {
      const gone = err.statusCode === 404 || err.statusCode === 410
      lines.push(`✗ ${namn}: ${err.statusCode ?? ''} ${gone ? '(prenumerationen är avslutad — ta bort den)' : err.message}`)
    }
  }
  return { ok, total: subscriptions.length, lines }
}

export function configureVapid(publicKey, privateKey, subject = 'https://daniel-oster.github.io/matracet/') {
  webpush.setVapidDetails(subject, publicKey, privateKey)
}
