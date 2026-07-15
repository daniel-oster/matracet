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
 *   mejeri          dairy: milk, cheese, yoghurt/kvarg/fil, butter/margarine, cream
 *                   (added after this migration's original run — see MEJERI below)
 *   snacks_godis    unchanged
 *   ovrigt          everything else: bread, drinks, dry goods, hygiene/household,
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
const MEJERI = [
  'mjölk', 'grädd', 'yoghurt', 'yogurt', 'kvarg', 'keso', 'margarin', 'mozzarella',
  'philadelphia', 'creme fraiche', 'crème fraiche', 'brie', 'cheddar',
]
// Household/cleaning products whose name borrows a food word (a scent, a shape) —
// e.g. "Allrengöringssvamp" (cleaning sponge, "svamp" also means mushroom) or an
// apple-scented "Städservett" (wipe). Checked before any produce/protein keyword.
const NON_FOOD_RE = /rengör|städ|disk(?:medel|borste|svamp|trasa)|tvättmedel|tvättsvamp|badsvamp|toalettpapper|hushållspapper|mjukmedel/

// Known false-positive collisions where a keyword hides inside an unrelated word
// (e.g. "sill" inside pasta "fusilli", "ägg" inside "äggnudlar", "böna" inside
// "kaffebönor") — strip the offending substring before keyword matching instead of
// widening/narrowing the whole keyword list.
function sanitize(hay) {
  // "pålägg" (generic "sandwich topping/spread", any kind) hides "ägg" inside it.
  // "salladsost" (a cheese, despite the name) hides "sallad" — kept as "ost" so
  // the dairy check below still catches it. "kokosmjölk"/"kokosgrädde" are a
  // skafferi/pantry item, not dairy, despite containing "mjölk"/"grädd" — dropped
  // entirely rather than kept, since nothing else needs to match them.
  let h = hay.replace(/fusilli|äggnudlar|äggpasta|äggflingor|pålägg|kokosmjölk|kokosgrädde/g, '')
  h = h.replace(/salladsost/g, 'ost')
  if (h.includes('kaffe')) h = h.replace(/bönor|böna/g, '')
  return h
}

function hasAny(hay, list) {
  return list.some(k => hay.includes(k))
}

// "smör" excludes a trailing "gås" (smörgåsmat/smörgåspålägg = sandwich items, not
// butter). "ost" excludes being preceded by "r" and followed by "ron" — "rostbiff",
// "rostad", "mellanrost", "mörkrost" are roasted/roast, not cheese; "ostron" is
// oysters. "fil" (cultured milk) excludes a preceding "re" (kaffe-/tandborste-
// "refill") and a following "é" (filé, meat/fish, not dairy).
const MEJERI_RE = /smör(?!gås)|(?<!r)ost(?!ron)|(?<!re)fil(?!é)/

function isMejeri(hay) {
  return hasAny(hay, MEJERI) || MEJERI_RE.test(hay)
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
  // Fruit-flavored yoghurt/kvarg/fil/grädde are dairy, fruit-flavored drinks/juice
  // are "ovrigt", fruit-flavored snack bars ("klämmis"/"stång") are snacks — none
  // of these are produce.
  const isFruitSnack = /klämmis|stång/.test(namn)
  const isFruitDairy = /yoghurt|yogurt|kvarg|\bfil\b|grädd/.test(namn)
  const isFruitDrink = /dryck|smoothie|juice|saft/.test(namn)
  const isNonFood = NON_FOOD_RE.test(namn)

  if (isNonFood) return 'ovrigt'
  if (!isReadyMeal && hasAny(namn, PROTEIN)) {
    return frozen ? 'protein_fryst' : 'protein_farsk'
  }
  if (!isReadyMeal && hasAny(namn, FRUIT)) {
    if (isFruitSnack) return 'snacks_godis'
    if (isFruitDairy) return 'mejeri'
    if (isFruitDrink) return 'ovrigt'
    return 'frukt'
  }
  if (!isReadyMeal && hasAny(namn, VEG)) {
    return frozen ? 'gront_fryst' : 'gront_farsk'
  }
  if (!isReadyMeal && hasAny(namn, SNACKS)) {
    return 'snacks_godis'
  }
  // Dairy is checked last (after protein/fruit/veg/snacks) so a compound that also
  // carries one of those signals resolves there first — same ordering rationale as
  // erbjudanden-lib.mjs's guessKategori.
  if (!isReadyMeal && isMejeri(namn)) {
    return 'mejeri'
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
