#!/usr/bin/env node
/**
 * Phase 4 of the GitHub-backed auto-sync plan (see CLAUDE.md's "GitHub-backed auto-sync"
 * section) — deterministic merge of sync/state.json (the device-sync branch's snapshot) into
 * canonical public/data/ files on main. The feedback merge is ported from
 * .claude/skills/sync-local-storage/SKILL.md's rule (read that file first — it's the spec
 * this mirrors), upgraded to compare each entry's own `updatedAt` instead of "trust the
 * paste": a one-off human paste can safely assume it's the freshest data, but a recurring
 * automated merge can't make that assumption, and the schema already carries real
 * timestamps to compare instead.
 *
 * Deliberately narrow in scope for now: only matracet:feedback:v1 has a canonical merge
 * target implemented here. Every other synced store key (weekplan, shopping list, stash,
 * chaos-mode, category-feedback) is skipped untouched and logged, not silently dropped —
 * see "Still open" in CLAUDE.md's GitHub-backed auto-sync section for why each is out of
 * scope (weekplan/shopping/stash/chaos-mode have no git-tracked canonical file to merge
 * into at all; category-feedback's mechanical merge, per
 * .claude/skills/sync-category-feedback/SKILL.md's step 2, is real well-specified follow-up
 * work intentionally left for its own pass rather than rushed into this one).
 *
 * Usage:
 *   node scripts/merge-device-sync.mjs <snapshot.json>
 *
 * Exits non-zero and writes nothing on any schema-version mismatch or unparseable
 * snapshot — the one hard requirement (per the plan's Phase 4 critique gate) before the
 * scheduled workflow is ever allowed to run unattended.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

export const FEEDBACK_PATH = new URL('../public/data/feedback.json', import.meta.url).pathname
export const FEEDBACK_KEY = 'matracet:feedback:v1'

/** Throws on anything that isn't a well-formed v1 snapshot — never returns a partial/best-
 * guess result. This is the one thing standing between a malformed snapshot and a bad
 * commit to main, so it must fail loudly rather than coerce. */
export function loadSnapshot(raw) {
  let snapshot
  if (typeof raw === 'string') {
    try {
      snapshot = JSON.parse(raw)
    } catch {
      throw new Error('unparseable snapshot: not valid JSON')
    }
  } else {
    snapshot = raw
  }
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('unparseable snapshot: not an object')
  }
  if (snapshot.version !== 1) {
    throw new Error(`schema-version mismatch: expected 1, got ${JSON.stringify(snapshot.version)}`)
  }
  if (!snapshot.stores || typeof snapshot.stores !== 'object' || Array.isArray(snapshot.stores)) {
    throw new Error('unparseable snapshot: missing or malformed "stores"')
  }
  return snapshot
}

/**
 * Merge an incoming feedback store (matracet:feedback:v1's `data`) into the canonical
 * feedback.json shape, per (recipeId, personId) — never a whole-file overwrite:
 *   - Newer `updatedAt` wins per person entry (strictly newer — a tie keeps the existing
 *     entry unchanged, which is what makes re-running this idempotent).
 *   - `excludeFromWeekPlan` is an OR: a `true` from either side wins, so a stale sync can
 *     never silently clear an exclusion someone set.
 *   - A recipeId or person entry absent from the incoming snapshot is left exactly as-is —
 *     additive/overwriting per entry, never a sync-mirror that could delete data.
 *
 * PR #83 review note: the very first live run against a real snapshot will very likely
 * report `changed: true` (and commit) even when nothing semantically changed — every touched
 * record gets rebuilt with `excludeFromWeekPlan` coerced from possibly-absent to an explicit
 * `false`/`true`, so a record that never had that field at all now does. This is a one-time
 * shape-normalization artifact, not a bug: the merge is still idempotent from the *second*
 * run onward (see merge-device-sync.test.mjs's idempotency cases), and no rating data is
 * altered. Called out here so the Phase 4 gate's required first-dispatch diff review isn't
 * spent puzzling over an otherwise-unexplained blanket diff.
 */
export function mergeFeedback(existing, incoming) {
  const result = { ...(existing ?? {}) }
  for (const [recipeId, incomingRecord] of Object.entries(incoming ?? {})) {
    const existingRecord = result[recipeId]
    const personMap = new Map((existingRecord?.persons ?? []).map(p => [p.personId, p]))
    for (const incomingPerson of incomingRecord.persons ?? []) {
      const current = personMap.get(incomingPerson.personId)
      if (!current || incomingPerson.updatedAt > current.updatedAt) {
        personMap.set(incomingPerson.personId, incomingPerson)
      }
    }
    const updatedAt = [existingRecord?.updatedAt, incomingRecord.updatedAt]
      .filter(Boolean)
      .sort()
      .at(-1)
    result[recipeId] = {
      recipeId,
      excludeFromWeekPlan: Boolean(existingRecord?.excludeFromWeekPlan) || Boolean(incomingRecord.excludeFromWeekPlan),
      updatedAt: updatedAt ?? new Date().toISOString(),
      persons: [...personMap.values()],
    }
  }
  return result
}

/** Pure merge orchestration — no filesystem access, so it's directly unit-testable against
 * fixtures. `feedbackFile` is the parsed contents of public/data/feedback.json (or `null`
 * for a from-scratch file). Returns the new file contents, whether anything changed (so the
 * CLI can skip writing/committing a no-op), and which snapshot store keys were skipped. */
export function runMerge(snapshotRaw, feedbackFile) {
  const snapshot = loadSnapshot(snapshotRaw)
  const base = feedbackFile ?? { app: 'matracet', version: 1, feedback: {} }
  const existingFeedback = base.feedback ?? base

  let feedback = existingFeedback
  const feedbackEntry = snapshot.stores[FEEDBACK_KEY]
  if (feedbackEntry) {
    feedback = mergeFeedback(existingFeedback, feedbackEntry.data)
  }

  const skipped = Object.keys(snapshot.stores).filter(key => key !== FEEDBACK_KEY)
  const changed = JSON.stringify(feedback) !== JSON.stringify(existingFeedback)

  return {
    feedbackFile: { ...base, feedback },
    changed,
    skipped,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const snapshotPath = process.argv[2]
  if (!snapshotPath) {
    console.error('usage: node scripts/merge-device-sync.mjs <snapshot.json>')
    process.exit(1)
  }

  let snapshotRaw
  try {
    snapshotRaw = readFileSync(snapshotPath, 'utf8')
  } catch (err) {
    console.error(`cannot read snapshot file: ${err.message}`)
    process.exit(1)
  }

  const feedbackFile = existsSync(FEEDBACK_PATH) ? JSON.parse(readFileSync(FEEDBACK_PATH, 'utf8')) : null

  let result
  try {
    result = runMerge(snapshotRaw, feedbackFile)
  } catch (err) {
    console.error(`refusing to merge: ${err.message}`)
    process.exit(1)
  }

  console.log(`skipped store keys (no canonical merge target yet): ${result.skipped.join(', ') || '(none)'}`)
  if (!result.changed) {
    console.log('no change — feedback.json already reflects everything newer in this snapshot')
    process.exit(0)
  }
  writeFileSync(FEEDBACK_PATH, JSON.stringify(result.feedbackFile, null, 2) + '\n')
  console.log('wrote public/data/feedback.json')
}
