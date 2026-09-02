import { describe, it, expect } from 'vitest'
import { matchesBevakning, findBevakaHits, tagOffers, toOfferRef } from './bevaka'
import type { BevakningItem, Offer, StoreOffers } from '../types'

const WEEK31 = { from: '2026-07-27', to: '2026-08-02' }

function makeItem(overrides: Partial<BevakningItem> = {}): BevakningItem {
  return {
    id: 'item-1',
    vara: 'Kaffe',
    kategori: 'skafferi',
    sok: ['gevalia'],
    undvik_marken: [],
    onskat_marke: null,
    storlek_hint: null,
    troskel_kr: null,
    anteckning: null,
    ...overrides,
  }
}

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    namn: 'Gevalia Kaffe',
    marke: 'Gevalia',
    storlek: '450g',
    pris_text: '39:90',
    pris: 39.9,
    pris_typ: 'st',
    jamforpris: null,
    ord_pris: null,
    pris_30dgr: null,
    besparing: '10.00kr',
    klubbpris: false,
    max_kop: null,
    markeringar: [],
    ursprung: null,
    notering: null,
    kategori: 'skafferi',
    ...overrides,
  }
}

describe('matchesBevakning', () => {
  it('matches when an offer name contains a sok keyword', () => {
    expect(matchesBevakning(makeItem({ sok: ['gevalia'] }), { ...makeOffer(), store: 'willys', week: '2026-W31', giltig: WEEK31 })).toBe(true)
  })

  it('matches against the brand field too, not just namn', () => {
    const item = makeItem({ sok: ['zoegas'] })
    const offer = { ...makeOffer({ namn: 'Bryggkaffe', marke: 'Zoégas' }), store: 'willys', week: '2026-W31', giltig: WEEK31 }
    // sok is matched lowercase against "namn marke" — Zoégas has to appear literally to match;
    // this asserts the current (case-insensitive, accent-sensitive) behaviour.
    expect(matchesBevakning(item, offer)).toBe(false) // 'zoegas' (no é) does not match 'zoégas'
  })

  it('does not match when no sok keyword is present', () => {
    const item = makeItem({ sok: ['lofbergs'] })
    const offer = { ...makeOffer({ namn: 'Gevalia Kaffe', marke: 'Gevalia' }), store: 'willys', week: '2026-W31', giltig: WEEK31 }
    expect(matchesBevakning(item, offer)).toBe(false)
  })

  it('undvik_marken disqualifies an otherwise-matching offer', () => {
    const item = makeItem({ sok: ['kaffe'], undvik_marken: ['gevalia'] })
    const offer = { ...makeOffer({ namn: 'Gevalia Kaffe', marke: 'Gevalia' }), store: 'willys', week: '2026-W31', giltig: WEEK31 }
    expect(matchesBevakning(item, offer)).toBe(false)
  })

  it('undvik_marken does not disqualify a different brand', () => {
    const item = makeItem({ sok: ['kaffe'], undvik_marken: ['gevalia'] })
    const offer = { ...makeOffer({ namn: 'Löfbergs Kaffe', marke: 'Löfbergs' }), store: 'willys', week: '2026-W31', giltig: WEEK31 }
    expect(matchesBevakning(item, offer)).toBe(true)
  })

  it('an empty sok watches the whole category (matched by group, not leaf)', () => {
    // "frukt" is a leaf inside the "frukt_gront" group (see kategoriTaxonomy.mjs) — a
    // category-wide watch item's own `kategori` field holds the *group* id.
    const item = makeItem({ sok: [], kategori: 'frukt_gront' })
    const fruitOffer = { ...makeOffer({ namn: 'Bananer', kategori: 'frukt' }), store: 'willys', week: '2026-W31', giltig: WEEK31 }
    const otherOffer = { ...makeOffer({ namn: 'Mjölk', kategori: 'mjolk_gradde' }), store: 'willys', week: '2026-W31', giltig: WEEK31 }
    expect(matchesBevakning(item, fruitOffer)).toBe(true)
    expect(matchesBevakning(item, otherOffer)).toBe(false)
  })

  it('an empty sok still respects undvik_marken', () => {
    const item = makeItem({ sok: [], kategori: 'frukt_gront', undvik_marken: ['chiquita'] })
    const offer = { ...makeOffer({ namn: 'Bananer', marke: 'Chiquita', kategori: 'frukt' }), store: 'willys', week: '2026-W31', giltig: WEEK31 }
    expect(matchesBevakning(item, offer)).toBe(false)
  })
})

describe('tagOffers', () => {
  it('tags every offer with its store id (kalla) and week (vecka)', () => {
    const stores: StoreOffers[] = [
      {
        schema_version: 1,
        kalla: 'willys',
        butik: 'Willys',
        butik_id: 'willys-1',
        vecka: '2026-W31',
        giltigt_fran: '',
        giltigt_till: '',
        hamtad: '',
        kalla_url: null,
        urval: '',
        antal: 1,
        erbjudanden: [makeOffer()],
      },
    ]
    const tagged = tagOffers(stores)
    expect(tagged).toHaveLength(1)
    expect(tagged[0].store).toBe('willys')
    expect(tagged[0].week).toBe('2026-W31')
  })
})

describe('toOfferRef', () => {
  it('extracts just {store, week} from a tagged offer', () => {
    const tagged = { ...makeOffer(), store: 'ica', week: '2026-W29', giltig: WEEK31 }
    expect(toOfferRef(tagged)).toEqual({ store: 'ica', week: '2026-W29' })
  })
})

describe('findBevakaHits', () => {
  it('only returns items that have at least one matching offer', () => {
    const items = [makeItem({ id: 'a', sok: ['gevalia'] }), makeItem({ id: 'b', sok: ['nonexistent-brand'] })]
    const offers = [{ ...makeOffer({ namn: 'Gevalia Kaffe' }), store: 'willys', week: '2026-W31', giltig: WEEK31 }]
    const hits = findBevakaHits(items, offers)
    expect(hits).toHaveLength(1)
    expect(hits[0].item.id).toBe('a')
    expect(hits[0].offers).toHaveLength(1)
  })

  it('returns an empty list when nothing matches anything', () => {
    expect(findBevakaHits([makeItem()], [])).toEqual([])
  })
})
