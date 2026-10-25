/**
 * laget-notiser — sends Läget's morning/afternoon notifications. Run every 30 minutes by
 * notiser.yml in the private repo daniel-oster/livet-data, which checks this repo out and points
 * --data at its own checkout.
 *
 *   VAPID_PRIVATE_KEY=… npx tsx scripts/laget-notiser.ts --data <livet-data>
 *   npx tsx scripts/laget-notiser.ts --data <livet-data> --now 2026-11-04T05:45:00Z --dry-run
 *
 * What is due is decided by src/laget/notiser.ts (pure, tested). This script only reads the data
 * files, sends with scripts/lib/push-send.mjs and — only if something was actually delivered —
 * rewrites data/notislogg.json, which the workflow then commits. --dry-run prints and writes nothing.
 * Exit code is 0 unless the key is malformed or a file is unreadable; a failed delivery to one
 * phone never fails the job (it is reported in the log).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_INSTALLNINGAR, dueNotifications, recordSent, type Installningar, type NotisLogg } from '../src/laget/notiser.ts'
import type { LagetData, KlartMap, LagetEvent, Todo } from '../src/laget/types.ts'
import type { Period, PresenceStore } from '../src/presence/types.ts'
import { configureVapid, normalizePrivateKey, privateKeyProblem, readPublicKey, sendToAll } from './lib/push-send.mjs'
import { validatePeriods, validateSchema } from '../src/presence/validate.ts'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const value = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)

const dir = value('--data')
if (!dir) {
  console.error('usage: laget-notiser.ts --data <livet-data-dir> [--now <ISO>] [--dry-run]')
  process.exit(2)
}
const dryRun = flag('--dry-run')
const now = value('--now') ? new Date(value('--now')!) : new Date()
if (Number.isNaN(now.getTime())) {
  console.error('--now är inget giltigt datum')
  process.exit(2)
}

const path = (f: string) => resolve(dir, f)
const readJson = <T>(f: string, fallback: T): T => (existsSync(path(f)) ? (JSON.parse(readFileSync(path(f), 'utf8')) as T) : fallback)

const schema = readJson<PresenceStore | null>('data/schema.json', null)
if (!schema) {
  console.error('data/schema.json saknas')
  process.exit(1)
}
const periods = readJson<Period[]>('data/perioder.json', [])
const problems = [...validateSchema(schema), ...validatePeriods(periods, schema)]
if (problems.length) {
  console.error(`Schemat är ogiltigt, skickar inget:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}

const data: LagetData = {
  schema,
  periods,
  events: readJson<LagetEvent[]>('data/handelser.json', []),
  todos: readJson<Todo[]>('data/attgora.json', []),
  klart: readJson<KlartMap>('data/klart.json', {}),
}
const settings = readJson<Installningar>('data/installningar.json', DEFAULT_INSTALLNINGAR)
const log = readJson<NotisLogg>('data/notislogg.json', { skickade: [] })

const due = dueNotifications(now, data, settings, log)
if (due.length === 0) {
  console.log(`${now.toISOString()}: inget att skicka.`)
  process.exit(0)
}

if (dryRun) {
  for (const n of due) console.log(`[dry-run] ${n.title}: ${n.body}  →  ${n.url}`)
  process.exit(0)
}

const privateKey = normalizePrivateKey(process.env.VAPID_PRIVATE_KEY)
const publicKey = readPublicKey(new URL('../src/lib/push.ts', import.meta.url))
if (!privateKey) {
  console.log('VAPID_PRIVATE_KEY saknas — ingen notis skickad.')
  process.exit(0)
}
if (!publicKey) throw new Error('Hittade inte VAPID_PUBLIC_KEY i src/lib/push.ts')
const problem = privateKeyProblem(privateKey)
if (problem) {
  console.error(problem)
  process.exit(1)
}
configureVapid(publicKey, privateKey)

const { subscriptions } = readJson<{ subscriptions: { namn: string; subscription: unknown }[] }>('push-subscriptions.json', { subscriptions: [] })
if (subscriptions.length === 0) {
  console.log('Inga prenumerationer i push-subscriptions.json — inget skickat, inget loggat.')
  process.exit(0)
}

const delivered: string[] = []
for (const n of due) {
  const { ok, total, lines } = await sendToAll(subscriptions, { title: n.title, body: n.body, url: n.url, tag: n.tag })
  for (const line of lines) console.log(line)
  console.log(`${ok} av ${total}: ${n.title} – ${n.body}`)
  // Logged once at least one phone got it; a notification nobody received is retried next run.
  if (ok > 0) delivered.push(n.key)
}
if (delivered.length > 0) writeFileSync(path('data/notislogg.json'), JSON.stringify(recordSent(log, delivered, now), null, 2) + '\n')
