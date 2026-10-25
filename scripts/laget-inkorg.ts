/**
 * laget-inkorg — the inbox's workflow glue. Run from livet-data's workflows, which check this repo
 * out and point --data at their own checkout.
 *
 *   # inkorg.yml, on a push that touched inkorg/**:
 *   LAGET_ROUTINE_URL=… LAGET_ROUTINE_TOKEN=… VAPID_PRIVATE_KEY=… \
 *     npx tsx scripts/laget-inkorg.ts --data <livet-data> --mode push --before <sha> --after <sha>
 *
 *   # notiser.yml, every 30 minutes (the safety net):
 *   … npx tsx scripts/laget-inkorg.ts --data <livet-data> --mode stale
 *
 * push:  a new message (still `ny`) wakes the routine; one that was `ny` and has been answered
 *        (klar/oklar/fel) sends the confirmation push. Claude's own commit flips ny → klar, which
 *        classifyChange never treats as a reason to fire again, so there is no loop.
 * stale: a message still `ny` after 15 minutes is re-fired (at most twice, recorded in
 *        data/notislogg.json); after that it is marked `fel` and the sender is told.
 *
 * Without the routine secrets nothing is fired (the files just wait in inkorg/); without the VAPID
 * key nothing is pushed. --dry-run prints and changes nothing. A failed fire never fails the job.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { classifyChange, confirmNotis, fireLogCutoff, gaveUp, planStale } from '../src/laget/inkorgJobb.ts'
import type { InkorgMeddelande } from '../src/laget/inkorg.ts'
import type { NotisLogg } from '../src/laget/notiser.ts'
import { configureVapid, normalizePrivateKey, privateKeyProblem, readPublicKey, sendToAll } from './lib/push-send.mjs'
import { fireRoutine } from './lib/routine.mjs'

const args = process.argv.slice(2)
const value = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const dir = value('--data')
const mode = value('--mode')
const dryRun = args.includes('--dry-run')
if (!dir || (mode !== 'push' && mode !== 'stale')) {
  console.error('usage: laget-inkorg.ts --data <livet-data> --mode push --before <sha> --after <sha> | --mode stale [--now <ISO>] [--dry-run]')
  process.exit(2)
}
const now = value('--now') ? new Date(value('--now')!) : new Date()
const path = (f: string) => resolve(dir, f)
const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
const parse = (raw: string): InkorgMeddelande | null => {
  try {
    const m = JSON.parse(raw) as InkorgMeddelande
    return m && typeof m.id === 'string' && typeof m.text === 'string' && typeof m.status === 'string' ? m : null
  } catch {
    return null
  }
}

const routineUrl = process.env.LAGET_ROUTINE_URL
const routineToken = process.env.LAGET_ROUTINE_TOKEN

async function fire(m: InkorgMeddelande): Promise<boolean> {
  if (dryRun) {
    console.log(`[dry-run] skulle väcka routinen med: ${m.text}`)
    return true
  }
  const r = await fireRoutine({ url: routineUrl, token: routineToken, text: m.text })
  console.log(r.ok ? `✓ routinen väckt för ${m.id}${r.session ? ` → ${r.session}` : ''}` : `✗ kunde inte väcka routinen för ${m.id}: ${r.error}`)
  return r.ok
}

async function push(notiser: ReturnType<typeof confirmNotis>[]): Promise<void> {
  if (notiser.length === 0) return
  if (dryRun) {
    for (const n of notiser) console.log(`[dry-run] push: ${n.title} – ${n.body}`)
    return
  }
  const privateKey = normalizePrivateKey(process.env.VAPID_PRIVATE_KEY)
  const publicKey = readPublicKey(new URL('../src/lib/push.ts', import.meta.url))
  if (!privateKey || !publicKey) return console.log('VAPID_PRIVATE_KEY saknas — ingen notis skickad.')
  const problem = privateKeyProblem(privateKey)
  if (problem) return console.error(problem)
  configureVapid(publicKey, privateKey)
  const subs = existsSync(path('push-subscriptions.json')) ? (JSON.parse(readFileSync(path('push-subscriptions.json'), 'utf8')).subscriptions ?? []) : []
  if (subs.length === 0) return console.log('Inga prenumerationer — ingen notis skickad.')
  for (const n of notiser) {
    const { ok, total, lines } = await sendToAll(subs, { title: n.title, body: n.body, url: n.url, tag: n.tag })
    for (const l of lines) console.log(l)
    console.log(`${ok} av ${total}: ${n.title} – ${n.body}`)
  }
}

if (mode === 'push') {
  const before = value('--before') ?? ''
  const after = value('--after') ?? 'HEAD'
  const isNewBranch = /^0+$/.test(before) || before === ''
  const names = (isNewBranch ? git('diff-tree', '--no-commit-id', '--name-only', '--diff-filter=AM', '-r', after) : git('diff', '--name-only', '--diff-filter=AM', before, after, '--', 'inkorg/'))
    .split('\n').filter(n => /^inkorg\/[^/]+\.json$/.test(n))
  const confirmations: ReturnType<typeof confirmNotis>[] = []
  for (const name of names) {
    const cur = parse(git('show', `${after}:${name}`))
    if (!cur) { console.log(`${name}: ingen giltig meddelandefil – hoppar över`); continue }
    let prev: InkorgMeddelande | null = null
    if (!isNewBranch) { try { prev = parse(git('show', `${before}:${name}`)) } catch { prev = null } }
    const kind = classifyChange(prev, cur)
    console.log(`${name}: ${prev?.status ?? '(ny fil)'} → ${cur.status}: ${kind ?? 'inget att göra'}`)
    if (kind === 'fire') await fire(cur)
    else if (kind === 'confirm') confirmations.push(confirmNotis(cur))
  }
  await push(confirmations)
} else {
  const files = existsSync(path('inkorg')) ? readdirSync(path('inkorg')).filter(n => n.endsWith('.json')) : []
  const messages = files.map(n => parse(readFileSync(path(`inkorg/${n}`), 'utf8'))).filter((m): m is InkorgMeddelande => m !== null)
  const logPath = path('data/notislogg.json')
  const log: NotisLogg = existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf8')) : { skickade: [] }
  const plan = planStale(messages, log, now)
  if (plan.fire.length === 0 && plan.giveUp.length === 0) {
    console.log(`${now.toISOString()}: ingen inkorgspost att skicka om.`)
    process.exit(0)
  }
  const recorded: string[] = []
  for (const { message, key } of plan.fire) {
    console.log(`${message.id} står kvar som "ny" – skickar om (${key.split('|').pop()}/2)`)
    if (await fire(message)) recorded.push(key)
  }
  const given: ReturnType<typeof confirmNotis>[] = []
  for (const m of plan.giveUp) {
    const failed = gaveUp(m, now)
    console.log(`${m.id}: gav upp efter två omförsök → fel`)
    if (!dryRun) writeFileSync(path(`inkorg/${m.id}.json`), JSON.stringify(failed, null, 2) + '\n')
    // The status change is committed by the workflow; its inkorg.yml run would send this push, but
    // a commit made with GITHUB_TOKEN starts no workflow, so tell the phone directly.
    given.push(confirmNotis(failed))
  }
  if (!dryRun && recorded.length > 0) {
    const cutoff = fireLogCutoff(now)
    const kept = log.skickade.filter(s => s.key.slice(0, 10) >= cutoff)
    const stamp = now.toISOString()
    writeFileSync(logPath, JSON.stringify({ skickade: [...kept, ...recorded.map(key => ({ key, sent: stamp }))] }, null, 2) + '\n')
  }
  await push(given)
}
