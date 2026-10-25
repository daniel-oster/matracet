// Web push for the home-screen app (see CLAUDE.md, "Push notifications").
//
// The subscription can't reach GitHub on its own (no backend, and the sync token is
// optional), so the app shows it as a copyable code that's pasted into a Claude Code
// chat once; Claude commits it to push-subscriptions.json, which the offers workflow
// reads when it has something worth a notification.

/** VAPID public key. The matching private key lives only in the VAPID_PRIVATE_KEY
 *  GitHub secret — never in the repo, since it is what lets someone send a push. */
export const VAPID_PUBLIC_KEY =
  'BEc5FoKOWuVANmRj0uD11MuIbR83_UXcSsFPRiLQEVDf88ForiPyiWoWXJH3P0bbkgNQV0ZosvwwQYknnj78UIo'

/** Where an app's service worker lives. Matracet and Läget are separate home-screen apps from one
 *  codebase, each with its own worker, scope and therefore its own push subscription. */
export interface PushApp {
  swUrl: string
  scope: string
}

const BASE = import.meta.env.BASE_URL
export const MATRACET_PUSH: PushApp = { swUrl: `${BASE}sw.js`, scope: BASE }
export const LAGET_PUSH: PushApp = { swUrl: `${BASE}laget/sw.js`, scope: `${BASE}laget/` }

export type PushSupport = 'ok' | 'not-installed' | 'unsupported'

/** iOS only allows web push from an app opened from the home screen (standalone). */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function pushSupport(): PushSupport {
  const hasApis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (hasApis) return 'ok'
  // iOS Safari only exposes PushManager inside the installed home-screen app.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !isStandalone() ? 'not-installed' : 'unsupported'
}

export function registerServiceWorker(app: PushApp = MATRACET_PUSH): void {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register(app.swUrl, { scope: app.scope }).catch(err => {
    console.warn('[matracet push] service worker registration failed', err)
  })
}

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const buf = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buf
}

export async function currentSubscription(app: PushApp = MATRACET_PUSH): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null
  const reg = await navigator.serviceWorker.getRegistration(app.scope)
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Must be called from a tap (iOS rejects a permission prompt that isn't user-initiated). */
export async function subscribe(app: PushApp = MATRACET_PUSH): Promise<PushSubscription> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notiser nekades')
  const reg = await navigator.serviceWorker.register(app.swUrl, { scope: app.scope })
  await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
  })
}

/** The code the user pastes into a Claude chat — a labelled, self-describing JSON blob. */
export function subscriptionCode(sub: PushSubscription): string {
  return JSON.stringify({ matracetPush: 1, skapad: new Date().toISOString().slice(0, 10), subscription: sub.toJSON() })
}
