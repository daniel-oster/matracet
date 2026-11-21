import { describe, it, expect } from 'vitest'
import { matchesBevakning, findBevakaHits, tagOffers, toOfferRef, rateBevakning, dealLabel } from './bevaka'
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
    // accent- and case-insensitive: 'zoegas' finds 'Zoégas' in the brand field
    expect(matchesBevakning(item, offer)).toBe(true)
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

describe('smarter matching (2026-11)', () => {
  const tag = (o: Partial<Offer>) => ({ ...makeOffer(o), store: 'hemkop', week: '2026-W47', giltig: WEEK31 })
  const kaffe = makeItem({ sok: ['kaffe'], kategorier: ['kaffe_te'], undvik_ord: ['snabbkaffe', 'kapsl'], undvik_marken: ['Gevalia'] })

  it('rates the real Zoégas 2-för offer as a good deal', () => {
    const o = tag({ namn: 'Kaffe', marke: 'Zoégas', pris: 64.5, pris_text: '2 FÖR 129.00', ord_pris: '90.00', besparing: '22.45-25.85kr', kategori: 'kaffe_te' })
    const r = rateBevakning(kaffe, o)
    expect(r.good).toBe(true)
    expect(r.kr).toBe(26)
    expect(r.pct).toBe(28)
    expect(dealLabel(r)).toBe('−26 kr (28 %)')
  })

  it('undvik_ord and kategorier keep instant coffee, capsules and kaffebröd out', () => {
    expect(matchesBevakning(kaffe, tag({ namn: 'Snabbkaffe', marke: 'Löfbergs', kategori: 'kaffe_te' }))).toBe(false)
    expect(matchesBevakning(kaffe, tag({ namn: 'Kaffekapslar', marke: "L'OR", kategori: 'kaffe_te' }))).toBe(false)
    expect(matchesBevakning(kaffe, tag({ namn: 'Kaffebröd', marke: 'Pågen', kategori: 'fikabrod' }))).toBe(false)
  })

  it('a small discount matches but is not good; troskel_kr can make it good', () => {
    const o = tag({ namn: 'Kaffe', marke: 'Arvid Nordquist', pris: 80, ord_pris: '89.90', besparing: null, kategori: 'kaffe_te' })
    expect(rateBevakning(kaffe, o).good).toBe(false)
    expect(rateBevakning({ ...kaffe, troskel_kr: 8 }, o).good).toBe(true)
  })

  it('puts good deals and the preferred brand first, and drops weak category-wide matches', () => {
    const tp = makeItem({ id: 'tp', sok: ['toalettpapper'], onskat_marke: 'Serla' })
    const frukt = makeItem({ id: 'frukt', sok: [], kategori: 'frukt_gront' })
    const offers = [
      tag({ namn: 'Toalettpapper', marke: 'Lambi', pris: 60, besparing: '30kr', kategori: 'papper' }),
      tag({ namn: 'Toalettpapper', marke: 'Serla', pris: 60, besparing: '30kr', kategori: 'papper' }),
      tag({ namn: 'Äpplen', marke: null, pris: 20, besparing: '2kr', kategori: 'frukt' }),
      tag({ namn: 'Druvor', marke: null, pris: 20, besparing: '20kr', kategori: 'frukt' }),
    ]
    const hits = findBevakaHits([frukt, tp], offers)
    expect(hits.map(h => h.item.id)).toEqual(['tp', 'frukt'])
    expect(hits[0].offers[0].marke).toBe('Serla')
    expect(hits[1].offers.map(o => o.namn)).toEqual(['Druvor'])
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
