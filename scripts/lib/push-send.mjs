// Shared web-push sending, used by scripts/send-push.mjs (Matracet's offer notifications, run in
// this repo) and scripts/laget-notiser.ts (Läget's notifications, run from livet-data's
// notiser.yml, which checks this repo out). One place for key handling and per-subscription
// reporting so the two can't drift.

import { readFileSync } from 'node:fs'
import webpush from 'web-push'

/** Tolerate what a pasted GitHub secret usually picks up: whitespace/newlines and wrapping
 *  quotes or backticks. A real VAPID private key is 43 base64url chars (32 bytes). */
export function normalizePrivateKey(raw) {
  return (raw ?? '').replace(/\s+/g, '').replace(/^[`'"]+|[`'"]+$/g, '')
}

/** The VAPID public key is committed in src/lib/push.ts (one source for app and senders). */
export function readPublicKey(pushTsUrl) {
  return readFileSync(pushTsUrl, 'utf8').match(/'(B[\w-]{80,})'/)?.[1]
}

/** null when fine, otherwise a message that never contains the key itself. */
export function privateKeyProblem(privateKey) {
  if (Buffer.from(privateKey, 'base64url').length === 32) return null
  return `VAPID_PRIVATE_KEY har fel längd (${privateKey.length} tecken, väntat 43). Klistra in den igen i repots Actions-secrets.`
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
