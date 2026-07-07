#!/usr/bin/env node
/**
 * One-off migration: reclassifies every offer's `kategori` field from the old
 * 11-value scheme (kott_fagel/fisk_skaldjur/frukt_gront/mejeri/brod_bakverk/
 * torrvaror/frys/dryck/snacks_godis/hygien_hushall/ovrigt) into a new 7-value
 * scheme built around "what do I actually cook with" rather than "where does
 * the store shelve it":
 *
 *   protein_farsk   fresh meat/poultry/fish/seafood + fresh veg protein (tofu, egg, legumes...)
 *   protein_fryst   same, but frozen
 *   gront_farsk     fresh vegetables
 *   gront_fryst     frozen vegetables
 *   frukt           fruit & berries (fresh or frozen, no sub-split requested)
 *   snacks_godis    unchanged
 *   ovrigt          everything else: dairy, bread, drinks, dry goods, hygiene/household,
 *                   frozen ready-meals/pizza/ice cream, and anything unmatched
 *
 * Classification is keyword-based on `namn` alone — the *old* `kategori` is
 * deliberately NOT trusted as a fallback for protein/veg/fruit (its own
 * keyword-guess parser already mistagged things like "Salta jordnötter" and
 * "Naturella pinjenötter" as kott_fagel; carrying that forward would just
 * reproduce the "vegetables among the meat" bug this migration exists to fix).
 * Only `snacks_godis` is trusted as-is, since spot-checking showed it clean
 * (brand-name candy that no keyword list would catch, e.g. "Ahlgrens bilar").
 * Same accepted-approximation spirit as the existing erbjudanden-parse-*.mjs
 * scripts — "ovrigt" is a valid fallback, not a bug. Run once, by hand, then
 * spot-check (see the accompanying summary printed to stdout). Not meant to
 * be re-run automatically on new weeks.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node erbjudanden-recategorize.mjs <file.json> [...]')
  process.exit(1)
}

const PROTEIN = [
  'kött', 'nötkött', 'nötfärs', 'nötstek', 'nötgrytbitar', 'grytbitar', 'fläsk', 'gris',
  'biff', 'kyckling', 'kyckl', 'fågel', 'kalkon', 'anka', 'korv', 'falukorv', 'prinskorv',
  'bacon', 'skinka', 'karré', 'entrecote', 'ryggbiff', 'högrev', 'innerfilé', 'ytterfilé',
  'oxfilé', 'köttbullar', 'köttfärs', 'blandfärs', 'fläskfärs', 'kycklingfärs', 'wallenberg',
  'schnitzel', 'kotlett', 'grillkorv', 'bratwurst', 'chorizo', 'salami', 'leverpastej',
  'lever', 'lax', 'torsk', 'sej', 'gös', 'abborre', 'räk', 'skaldjur', 'skagenröra', 'sill',
  'strömming', 'makrill', 'tonfisk', 'musslor', 'hummer', 'krabba', 'kaviar', 'fisk', 'ägg',
  'tofu', 'quorn', 'sojafärs', 'veggofärs', 'vegofärs', 'seitan', 'kikärt', 'böna', 'bönor',
  'lins', 'linser', 'halloumi',
]
const FROZEN_HINTS = ['fryst', 'frys', 'djupfryst', 'glass']
const FRUIT = [
  'äpple', 'äpplen', 'apelsin', 'banan', 'clementin', 'citron', 'lime', 'vindruv', 'druv',
  'melon', 'vattenmelon', 'ananas', 'mango', 'kiwi', 'päron', 'persika', 'nektarin',
  'plommon', 'jordgubb', 'blåbär', 'hallon', 'björnbär', 'vinbär', 'bär', 'avokado',
  'granatäpple', 'fikon', 'aprikos', 'nektarin', 'grapefrukt', 'frukt',
]
const VEG = [
  'morot', 'morötter', 'lök', 'purjolök', 'potatis', 'tomat', 'gurka', 'paprika',
  'broccoli', 'blomkål', 'vitkål', 'spenat', 'sallad', 'isberg', 'majs', 'ärtor', 'ärter',
  'zucchini', 'aubergine', 'svamp', 'champinjon', 'rödbeta', 'selleri', 'rädisa', 'kål',
  'vitlök', 'färskpotatis', 'grönsak', 'rotmos', 'ingefära',
]
const SNACKS = [
  'chips', 'godis', 'snacks', 'choklad', 'kex', 'nöt', 'nötter', 'proteinbar', 'kola',
  'lakrits', 'popcorn', 'bilar', 'kulor', 'praliner', 'tuggummi',
]

// Known false-positive collisions where a keyword hides inside an unrelated word
// (e.g. "sill" inside pasta "fusilli", "ägg" inside "äggnudlar", "böna" inside
// "kaffebönor") — strip the offending substring before keyword matching instead of
// widening/narrowing the whole keyword list.
function sanitize(hay) {
  // "pålägg" (generic "sandwich topping/spread", any kind) hides "ägg" inside it.
  let h = hay.replace(/fusilli|äggnudlar|äggpasta|äggflingor|pålägg/g, '')
  if (h.includes('kaffe')) h = h.replace(/bönor|böna/g, '')
  return h
}

function hasAny(hay, list) {
  return list.some(k => hay.includes(k))
}

function classify(o) {
  const rawNamn = (o.namn ?? '').toLowerCase()
  const namn = sanitize(rawNamn)
  const old = o.kategori
  const frozen = old === 'frys' || hasAny(rawNamn, FROZEN_HINTS)

  // Ready-meals/bakery/ice cream aren't produce, raw protein, or a snack bag even
  // when they contain a matching keyword (e.g. "Fiskgratäng", "Chokladglass") —
  // bail to ovrigt first.
  const isReadyMeal = /pizza|bakverk|bulle|bröd|glass|efterrätt|tårta|paj\b|gratäng|nudlar/.test(namn)
  // Fruit-derived drinks/snack bars are drinks/snacks, not produce.
  // Fruit-flavored drinks/dairy/snack bars are drinks/dairy/snacks, not produce.
  const isFruitDrinkOrSnack = /dryck|smoothie|klämmis|stång|juice|saft|yoghurt|kvarg|\bfil\b|grädde/.test(namn)

  if (!isReadyMeal && hasAny(namn, PROTEIN)) {
    return frozen ? 'protein_fryst' : 'protein_farsk'
  }
  if (!isReadyMeal && hasAny(namn, FRUIT)) {
    if (isFruitDrinkOrSnack) return /klämmis|stång/.test(namn) ? 'snacks_godis' : 'ovrigt'
    return 'frukt'
  }
  if (!isReadyMeal && hasAny(namn, VEG)) {
    return frozen ? 'gront_fryst' : 'gront_farsk'
  }
  if (!isReadyMeal && hasAny(namn, SNACKS)) {
    return 'snacks_godis'
  }

  // Old kategori is only trusted here — its keyword-guess parser proved
  // reliable for candy brand names but not for protein/veg/fruit (see header).
  if (old === 'snacks_godis') return 'snacks_godis'
  return 'ovrigt'
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
