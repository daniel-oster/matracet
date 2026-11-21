import { BevakningItem, Offer, StoreOffers } from '../types'
import { fileRange, offerRange, type DateRange } from './offerValidity'
import { ShoppingOfferRef } from '../hooks/useShoppingList'
import { GROUPS } from './kategoriTaxonomy.mjs'
import { matchesWatch, rateOffer, compareRated, dealLabel as dealLabelRaw } from './bevakaMatch.mjs'

export interface StoreMeta {
  namn: string
  klass: string
}

export const STORES: Record<string, StoreMeta> = {
  willys: { namn: 'Willys', klass: 'willys' },
  ica: { namn: 'ICA', klass: 'ica' },
  hemkop: { namn: 'Hemköp', klass: 'hemkop' },
}

/** Built from kategoriTaxonomy.mjs, not hand-maintained — every leaf inherits its
 * parent group's emoji, and every group id is also a key (used by a "watch the whole
 * category" BevakningItem — see matchesBevakning below), so this one map covers both
 * offer-level (leaf) and watchlist-level (group) lookups without drifting apart. */
export const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries([
  ...GROUPS.map(g => [g.id, g.emoji]),
  ...GROUPS.flatMap(g => g.leaves.map(l => [l.id, g.emoji])),
])

export interface TaggedOffer extends Offer {
  store: string
  week: string
  /** The days this offer is actually valid on — its own giltigt_fran/giltigt_till when it
   * states them, otherwise the flyer file's. Resolved here because the file is the only
   * place those dates live, and a TaggedOffer has left its file behind. */
  giltig: DateRange
}

export interface RatedOffer extends TaggedOffer {
  /** kr saved per item (0 = unknown). */
  kr: number
  /** share of the ordinary price saved, in percent (0 = unknown). */
  pct: number
  /** the brand the household asked for (onskat_marke). */
  preferred: boolean
  /** a good enough deal to tell the household about — see bevakaMatch.mjs. */
  good: boolean
}

export interface BevakaHit {
  item: BevakningItem
  /** Best first (good deals, preferred brand, biggest share off). */
  offers: RatedOffer[]
  /** How many of `offers` are good deals. */
  goodCount: number
}

/** How many matches a whole-category watch may show — they are only ever the very best. */
export const CATEGORY_HIT_CAP = 6

export function tagOffers(stores: StoreOffers[]): TaggedOffer[] {
  return stores.flatMap(s => {
    const file = fileRange(s)
    return s.erbjudanden.map(o => ({ ...o, store: s.kalla, week: s.vecka, giltig: offerRange(o, file) }))
  })
}

/** Points a shopping-list item at the exact offer it was pulled from — see ShoppingOfferRef
 * for why a {store, week} ref beats duplicating the offer's fields. */
export function toOfferRef(o: TaggedOffer): ShoppingOfferRef {
  return { store: o.store, week: o.week }
}

/** Does this offer belong to the watch? Accent- and case-insensitive on namn+marke;
 * `undvik_marken`/`undvik_ord` disqualify, `kategorier` (when set) narrows to those leaves.
 * Empty `sok` means "watch the whole category" — `item.kategori` is then a *group* id
 * (e.g. "godis_snacks", "frukt_gront"), not a single leaf. Logic lives in bevakaMatch.mjs,
 * shared with the daily offer job's notifications. */
export function matchesBevakning(item: BevakningItem, o: TaggedOffer): boolean {
  return matchesWatch(item, o)
}

export function rateBevakning(item: BevakningItem, o: TaggedOffer): RatedOffer {
  return { ...o, ...(rateOffer(item, o) as { kr: number; pct: number; preferred: boolean; good: boolean }) }
}

/** Matches per watch item, rated and best first. A keyword watch keeps every match (the
 * good ones on top); a whole-category watch keeps only good deals, capped, since "all of
 * frukt & grönt" otherwise buries the one coffee deal that matters. Keyword watches come
 * before category watches; within each, items with a good deal first. */
export function findBevakaHits(items: BevakningItem[], all: TaggedOffer[]): BevakaHit[] {
  return items
    .map((item, idx) => {
      let offers = all.filter(o => matchesBevakning(item, o)).map(o => rateBevakning(item, o)).sort(compareRated)
      if (item.sok.length === 0) offers = offers.filter(o => o.good).slice(0, CATEGORY_HIT_CAP)
      return { item, offers, goodCount: offers.filter(o => o.good).length, idx }
    })
    .filter(h => h.offers.length > 0)
    .sort(
      (a, b) =>
        Number(a.item.sok.length === 0) - Number(b.item.sok.length === 0) ||
        Number(b.goodCount > 0) - Number(a.goodCount > 0) ||
        a.idx - b.idx,
    )
    .map(({ item, offers, goodCount }) => ({ item, offers, goodCount }))
}

/** "−26 kr (29 %)", or '' when the saving is unknown. */
export function dealLabel(o: { kr: number; pct: number }): string {
  return dealLabelRaw(o)
}

/** "ICA · Zoégas · 500g" — store plus the actual product label, not just a price. */
export function describeOffer(o: TaggedOffer): string {
  const store = STORES[o.store]?.namn ?? o.store
  const label = [o.marke, o.storlek].filter(Boolean).join(' · ')
  return [store, label].filter(Boolean).join(' · ')
}
