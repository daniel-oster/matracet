// Shared helpers for the erbjudanden (store offer) PDF parsers.
// See public/data/erbjudanden/README.md for the target JSON schema.
//
// Classification itself (guessKategori/classify) has moved to
// src/lib/kategoriClassify.mjs, re-exported here so the six erbjudanden-parse-*.mjs
// scripts don't need their import lines changed. See that file's header for the full
// rationale (the "lexicon-first, model generates, rules verify" pipeline).
export { classify, guessKategori } from '../src/lib/kategoriClassify.mjs'

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
