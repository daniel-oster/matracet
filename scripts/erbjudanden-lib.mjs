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
// get filed as veg/fruit. Resolves straight to 'hygien_hushall', same pattern as
// BROD_RE/FARDIGMAT_RE below.
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
// "entrec[oô]te" covers both the plain and accented ("Entrecôte") spelling — the
// PDF/HTML sources are inconsistent about which one they use.
const PROTEIN_RE = /kyckling|fläsk|nötkött|nötfärs|nötstek|nötgrytbitar|grytbitar|köttbullar|köttfärs|korv|bacon|skinka|färs(?!k)|entrec[oô]te|karré|filé|file|biff|burg(?:are|er)|gyros|kebab|revben|spareribs|chark|salami|prosciutto|lax|fisk(?!e)|fish|torsk|räk|skaldjur|skagenröra|sill(?!i)|makrill|tonfisk|surimi|musslor|ägg\b|tofu|quorn|sojafärs|vegofärs|veggofärs|seitan|kikärt|böna|bönor|lins|linser|halloumi|lamm|ribs|tomahawk|kassler|pancetta|mortadella|pulled\s*pork|flankstek|flintastek|t-bone|club steak|cognac(?:s)?medwurst|fuet|picanha|högrev|oxpytt|pastej|lever(?!ansen)|kräft|pluma|grillspett|kamben|skädda|kaviar/i;
const FRUIT_RE = /frukt|äpple|banan|apelsin|citron|avokado|melon|druv|bär|persika|nektarin|mango|ananas|päron|kiwi|plommon|aprikos|fikon|granatäpple/i;
const VEG_RE = /sallad|tomat|gurka|potatis|lök|paprika|morot|broccoli|zucchini|svamp|champinjon|kål|purjolök|spenat|majs|ärtor|ärter|rödbeta|selleri|rädisa|vitlök|dill|persilja|koriander|basilika|kronärtskocka/i;
const SNACKS_RE = /chips|godis|snacks|choklad|kex|nöt|nötter|proteinbar|kola|lakrits|popcorn|tuggummi|marshmallow|toffifee|mentos/i;
// Bread/bakery and ready-meals/frozen-convenience are checked *before* protein/fruit/
// veg/snacks, same protective role the old blanket READY_MEAL_RE used to play (now
// split into two real categories instead of a single "bail to ovrigt"): otherwise
// "Korvbröd"/"Vitlöksbröd"/"Hamburgerbröd" would match the meat/veg keyword inside
// them, and "Fiskgratäng"/"Potatisgratäng"/"Chokladglass" would match fisk/potatis/
// choklad instead of being recognized as a bread or a ready meal.
// "bull" excludes being preceded by "kött"/"fläsk"/"fisk"/"vego" — "köttbullar"/
// "kycklingköttbullar"/"vegobullar" are meatballs, not bread buns (a genuine Swedish
// homonym: "bulle" is a bread bun, but also the "-bulle" in "köttbulle"=meatball).
// "tortilla" excludes a following "chips" — tortilla chips are a snack, not bread.
// "kaka" excludes both a following "o" (kakao=cocoa) and being preceded by "choklad"/
// "kola" — "Chokladkaka"/"Kolakaka" are candy bars, not cake.
const BROD_RE = /bröd|limpa|frall|baguett|tortilla(?!\s*chips)|pitabröd|knäckebröd|skorp|croissant|(?<!kött)(?<!fläsk)(?<!fisk)(?<!vego)bull|giffl|levain|bâtard|kavring|rågbröd|sportbröd|surdeg|tannour|hönökaka|knäcke|orientbrd|kladdkaka|tårta|muffin|donut|wienerbröd|(?<!choklad)(?<!kola)kaka(?!o)|jubileum|franska/i;
const FARDIGMAT_RE = /pizza|glass|efterrätt|paj\b|gratäng|pommes|frites|husmans|enportionsrätt|matpaj|soppa|pinsa/i;
// Fruit-flavored yoghurt/kvarg/fil/grädde are dairy, fruit-flavored drinks/juice are
// "dryck", fruit-flavored snack bars ("klämmis"/"stång") are snacks — none are produce.
const FRUIT_DAIRY_RE = /yoghurt|yogurt|kvarg|\bfil\b|grädd/i;
const FRUIT_SNACK_RE = /klämmis|stång/i;
const FRUIT_DRINK_RE = /dryck|smoothie|juice|saft/i;
// Dairy — checked after protein/fruit/veg/snacks, so a compound that also carries one
// of those signals resolves there first: "Jordnötssmör" (peanut butter) matches
// SNACKS_RE's "nöt" before ever reaching "smör" here, and "Mjölkchoklad" (milk
// chocolate) resolves via SNACKS_RE's "choklad" rather than "mjölk".
// "smör" excludes a trailing "gås" (smörgåsmat/smörgåspålägg = sandwich items, not
// butter). "ost" excludes being preceded by "r" and followed by "ron" — "rostbiff",
// "rostad", "mellanrost", "mörkrost" are roasted/roast, not cheese; "ostron" is
// oysters. "fil" (cultured milk) excludes both a preceding "re" (kaffe-/tandborste-
// "refill") and a following "é" (filé, the fisk/kött keyword's job, not dairy's).
// "mjölk"/"grädd" exclude a "kokos" prefix — kokosmjölk/kokosgrädde are a
// skafferi/pantry item, not dairy (same exclusion storeOrder.ts's aisle
// categorizer already makes for its own "mejeri" bucket).
const MEJERI_RE = /(?<!kokos)mjölk|(?<!kokos)grädd|yoghurt|yogurt|kvarg|keso|margarin|mozzarella|philadelphia|cr[eè]me fraiche|brie|cheddar|(?<!r)ost(?!ron)|smör(?!gås)|(?<!re)fil(?!é)|feta|mascarpone|ricotta|skyr|kefir|bregott|norrloumi|norvegia|jarlsberg|proviva|yoggi/i;
// "öl" is anchored to whitespace/edges rather than \b — JS's \b only treats ASCII
// [A-Za-z0-9_] as "word" characters, so \böl\b would (wrongly) find a boundary right
// before the "ö" in "Vetemjöl"/"Mjölk"/"Sköljmedel" too, since JS doesn't count å/ä/ö
// as word characters by default. Same trap as the fixed-width lookbehind/lookahead
// guards elsewhere in this file, just via a different mechanism.
const DRYCK_RE = /kaffe|läsk|cider|(?:^| )öl(?: |,|$)|cola|pepsi|energidryck|dryck|juice|saft|smoothie|kolsyrat|iste|ice coffee|ice tea|tonic|drinkmixer|nektar|barista|havredryck|vätskeersättning|ginger beer/i;
const SKAFFERI_RE = /sås|sauce|dressing|senap|majo|mayo|ketchup|pesto|vinäger|olja|krydd|marinad|bearnaise|aioli|bbq|pasta|makaron|spagetti|fettuccine|lasagne|risoni|nudlar|noodle|jasminris|basmatiris|rismål|rislunsj|bulgur|couscous|quinoa|mjöl(?!k)|socker|honung|sirap|marmelad|sylt|hummus|oliv|kimchi|buljong|fond|soja|ströbröd|konserv|flingor|müsli|havregryn|havrekuddar|havregott|granola|nesquik|antipasti|tapas|pajdeg|bladdeg|matfett|vetemjöl|matvete|ättiksprit|kokosmjölk|kokosgrädde|cornichon/i;
const HYGIEN_RE = /schampo|balsam|tvål|tvätt|toalettpapper|hushållspapper|servett|tandkräm|tandborste|deo|deodorant|rakhyvel|rakblad|rakgel|rakvård|blöj|bindor|trosskydd|tampong|våtservett|myggmedel|insektsspray|getingspray|myrr|myrdosa|solskydd|solvård|spf|kräm|creme|cream|hårfärg|munskölj|fluorskölj|sköljmedel|fläckborttagning|mopp|wettex|avfallspåse|fryspåse|plastpåse|ugnsfolie|aluminiumfolie|dammsugarpåse|doftblock|pappmugg|papptallrik|dricksglas|bestick|tallrik|hund|katt|grillkol|grillbriketter|grillpinnar|grillrulle|flugsmäll|diskduk|handdiskmedel|maskindisk/i;
const CATEGORY_KEYWORDS = [
  [BROD_RE, () => 'brod'],
  [FARDIGMAT_RE, () => 'fardigmat'],
  [PROTEIN_RE, (h) => (FROZEN_HINT.test(h) ? 'protein_fryst' : 'protein_farsk')],
  [FRUIT_RE, (h) => {
    if (FRUIT_SNACK_RE.test(h)) return 'snacks_godis';
    if (FRUIT_DAIRY_RE.test(h)) return 'mejeri';
    if (FRUIT_DRINK_RE.test(h)) return 'dryck';
    return 'frukt';
  }],
  [VEG_RE, (h) => (FROZEN_HINT.test(h) ? 'gront_fryst' : 'gront_farsk')],
  [SNACKS_RE, () => 'snacks_godis'],
  [MEJERI_RE, () => 'mejeri'],
  [DRYCK_RE, () => 'dryck'],
  [SKAFFERI_RE, () => 'skafferi'],
  [HYGIEN_RE, () => 'hygien_hushall'],
];

export function guessKategori(name, details) {
  // "pålägg" (generic "sandwich topping/spread", any kind) hides "ägg" inside it.
  // "automat"/"automatic" (appliance product names, e.g. "Kaffebryggare
  // Automatic") hides "tomat" inside it the same way. "Salladsost" (a cheese,
  // despite the name) hides VEG_RE's "sallad" — kept as "ost" so MEJERI_RE still
  // catches it.
  const haystack = `${name} ${details}`
    .replace(/pålägg/gi, '')
    .replace(/automat\w*/gi, '')
    .replace(/salladsost/gi, 'ost');
  if (NON_FOOD_RE.test(haystack)) return 'hygien_hushall';
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
