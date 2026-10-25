import { stockholmNow } from './time'

// The inbox: one JSON file per message in livet-data/inkorg/, created by the app with the device's
// token and processed by a Claude routine (see docs/laget-spec-2026-10.md, "Inkorgen"). One file per
// message means two writers never conflict. Pure helpers only — the I/O is in useLagetData.

export type InkorgStatus = 'ny' | 'klar' | 'oklar' | 'fel'

export interface InkorgMeddelande {
  id: string
  sent: string
  text: string
  /** Repo path of an attached photo (`inkorg/bilder/<id>.jpg`), e.g. the school's weekly letter. */
  image?: string
  status: InkorgStatus
  /** Claude's short answer: what was added, or — when status is `oklar` — a question. */
  reply?: string
  changes?: { file: string; id: string; op: string }[]
  processedAt?: string
}

export const MAX_TEXT = 2000

/** `i-20261025-0931-x7k`: Stockholm date and time, then three random characters. Sorts by time. */
export function newMessageId(now: Date, rand: () => number = Math.random): string {
  const { date, time } = stockholmNow(now)
  const suffix = Array.from({ length: 3 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rand() * 36)]).join('')
  return `i-${date.replace(/-/g, '')}-${time.replace(':', '')}-${suffix}`
}

/** Where an attached photo lives. Under a subfolder so the inbox listing (top-level files) and the
 *  job that looks for new `inkorg/<id>.json` messages never mistake a photo for a message. */
export function imagePath(id: string): string {
  return `inkorg/bilder/${id}.jpg`
}

/** A photo sent with no words still needs something for the answer line and for Claude to go on. */
export const PHOTO_ONLY_TEXT = 'Foto, se bilden'

/** The message to store, or null for an empty one. Over-long text is refused rather than cut. With a
 *  photo the text may be empty: the photo is the message. */
export function newMessage(text: string, now: Date, rand?: () => number, withImage = false): InkorgMeddelande | null {
  const t = text.trim() || (withImage ? PHOTO_ONLY_TEXT : '')
  if (!t || t.length > MAX_TEXT) return null
  const id = newMessageId(now, rand)
  return { id, sent: now.toISOString(), text: t, ...(withImage ? { image: imagePath(id) } : {}), status: 'ny' }
}

/** The longest side of an uploaded photo. Enough to read a printed letter, small enough (a few hundred
 *  kB as JPEG) to keep the data repo light and the upload quick on a phone connection. */
export const MAX_IMAGE_SIDE = 1600

/** Width and height scaled down to fit `max` on the longer side; never scaled up. */
export function scaledSize(width: number, height: number, max = MAX_IMAGE_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const k = max / longest
  return { width: Math.round(width * k), height: Math.round(height * k) }
}

/** The `n` newest, newest first. Ids start with their timestamp, so the id is the order. */
export function latestMessages(messages: InkorgMeddelande[], n = 3): InkorgMeddelande[] {
  return [...messages].sort((a, b) => b.id.localeCompare(a.id)).slice(0, n)
}

/** Messages still `ny` after `minutes` — the safety net re-fires them. */
export function staleNew(messages: InkorgMeddelande[], now: Date, minutes = 15): InkorgMeddelande[] {
  const cutoff = now.getTime() - minutes * 60_000
  return messages.filter(m => m.status === 'ny' && Date.parse(m.sent) <= cutoff)
}

/** The line under the text field: sent / added / unclear / failed. */
export function statusLine(m: InkorgMeddelande): string {
  switch (m.status) {
    case 'ny':
      return `Skickat: ${m.image ? '📷 ' : ''}${m.text}`
    case 'klar': {
      const reply = (m.reply ?? '').trim()
      return /^inlagt/i.test(reply) ? reply : `Inlagt: ${reply || m.text}`
    }
    case 'oklar':
      return `Oklart: ${(m.reply ?? '').trim() || 'jag förstod inte – skriv gärna om det'}`
    case 'fel':
      return `Gick inte: ${(m.reply ?? '').trim() || 'kunde inte behandlas'}`
  }
}
