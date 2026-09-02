import { BevakningItem, Offer, StoreOffers } from '../types'
import { fileRange, offerRange, type DateRange } from './offerValidity'
import { ShoppingOfferRef } from '../hooks/useShoppingList'
import { GROUPS, groupOf } from './kategoriTaxonomy.mjs'

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

export interface BevakaHit {
  item: BevakningItem
  offers: TaggedOffer[]
}

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

/** Empty `sok` means "watch the whole category" instead of matching specific
 * keywords — `item.kategori` is a *group* id here (e.g. "godis_snacks",
 * "frukt_gront"), not a single leaf, since the whole point is breadth ("all of
 * snacks", not just one snack leaf). */
export function matchesBevakning(item: BevakningItem, o: TaggedOffer): boolean {
  const hay = `${o.namn} ${o.marke ?? ''}`.toLowerCase()
  if (item.undvik_marken.some(b => hay.includes(b.toLowerCase()))) return false
  if (item.sok.length === 0) return groupOf(o.kategori) === item.kategori
  return item.sok.some(k => hay.includes(k.toLowerCase()))
}

export function findBevakaHits(items: BevakningItem[], all: TaggedOffer[]): BevakaHit[] {
  return items
    .map(item => ({ item, offers: all.filter(o => matchesBevakning(item, o)) }))
    .filter(h => h.offers.length > 0)
}

/** "ICA · Zoégas · 500g" — store plus the actual product label, not just a price. */
export function describeOffer(o: TaggedOffer): string {
  const store = STORES[o.store]?.namn ?? o.store
  const label = [o.marke, o.storlek].filter(Boolean).join(' · ')
  return [store, label].filter(Boolean).join(' · ')
}
