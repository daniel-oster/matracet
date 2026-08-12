import { describe, it, expect } from 'vitest'
import { findOfferMatch, parseSavings } from './suggestions'
import type { Recipe } from '../types'
import type { TaggedOffer } from './bevaka'

function makeRecipe(vara: string[]): Recipe {
  return {
    schema_version: '1',
    slug: 'test',
    nummer: 1,
    namn: 'Test',
    tid_min: 20,
    portioner: 4,
    kategorier: [],
    sasong: [],
    svarighet: 'latt',
    barnvanlig: 'ja',
    taggar: [],
    dagkedja: null,
    ingredienser: vara.map(v => ({ vara: v, mangd: 1, enhet: 'st' })),
    instruktioner: [],
    komplett: true,
  }
}

function makeOffer(namn: string, besparing: string | null = null): TaggedOffer {
  return {
    namn,
    marke: null,
    storlek: null,
    pris_text: '',
    pris: 10,
    pris_typ: 'st',
    jamforpris: null,
    ord_pris: null,
    pris_30dgr: null,
    besparing,
    klubbpris: false,
    max_kop: null,
    markeringar: [],
    ursprung: null,
    notering: null,
    kategori: 'ovrigt',
    store: 'willys',
    week: '2026-W31',
  }
}

describe('parseSavings', () => {
  it('returns 0 for null/empty', () => {
    expect(parseSavings(null)).toBe(0)
    expect(parseSavings(undefined)).toBe(0)
    expect(parseSavings('')).toBe(0)
  })

  it('parses a single figure', () => {
    expect(parseSavings('1.30kr')).toBe(1.3)
  })

  it('parses the larger figure out of a range (en-dash, real data format)', () => {
    expect(parseSavings('8.80–10.00kr')).toBe(10)
    expect(parseSavings('32.01–47.15kr')).toBe(47.15)
  })

  it('parses a range using a plain hyphen', () => {
    expect(parseSavings('3.00-4.23kr')).toBe(4.23)
  })
})

describe('findOfferMatch', () => {
  it('returns undefined for a recipe with no ingredients besides trivial ones', () => {
    const recipe = makeRecipe(['vatten', 'salt'])
    expect(findOfferMatch(recipe, [makeOffer('Salt Maldon')])).toBeUndefined()
  })

  it('returns undefined when nothing matches', () => {
    const recipe = makeRecipe(['laxfilé'])
    expect(findOfferMatch(recipe, [makeOffer('Bananer')])).toBeUndefined()
  })

  it('matches a whole-word ingredient against a whole-word offer name', () => {
    const recipe = makeRecipe(['pasta'])
    const offer = makeOffer('Pasta')
    expect(findOfferMatch(recipe, [offer])).toBe(offer)
  })

  it('matches a whole-word offer name inside a longer ingredient phrase (reverse direction)', () => {
    const recipe = makeRecipe(['pasta, gärna tagliatelle eller spaghetti'])
    const offer = makeOffer('Pasta')
    expect(findOfferMatch(recipe, [offer])).toBe(offer)
  })

  // Real false positives found by running this function against the actual 2026-W31 corpus
  // (see docs/quality-review-2026-08.md, finding F3) — each of these previously matched via a
  // bare substring test and no longer should, now that matches require a real word boundary.
  describe('regression: does not match mid-word (real corpus false positives)', () => {
    it('"ägg" does not match inside "Smörgåspålägg"', () => {
      const recipe = makeRecipe(['ägg'])
      expect(findOfferMatch(recipe, [makeOffer('Smörgåspålägg')])).toBeUndefined()
    })

    it('"ris" does not match inside "Frisco Hamburgerbröd"', () => {
      const recipe = makeRecipe(['ris'])
      expect(findOfferMatch(recipe, [makeOffer('Frisco Hamburgerbröd')])).toBeUndefined()
    })

    it('"bröd" does not match inside "Wienerbröd"', () => {
      const recipe = makeRecipe(['bröd'])
      expect(findOfferMatch(recipe, [makeOffer('Wienerbröd')])).toBeUndefined()
    })

    it('"olja" does not match inside "Olivolja Classico"', () => {
      const recipe = makeRecipe(['olja'])
      expect(findOfferMatch(recipe, [makeOffer('Olivolja Classico')])).toBeUndefined()
    })

    it('the offer "Paj" does not match inside the ingredient "pajdeg" (reverse direction)', () => {
      const recipe = makeRecipe(['pajdeg'])
      expect(findOfferMatch(recipe, [makeOffer('Paj')])).toBeUndefined()
    })
  })

  it('still matches a real whole-word offer for a short ingredient like "ägg"', () => {
    const recipe = makeRecipe(['ägg'])
    const offer = makeOffer('Ägg 12-pack')
    expect(findOfferMatch(recipe, [offer])).toBe(offer)
  })

  it('picks the candidate with the highest savings, not the first array match', () => {
    const recipe = makeRecipe(['pasta'])
    const cheap = makeOffer('Pasta', '2.00kr')
    const good = makeOffer('Pasta Barilla', '40.00kr')
    expect(findOfferMatch(recipe, [cheap, good])).toBe(good)
  })

  it('ignores trivial ingredients like vatten/salt/peppar even when an offer would otherwise match', () => {
    const recipe = makeRecipe(['vatten', 'laxfilé'])
    const offer = makeOffer('Kolsyrat vatten 12-pack')
    expect(findOfferMatch(recipe, [offer])).toBeUndefined()
  })
})
