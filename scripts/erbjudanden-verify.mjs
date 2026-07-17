#!/usr/bin/env node
/**
 * Deterministic verifier for the erbjudanden taxonomy — the repurposed half of the
 * old regex-classifier's knowledge (see kategoriClassify.mjs's header and the design
 * issue's §3.3.4/§3.5): rules are bad at *generating* a correct category but good at
 * *refuting* a wrong one, so this runs over every offer (however it was classified —
 * rule, model, or human) and hard-fails the import on a real contradiction, without
 * ever having to know the right answer itself.
 *
 * Usage: node scripts/erbjudanden-verify.mjs [file.json ...]   (defaults to every
 * saved week across all three stores)
 *
 * Exit code is non-zero iff any FAIL-level assertion fired.
 */
import { readFileSync, globSync } from 'node:fs'
import { allLeafIds, GROUPS, groupOf } from '../src/lib/kategoriTaxonomy.mjs'
import { NON_FOOD_GATE_RE } from '../src/lib/kategoriClassify.mjs'
import { loadLexikon, normalizeProductKey } from './erbjudanden-lexikon.mjs'

const FORM_VALUES = new Set(['farsk', 'kyld', 'fryst', 'torr', 'konserv', null, undefined])
const LEAF_IDS = new Set(allLeafIds())
const FROZEN_WORD_RE = /frys(?:t|ta|en)?|djupfryst/i
const VEGO_WORD_RE = /vegansk|\bvegan\b|vego\b|\boumph\b|\bquorn\b|vegetarisk/i

let files = process.argv.slice(2)
if (files.length === 0) files = globSync('public/data/erbjudanden/*/2026-W*.json')

const fails = []
const warns = []
function fail(msg) { fails.push(msg) }
function warn(msg) { warns.push(msg) }

// Structural check: no leaf id anywhere leaked "vego"/"vegan" into the category tree
// itself (diet is a markering, never a category — see design issue §3.1b).
for (const leaf of LEAF_IDS) {
  if (/vego|vegan/i.test(leaf)) fail(`taxonomy: leaf id "${leaf}" contains vego/vegan — diet must live in markeringar, not kategori`)
}
for (const g of GROUPS) {
  if (/vego|vegan/i.test(g.id)) fail(`taxonomy: group id "${g.id}" contains vego/vegan`)
}

const lexikon = loadLexikon()
const varutypToKategorier = new Map() // varutyp -> Set<kategori>
const nameToKategorier = new Map() // normalized namn (no brand) -> Map<kategori, Set<store>>

for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const offers = data.erbjudanden ?? []
  let ovrigtCount = 0

  for (const o of offers) {
    const where = `${file}: ${o.namn} | ${o.marke ?? ''}`

    if (!LEAF_IDS.has(o.kategori)) fail(`${where} — kategori "${o.kategori}" is not a valid leaf id`)
    if (!FORM_VALUES.has(o.form)) fail(`${where} — form "${o.form}" is not a valid value`)
    if (o.kategori === 'ovrigt') ovrigtCount++

    const haystack = `${o.namn} ${o.marke ?? ''} ${o.notering ?? ''}`
    const nonFoodGroups = new Set(['hushall_hygien', 'djur', 'barn', 'ovrigt'])
    const inFoodCategory = !nonFoodGroups.has(groupOf(o.kategori))
    if (NON_FOOD_GATE_RE.test(haystack) && inFoodCategory) {
      fail(`${where} — matches a non-food keyword but is filed under food kategori "${o.kategori}"`)
    }

    if (FROZEN_WORD_RE.test(haystack) && o.form !== 'fryst') {
      fail(`${where} — name says frozen but form is "${o.form}", not "fryst"`)
    }
    if (groupOf(o.kategori) === 'glass_dessert' && o.kategori !== 'dessertsas' && o.form !== 'fryst') {
      warn(`${where} — glass_dessert item with form "${o.form}", expected "fryst"`)
    }

    if (VEGO_WORD_RE.test(haystack) && !(o.markeringar ?? []).some(m => m === 'vegansk' || m === 'vegetarisk')) {
      fail(`${where} — name suggests vegan/vegetarian but markeringar is missing vegansk/vegetarisk`)
    }

    if (o.varutyp) {
      if (!varutypToKategorier.has(o.varutyp)) varutypToKategorier.set(o.varutyp, new Set())
      varutypToKategorier.get(o.varutyp).add(o.kategori)
    }

    const key = normalizeProductKey(o.namn, null)
    if (!nameToKategorier.has(key)) nameToKategorier.set(key, new Map())
    const byStore = nameToKategorier.get(key)
    if (!byStore.has(o.kategori)) byStore.set(o.kategori, new Set())
    byStore.get(o.kategori).add(data.kalla ?? file)

    // Cross-week/cross-source drift: this exact product already has a different
    // verdict locked into the lexicon.
    const lexEntry = lexikon[normalizeProductKey(o.namn, o.marke)]
    if (lexEntry && lexEntry.kategori !== o.kategori) {
      if (o.kategori_kalla === 'manuell' || lexEntry.kalla === 'manuell') {
        fail(`${where} — kategori "${o.kategori}" disagrees with locked (manuell) lexicon verdict "${lexEntry.kategori}"`)
      } else {
        warn(`${where} — kategori "${o.kategori}" disagrees with lexicon verdict "${lexEntry.kategori}" (re-run erbjudanden-recategorize.mjs?)`)
      }
    }
  }

  const share = offers.length ? ovrigtCount / offers.length : 0
  if (share > 0.03) warn(`${file} — ovrigt is ${(share * 100).toFixed(1)}% of offers (target ≤3%)`)
}

for (const [varutyp, kats] of varutypToKategorier) {
  if (kats.size > 1) fail(`varutyp "${varutyp}" spans multiple kategori values: ${[...kats].join(', ')}`)
}

for (const [name, byKat] of nameToKategorier) {
  if (byKat.size > 1 && name) {
    const desc = [...byKat.entries()].map(([k, stores]) => `${k} (${[...stores].join(',')})`).join(' vs. ')
    warn(`"${name}" classified differently across sources: ${desc}`)
  }
}

const lagCount = Object.values(lexikon).filter(e => e.confidence === 'lag').length
if (lagCount > 0) warn(`lexicon: ${lagCount} entries still have confidence "lag" — review candidates for a lexicon/model classification pass`)

for (const w of warns) console.log('WARN ', w)
for (const f of fails) console.log('FAIL ', f)
console.log(`\n${files.length} files checked, ${fails.length} failures, ${warns.length} warnings`)

if (fails.length > 0) process.exit(1)
