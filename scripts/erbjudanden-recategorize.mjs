#!/usr/bin/env node
/**
 * One-off migration: reclassifies every offer's `kategori` field via the live
 * `guessKategori` classifier in erbjudanden-lib.mjs.
 *
 * This used to carry its own hand-copied keyword lists (a parallel classifier
 * to guessKategori's), which is exactly the "the two classifiers' keyword
 * lists can silently drift apart" trap CLAUDE.md warns about — the two did
 * drift, more than once. Reduced to a thin wrapper around the real
 * classifier so there is only one place to update keyword lists going
 * forward. The one bit of logic that doesn't belong in guessKategori itself
 * (because it depends on the *old* `kategori`, not just the name) is kept
 * here: `snacks_godis` is trusted as-is from the pre-migration data when the
 * new classifier can't otherwise place it, since spot-checking showed it
 * clean (brand-name candy no keyword list would catch, e.g. "Ahlgrens
 * bilar") — see erbjudanden-lib.mjs's module comment for the category list.
 * Not meant to be re-run automatically on new weeks; new weeks get
 * classified at import time by the erbjudanden-parse-*.mjs scripts, which
 * already call guessKategori directly.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { guessKategori } from './erbjudanden-lib.mjs'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node erbjudanden-recategorize.mjs <file.json> [...]')
  process.exit(1)
}

function classify(o) {
  const guess = guessKategori(o.namn ?? '', o.marke ?? '')
  if (guess !== 'ovrigt') return guess
  // Old kategori is only trusted here — its keyword-guess parser proved
  // reliable for candy brand names but not for anything guessKategori itself
  // already covers (see header).
  return o.kategori === 'snacks_godis' ? 'snacks_godis' : 'ovrigt'
}

const counts = {}
let changed = 0
let total = 0

for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  for (const o of data.erbjudanden) {
    total++
    const next = classify(o)
    counts[next] = (counts[next] ?? 0) + 1
    if (next !== o.kategori) changed++
    o.kategori = next
  }
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

console.log(`files: ${files.length}, offers: ${total}, reassigned: ${changed}`)
console.log(counts)
