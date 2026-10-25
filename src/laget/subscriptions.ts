import { updatePrivateJson, type UpdateStatus } from '../lib/privateData'

// Läget's push subscriptions live in the private repo as push-subscriptions.json, the same shape
// scripts/send-push.mjs already reads for Matracet: { subscriptions: [{ namn, subscription }] }.
// The app writes its own entry with the device's token, so nobody has to paste a code into a chat
// and the push endpoint never touches the public repo.

export interface StoredSubscription {
  namn: string
  skapad?: string
  subscription: PushSubscriptionJSON
}

export interface SubscriptionsFile {
  subscriptions: StoredSubscription[]
}

export const SUBSCRIPTIONS_PATH = 'push-subscriptions.json'

/** Adds a device's subscription, replacing an older entry for the same endpoint (re-subscribing
 *  on one phone must not leave a dead duplicate behind). Pure. */
export function withSubscription(
  file: SubscriptionsFile | null,
  subscription: PushSubscriptionJSON,
  namn: string,
  today: string,
): SubscriptionsFile {
  const others = (file?.subscriptions ?? []).filter(s => s.subscription.endpoint !== subscription.endpoint)
  return { subscriptions: [...others, { namn, skapad: today, subscription }] }
}

export function saveLagetSubscription(subscription: PushSubscriptionJSON, namn = 'telefon'): Promise<UpdateStatus> {
  const today = new Date().toISOString().slice(0, 10)
  return updatePrivateJson<SubscriptionsFile>(
    SUBSCRIPTIONS_PATH,
    current => withSubscription(current, subscription, namn, today),
    `Läget: notiser på för ${namn}`,
  )
}
