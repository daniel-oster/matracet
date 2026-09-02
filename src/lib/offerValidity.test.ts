import { describe, it, expect } from 'vitest'
import type { Offer, StoreOffers } from '../types'
import {
  candidateWeeks,
  filterStoresToRange,
  offerRange,
  rangesOverlap,
  staleWeekNote,
  validityNote,
} from './offerValidity'

function offer(namn: string, extra: Partial<Offer> = {}): Offer {
  return {
    namn, marke: null, storlek: null, pris_text: '10.00/st', pris: 10, pris_typ: 'st',
    jamforpris: null, ord_pris: null, pris_30dgr: null, besparing: null, klubbpris: false,
    max_kop: null, markeringar: [], ursprung: null, notering: null, kategori: 'ovrigt', ...extra,
  }
}

function store(vecka: string, from: string, to: string, erbjudanden: Offer[]): StoreOffers {
  return {
    schema_version: 1, kalla: 'willys', butik: 'Willys', butik_id: 'willys-x', vecka,
    giltigt_fran: from, giltigt_till: to, hamtad: from, kalla_url: null, urval: '',
    antal: erbjudanden.length, erbjudanden,
  }
}

describe('rangesOverlap', () => {
  it('is inclusive at both ends', () => {
    expect(rangesOverlap({ from: '2026-08-24', to: '2026-08-30' }, { from: '2026-08-30', to: '2026-09-05' })).toBe(true)
    expect(rangesOverlap({ from: '2026-08-24', to: '2026-08-30' }, { from: '2026-08-31', to: '2026-09-06' })).toBe(false)
  })
})

describe('offerRange', () => {
  const file = { from: '2026-08-31', to: '2026-09-06' }

  it('falls back to the file window when the offer carries no dates of its own', () => {
    expect(offerRange(offer('Mjölk'), file)).toEqual(file)
  })

  it('lets a per-offer end date cut the window short (a coupon expiring mid-week)', () => {
    expect(offerRange(offer('Kupong', { giltigt_till: '2026-09-02' }), file))
      .toEqual({ from: '2026-08-31', to: '2026-09-02' })
  })

  it('lets a per-offer date run past the flyer, not just narrow it', () => {
    expect(offerRange(offer('Kupong', { giltigt_till: '2026-09-13' }), file))
      .toEqual({ from: '2026-08-31', to: '2026-09-13' })
  })

  it('ignores a range inverted by two stated bounds — that is bad data, not an expiry', () => {
    expect(offerRange(offer('Trasig', { giltigt_fran: '2026-09-20', giltigt_till: '2026-09-01' }), file)).toEqual(file)
  })

  it('honours an end date that predates the flyer — an already-expired coupon', () => {
    expect(offerRange(offer('Utgången kupong', { giltigt_till: '2026-08-30' }), file))
      .toEqual({ from: '2026-08-30', to: '2026-08-30' })
  })
})

describe('filterStoresToRange', () => {
  const week = { from: '2026-08-31', to: '2026-09-06' }

  it('drops a flyer that ended before the period being planned', () => {
    const stores = [store('2026-W35', '2026-08-24', '2026-08-30', [offer('Gammal')])]
    expect(filterStoresToRange(stores, week)).toEqual([])
  })

  it('drops a flyer that has not started yet', () => {
    const stores = [store('2026-W37', '2026-09-07', '2026-09-13', [offer('För tidig')])]
    expect(filterStoresToRange(stores, week)).toEqual([])
  })

  it('keeps a flyer overlapping the period even partially', () => {
    const stores = [store('2026-W36', '2026-09-03', '2026-09-09', [offer('Delvis')])]
    expect(filterStoresToRange(stores, week).map(s => s.erbjudanden.length)).toEqual([1])
  })

  it('keeps a coupon that outlives the flyer it was captured with', () => {
    const stores = [store('2026-W35', '2026-08-24', '2026-08-30', [
      offer('Vanlig'),
      offer('Kupong', { giltigt_till: '2026-09-04' }),
    ])]
    const out = filterStoresToRange(stores, week)
    expect(out.map(s => s.erbjudanden.map(o => o.namn))).toEqual([['Kupong']])
  })

  it('drops the individual offers that expired mid-file and re-counts antal', () => {
    const stores = [store('2026-W36', '2026-08-31', '2026-09-06', [
      offer('Löper hela veckan'),
      offer('Gick ut igår', { giltigt_till: '2026-08-30' }),
    ])]
    const out = filterStoresToRange(stores, { from: '2026-08-31', to: '2026-08-31' })
    expect(out[0].erbjudanden.map(o => o.namn)).toEqual(['Löper hela veckan'])
    expect(out[0].antal).toBe(1)
  })
})

describe('candidateWeeks', () => {
  const available = ['2026-W33', '2026-W35', '2026-W36', '2026-W37']

  it('covers the weeks the period touches plus the one before it', () => {
    expect(candidateWeeks({ from: '2026-08-31', to: '2026-09-06' }, available)).toEqual(['2026-W35', '2026-W36'])
  })

  it('includes both weeks a rolling window straddles', () => {
    expect(candidateWeeks({ from: '2026-09-03', to: '2026-09-09' }, available)).toEqual(['2026-W35', '2026-W36', '2026-W37'])
  })

  it('never asks for a week nobody has imported', () => {
    // W34 is the window's own week and W33 the look-back one; only W33 exists.
    expect(candidateWeeks({ from: '2026-08-17', to: '2026-08-23' }, available)).toEqual(['2026-W33'])
    expect(candidateWeeks({ from: '2026-08-17', to: '2026-08-23' }, [])).toEqual([])
  })
})

describe('validityNote', () => {
  const week = { from: '2026-08-31', to: '2026-09-06' }

  it('says nothing for an offer covering the whole period', () => {
    expect(validityNote(week, week)).toBeNull()
    expect(validityNote({ from: '2026-08-24', to: '2026-09-13' }, week)).toBeNull()
  })

  it('flags one that runs out mid-period', () => {
    expect(validityNote({ from: '2026-08-31', to: '2026-09-02' }, week)).toBe('t.o.m. ons 2/9')
  })

  it('flags one that has not started yet', () => {
    expect(validityNote({ from: '2026-09-04', to: '2026-09-06' }, week)).toBe('från fre 4/9')
  })

  it('shows both ends when it only covers a slice', () => {
    expect(validityNote({ from: '2026-09-02', to: '2026-09-04' }, week)).toBe('ons 2/9–fre 4/9')
  })
})

describe('staleWeekNote', () => {
  it('explains an empty period by naming the newest saved week and when it ran out', () => {
    const stores = [
      store('2026-W33', '2026-08-10', '2026-08-16', [offer('A')]),
      store('2026-W35', '2026-08-24', '2026-08-30', [offer('B')]),
    ]
    expect(staleWeekNote(stores, { from: '2026-08-31', to: '2026-09-06' }))
      .toBe('senast sparade veckan (v.35) gick ut sön 30/8')
  })

  it('says nothing when a saved week does cover the period', () => {
    const stores = [store('2026-W36', '2026-08-31', '2026-09-06', [offer('A')])]
    expect(staleWeekNote(stores, { from: '2026-08-31', to: '2026-09-06' })).toBeNull()
  })

  it('says nothing when there is no saved data at all', () => {
    expect(staleWeekNote([], { from: '2026-08-31', to: '2026-09-06' })).toBeNull()
  })
})
