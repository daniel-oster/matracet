#!/usr/bin/env node
/**
 * Lexicon-replay tool: for every offer in the given files, look it up in
 * public/data/erbjudanden/_kategori-lexikon.json by normalized name+brand. On a hit,
 * apply that verdict (guaranteeing cross-week consistency by construction — the same
 * product always gets the same kategori/form/varutyp, however many weeks it recurs
 * in). On a miss, classify it fresh via kategoriClassify.mjs and add it to the
 * lexicon, so the *next* file that shares the product needs no classification call at
 * all — this is what the design issue's §3.3.4 convergence curve is measuring.
 *
 * `kategori_kalla: 'manuell'` is a lock, both ways: an offer already marked 'manuell'
 * is never overwritten by a lexicon/rule verdict (see erbjudanden-lexikon.mjs's
 * applyLexikonEntry), and a lexicon entry itself marked 'manuell' is only replaced by
 * passing `--force` (not exposed here — that's sync-category-feedback's job, the one
 * legitimate path for a human correction to update the lexicon).
 *
 * This replaced an older version that carried its own hand-copied keyword lists (a
 * second classifier parallel to guessKategori's) — see CLAUDE.md's repeated warnings
 * about exactly that drift happening more than once. There is now exactly one
 * classifier (src/lib/kategoriClassify.mjs) and one product-identity store (the
 * lexicon); this script is a thin orchestrator over both, not a third source of
 * category knowledge.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { classify } from './erbjudanden-lib.mjs'
import { loadLexikon, saveLexikon, lookupLexikon, upsertLexikon, applyLexikonEntry } from './erbjudanden-lexikon.mjs'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node erbjudanden-recategorize.mjs <file.json> [...]')
  process.exit(1)
}

const lexikon = loadLexikon()
const counts = {}
let changed = 0
let lexHits = 0
let lexNew = 0
let total = 0
let ovrigt = 0

for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  for (const o of data.erbjudanden) {
    total++
    const before = o.kategori
    let entry = lookupLexikon(lexikon, o.namn, o.marke)
    if (entry) {
      lexHits++
    } else {
      const cls = classify(o.namn, o.marke, o.notering ?? '')
      entry = { kategori: cls.kategori, form: cls.form, varutyp: cls.varutyp, markeringar: cls.markeringar, confidence: cls.confidence, kalla: cls.kategori_kalla }
      upsertLexikon(lexikon, o.namn, o.marke, entry)
      lexNew++
    }
    applyLexikonEntry(o, entry)
    counts[o.kategori] = (counts[o.kategori] ?? 0) + 1
    if (o.kategori === 'ovrigt') ovrigt++
    if (o.kategori !== before) changed++
  }
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

saveLexikon(lexikon)

console.log(`files: ${files.length}, offers: ${total}, reassigned: ${changed}`)
console.log(`lexicon: ${lexHits} hits, ${lexNew} new entries, ${Object.keys(lexikon).length} total keys`)
console.log(`ovrigt: ${ovrigt} (${((ovrigt / total) * 100).toFixed(1)}%)`)
console.log(counts)
