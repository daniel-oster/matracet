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

// Rough keyword -> kategori classifier. Not authoritative — spot-check the
// output, especially for "ovrigt" and ambiguous multi-word product names.
const CATEGORY_KEYWORDS = [
  [/mjölk|fil|yoghurt|grädde|ost(?!ron)|smör|margarin|crème fraiche|creme fraiche|kvarg|messmör|ägg\b/i, 'mejeri'],
  [/kyckling|fläsk|nöt|köttbullar|korv|bacon|skinka|färs|entrecote|karré|filé|file|biff|gyros|kebab|revben|spareribs|chark|salami|prosciutto|chark/i, 'kott_fagel'],
  [/lax|fisk|torsk|räkor|skaldjur|sill|makrill|tonfisk|surimi|musslor/i, 'fisk_skaldjur'],
  [/sallad|tomat|gurka|potatis|lök|frukt|äpple|banan|apelsin|citron|paprika|avokado|melon|druv|bär|persika|nektarin|morot|broccoli|zucchini|svamp|vitkål|purjolök|mango|ananas/i, 'frukt_gront'],
  [/bröd|limpa|fralla|croissant|bulle|kaka|bakverk|baguette/i, 'brod_bakverk'],
  [/läsk|juice|dryck|vatten|kaffe|te\b|öl\b|cider|iste|saft/i, 'dryck'],
  [/glass|djupfryst|fryst|pommes/i, 'frys'],
  [/chips|godis|snacks|choklad|kex|nötter|proteinbar/i, 'snacks_godis'],
  [/tvål|schampo|balsam|tandkräm|blöj|toapapper|diskmedel|tvättmedel|rengöring|hushållspapper|tampong|binda|rakhyvel|deo/i, 'hygien_hushall'],
  [/pasta|ris\b|mjöl|socker|olja|vinäger|krydda|konserv|soppa|sås|majonnäs|majo|ketchup|senap|müsli|flingor|gryn|hummus/i, 'torrvaror'],
];

export function guessKategori(name, details) {
  const haystack = `${name} ${details}`;
  for (const [re, kat] of CATEGORY_KEYWORDS) {
    if (re.test(haystack)) return kat;
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
