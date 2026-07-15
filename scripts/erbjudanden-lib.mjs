// Shared helpers for the erbjudanden (store offer) PDF parsers.
// See public/data/erbjudanden/README.md for the target JSON schema.

export const COUNTRIES = [
  'Sverige', 'Spanien', 'Italien', 'Frankrike', 'Nederländerna', 'Holland',
  'Belgien', 'Tyskland', 'Polen', 'Litauen', 'Lettland', 'Estland',
  'Danmark', 'Norge', 'Finland', 'Storbritannien', 'Irland', 'Portugal',
  'Grekland', 'Turkiet', 'Marocko', 'Egypten', 'Kenya', 'Sydafrika',
  'Peru', 'Chile', 'Colombia', 'Brasilien', 'Ecuador', 'Costa Rica',
  'Nya Zeeland', 'Australien', 'USA', 'Kanada', 'Indien', 'Thailand',
  'Vietnam', 'Kina', 'Island',
];

// Longer names (multi-word, or names that are prefixes of others) must be
// tried first so e.g. "Nya Zeeland" matches before a stray "Zeeland".
const COUNTRY_PATTERN = new RegExp(
  '\\b(' + [...COUNTRIES].sort((a, b) => b.length - a.length).join('|') + ')(\\/(' +
    COUNTRIES.join('|') + '))*\\b',
  'i'
);

/** Pulls a country / "Land1/Land2" origin string out of free text, if present. */
export function extractUrsprung(text) {
  const m = text.match(/Ursprung ([A-Za-zÅÄÖåäö/ ]+?)(?:\.|,|$)/);
  if (m) return m[1].trim();
  const m2 = text.match(COUNTRY_PATTERN);
  return m2 ? m2[0] : null;
}

export function markeringarFromUrsprung(ursprung, existing = []) {
  const set = new Set(existing);
  if (ursprung && /sverige/i.test(ursprung)) set.add('svensk');
  return [...set];
}

// Rough keyword -> kategori classifier, grouped by "what do I cook with" rather
// than store-shelf placement (see public/data/erbjudanden/README.md). Not
// authoritative — spot-check the output, especially "ovrigt" and the
// fresh/frozen split, same as the pre-existing caveat for this classifier.
const FROZEN_HINT = /glass|djupfryst|\bfryst\b/i;
// Household/cleaning products whose *name* borrows a food word (a scent, a shape) —
// checked before any produce/protein keyword so e.g. "Allrengöringssvamp" (cleaning
// sponge, "svamp" also means mushroom) or an apple-scented "Städservett" (wipe) don't
// get filed as veg/fruit. Bail to 'ovrigt' unconditionally, same pattern as READY_MEAL_RE.
const NON_FOOD_RE = /rengör|städ|disk(?:medel|borste|svamp|trasa)|tvättmedel|tvättsvamp|badsvamp|toalettpapper|hushållspapper|mjukmedel/i;
// Note: only kött/nötkött-style compounds are matched for beef, never a bare "nöt"
// (peanuts, hazelnuts etc. would false-positive as protein — this classifier
// migrated away from that exact bug, see erbjudanden-recategorize.mjs's header).
// "fisk" excludes a trailing "e" ("Magnetfiske", a fishing-hobby product, not
// a food) — real food compounds always glue more letters directly onto "fisk"
// (fiskpinnar, fiskgratäng, laxfisk), never "fisk" + "e" as its own word.
// "färs" (mince/ground meat) excludes a trailing "k" — otherwise it matches inside
// "färsk(t/a)" (fresh, an adjective, e.g. "Färsk pasta") and its compounds like
// "Färskpotatis" (new potatoes). Real mince compounds always end in "färs" (nötfärs,
// fläskfärs, köttfärs, ...), never "färsk...", so this is safe and exact — same shape
// as the "fisk(?!e)" guard above, and matches guessAisleCategory's KOTT_FISK_PATTERNS
// in src/lib/storeOrder.ts (a blanket "strip färsk\w*" was tried first here too, but
// it also stripped "potatis" out of "Färskpotatis" whole, losing the veg match).
const PROTEIN_RE = /kyckling|fläsk|nötkött|nötfärs|nötstek|nötgrytbitar|grytbitar|köttbullar|köttfärs|korv|bacon|skinka|färs(?!k)|entrecote|karré|filé|file|biff|burg(?:are|er)|gyros|kebab|revben|spareribs|chark|salami|prosciutto|lax|fisk(?!e)|torsk|räk|skaldjur|skagenröra|sill(?!i)|makrill|tonfisk|surimi|musslor|ägg\b|tofu|quorn|sojafärs|vegofärs|veggofärs|seitan|kikärt|böna|bönor|lins|linser|halloumi/i;
const FRUIT_RE = /frukt|äpple|banan|apelsin|citron|avokado|melon|druv|bär|persika|nektarin|mango|ananas|päron|kiwi|plommon|aprikos|fikon|granatäpple/i;
const VEG_RE = /sallad|tomat|gurka|potatis|lök|paprika|morot|broccoli|zucchini|svamp|champinjon|vitkål|purjolök|blomkål|spenat|majs|ärtor|ärter|rödbeta|selleri|rädisa|vitlök/i;
const SNACKS_RE = /chips|godis|snacks|choklad|kex|nöt|nötter|proteinbar|kola|lakrits|popcorn/i;
const READY_MEAL_RE = /pizza|bakverk|bulle|bröd|glass|efterrätt|tårta|paj\b|gratäng|nudlar/i;
// Fruit-flavored drinks/dairy/snack bars are drinks/dairy/snacks, not produce.
const FRUIT_NON_PRODUCE_RE = /dryck|smoothie|klämmis|stång|juice|saft|yoghurt|kvarg|\bfil\b|grädde/i;
const CATEGORY_KEYWORDS = [
  [PROTEIN_RE, (h) => (FROZEN_HINT.test(h) ? 'protein_fryst' : 'protein_farsk')],
  [FRUIT_RE, (h) => {
    if (!FRUIT_NON_PRODUCE_RE.test(h)) return 'frukt';
    return /klämmis|stång/i.test(h) ? 'snacks_godis' : 'ovrigt';
  }],
  [VEG_RE, (h) => (FROZEN_HINT.test(h) ? 'gront_fryst' : 'gront_farsk')],
  [SNACKS_RE, () => 'snacks_godis'],
];

export function guessKategori(name, details) {
  // "pålägg" (generic "sandwich topping/spread", any kind) hides "ägg" inside it.
  // "automat"/"automatic" (appliance product names, e.g. "Kaffebryggare
  // Automatic") hides "tomat" inside it the same way.
  const haystack = `${name} ${details}`
    .replace(/pålägg/gi, '')
    .replace(/automat\w*/gi, '');
  if (NON_FOOD_RE.test(haystack)) return 'ovrigt';
  if (READY_MEAL_RE.test(haystack)) return 'ovrigt';
  for (const [re, kat] of CATEGORY_KEYWORDS) {
    if (re.test(haystack)) return kat(haystack);
  }
  return 'ovrigt';
}

/** "35-50 g" / "1,5 l" -> "35-50g" / "1,5l" (matches existing saved data style). */
export function tightenUnit(s) {
  if (!s) return s;
  return s.replace(/(\d)\s+(g|kg|ml|cl|l|st|dl|p|pack)\b/gi, '$1$2').trim();
}

/** Swedish "39:06" colon-decimal -> "39.06"; keeps ranges "39:06-62:50" -> "39.06-62.50". */
export function colonToDot(s) {
  return s.replace(/(\d+):(\d{2})/g, '$1.$2');
}

export function toNumber(s) {
  if (s == null) return null;
  const n = parseFloat(colonToDot(s).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

/** Non-content lines injected by the browser's print-to-PDF pagination. */
export function isPageNoise(line) {
  return (
    /^https?:\/\//.test(line) ||
    /^Sida \d+ av \d+$/.test(line) ||
    /^:$/.test(line) ||
    /^\d{4}-\d{2}-\d{2} \d{2} \d{2}$/.test(line)
  );
}

export function stripPageNoise(lines) {
  return lines.filter((l) => !isPageNoise(l.trim()));
}
