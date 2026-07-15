import { BevakningItem, Offer, StoreOffers } from '../types'
import { ShoppingOfferRef } from '../hooks/useShoppingList'

export interface StoreMeta {
  namn: string
  klass: string
}

export const STORES: Record<string, StoreMeta> = {
  willys: { namn: 'Willys', klass: 'willys' },
  ica: { namn: 'ICA', klass: 'ica' },
  hemkop: { namn: 'Hemköp', klass: 'hemkop' },
}

export const CATEGORY_EMOJI: Record<string, string> = {
  protein_farsk: '🥩',
  protein_fryst: '🥩',
  gront_farsk: '🥦',
  gront_fryst: '🥦',
  frukt: '🍎',
  mejeri: '🥛',
  brod: '🍞',
  fardigmat: '🍕',
  dryck: '🥤',
  skafferi: '🥫',
  snacks_godis: '🍫',
  hygien_hushall: '🧴',
  ovrigt: '📦',
}

export interface TaggedOffer extends Offer {
  store: string
  week: string
}

export interface BevakaHit {
  item: BevakningItem
  offers: TaggedOffer[]
}

export function tagOffers(stores: StoreOffers[]): TaggedOffer[] {
  return stores.flatMap(s => s.erbjudanden.map(o => ({ ...o, store: s.kalla, week: s.vecka })))
}

/** Points a shopping-list item at the exact offer it was pulled from — see ShoppingOfferRef
 * for why a {store, week} ref beats duplicating the offer's fields. */
export function toOfferRef(o: TaggedOffer): ShoppingOfferRef {
  return { store: o.store, week: o.week }
}

/** Empty `sok` means "watch the whole category" instead of matching specific keywords. */
export function matchesBevakning(item: BevakningItem, o: TaggedOffer): boolean {
  const hay = `${o.namn} ${o.marke ?? ''}`.toLowerCase()
  if (item.undvik_marken.some(b => hay.includes(b.toLowerCase()))) return false
  if (item.sok.length === 0) return o.kategori === item.kategori
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
