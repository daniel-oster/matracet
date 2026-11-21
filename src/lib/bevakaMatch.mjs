// Watch-list ("Bevaka") matching and deal rating — one implementation shared by the app
// (src/lib/bevaka.ts) and the daily offer job (scripts/erbjudanden-weekly.mjs), so the
// notification and the screen can never disagree about what counts as a hit.
//
// Isomorphic plain ESM on purpose, same as kategoriTaxonomy.mjs.
import { groupOf } from './kategoriTaxonomy.mjs'

/** Lowercase and strip accents: "Zoégas" and "zoegas" are the same brand to a shopper. */
export function normalize(s) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Largest number in "22.45-25.85kr" / "49.85-52.95", or 0. */
function maxNumber(s) {
  if (s == null) return 0
  if (typeof s === 'number') return s
  const m = String(s).replace(/,/g, '.').match(/\d+(?:\.\d+)?/g)
  return m ? Math.max(...m.map(Number).filter(n => !Number.isNaN(n))) : 0
}

/**
 * How good the deal is, per item: kr saved and share of the ordinary price.
 * Ordinary price minus unit price is the reliable measure (both are per item). The stated
 * `besparing` is only a fallback: Willys gives it for the whole multibuy and as a range
 * across variants ("2 FÖR 28", besparing "3.80-15.80kr"), so a figure that is not
 * plausible per item is divided by the multibuy count.
 */
export function dealOf(o) {
  const pris = typeof o.pris === 'number' ? o.pris : 0
  const ord = maxNumber(o.ord_pris)
  let kr = 0
  if (ord && pris && ord > pris) kr = ord - pris
  else if (!ord) {
    kr = maxNumber(o.besparing)
    const n = Number(String(o.pris_text ?? '').match(/(\d+)\s*f[öo]r/i)?.[1] ?? 1)
    if (n > 1 && pris && kr >= pris) kr = kr / n
  }
  const base = ord > pris ? ord : pris + kr
  const pct = kr && base ? Math.round((kr / base) * 100) : 0
  return { kr: Math.round(kr), pct }
}

/** A keyword watch counts the deal as good from this share off (or troskel_kr in kr). */
export const GOOD_PCT = 20
/** A whole-category watch is only worth mentioning for a clearly big discount. */
export const CATEGORY_GOOD_PCT = 40

function hayOf(o) {
  return normalize(`${o.namn} ${o.marke ?? ''}`)
}

/** Is this offer the product the watch is about (ignoring how good the price is)? */
export function matchesWatch(item, o) {
  const hay = hayOf(o)
  if ((item.undvik_marken ?? []).some(b => hay.includes(normalize(b)))) return false
  if ((item.undvik_ord ?? []).some(w => hay.includes(normalize(w)))) return false
  if (item.kategorier?.length && !item.kategorier.includes(o.kategori)) return false
  if (item.sok.length === 0) return groupOf(o.kategori) === item.kategori
  return item.sok.some(k => hay.includes(normalize(k)))
}

/** Is the offer the brand the household prefers? */
export function isPreferred(item, o) {
  return !!item.onskat_marke && hayOf(o).includes(normalize(item.onskat_marke))
}

/** A matching offer, rated. `good` = worth telling the household about. */
export function rateOffer(item, o) {
  const deal = dealOf(o)
  const preferred = isPreferred(item, o)
  const categoryWide = item.sok.length === 0
  const good = categoryWide
    ? deal.pct >= CATEGORY_GOOD_PCT
    : (item.troskel_kr != null && deal.kr >= item.troskel_kr) || deal.pct >= GOOD_PCT
  return { ...deal, preferred, good }
}

/** Best first: good deals, then the preferred brand, then biggest share off. */
export function compareRated(a, b) {
  return (
    Number(b.good) - Number(a.good) ||
    Number(b.preferred) - Number(a.preferred) ||
    b.pct - a.pct ||
    b.kr - a.kr
  )
}

/** "−26 kr (29 %)" — empty when the saving is unknown. */
export function dealLabel(d) {
  if (!d.kr) return ''
  return d.pct ? `−${d.kr} kr (${d.pct} %)` : `−${d.kr} kr`
}
