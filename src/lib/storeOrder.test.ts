import { describe, it, expect } from 'vitest'
import { guessAisleId, aisleRank, aisleLabel, sortByAisle, groupByAisle } from './storeOrder'

describe('guessAisleId', () => {
  it('classifies plain grocery names into the expected aisle', () => {
    expect(guessAisleId('Bananer')).toBe('frukt_gront')
    expect(guessAisleId('Mjölk')).toBe('mejeri')
    expect(guessAisleId('Toalettpapper')).toBe('hushall')
    expect(guessAisleId('Kaffe')).toBe('dryck')
  })

  // Regression tests for the substring-collision families CLAUDE.md documents as already
  // fixed in the shared classifier (kategoriClassify.mjs) — this file only ever consumes
  // that classifier's verdict, so these confirm the fix actually reaches the shopping list's
  // aisle grouping too, not just the Fynd screen's own categorisation.
  describe('regression: Swedish compound-word collisions', () => {
    it('"Nötfärs" (mince) lands in kött/fisk, not "Färsk pasta" in kött/fisk via the "färs" substring', () => {
      expect(guessAisleId('Nötfärs')).toBe('kott_fisk')
      expect(guessAisleId('Färsk pasta')).toBe('skafferi')
    })

    it('"Vetemjöl" (flour) lands in skafferi, not mejeri via the "mjöl" substring of "mjölk"', () => {
      expect(guessAisleId('Vetemjöl')).toBe('skafferi')
      expect(guessAisleId('Mjölk')).toBe('mejeri')
    })

    it('"Laxfilé" (fillet) lands in kött/fisk, not mejeri via the "fil" substring of "filé"', () => {
      expect(guessAisleId('Laxfilé')).toBe('kott_fisk')
      expect(guessAisleId('Filmjölk')).toBe('mejeri')
    })
  })

  it('an unrecognized name falls back to övrigt', () => {
    expect(guessAisleId('Xyzzyplopp helt okänd produkt')).toBe('ovrigt')
  })
})

describe('aisleRank', () => {
  it('ranks frukt_gront before dryck, matching AISLE_ORDER', () => {
    expect(aisleRank('Bananer')).toBeLessThan(aisleRank('Kaffe'))
  })

  it('is store-independent today since every store shares the same placeholder sequence', () => {
    expect(aisleRank('Bananer', 'willys')).toBe(aisleRank('Bananer', 'ica'))
    expect(aisleRank('Bananer', 'hemkop')).toBe(aisleRank('Bananer', undefined))
  })
})

describe('aisleLabel', () => {
  it('returns a human label for a known aisle id', () => {
    expect(aisleLabel('frukt_gront')).toBe('Frukt & Grönt')
  })

  it('falls back to Övrigt for an unknown id', () => {
    expect(aisleLabel('not-a-real-aisle')).toBe('Övrigt')
  })
})

describe('sortByAisle', () => {
  it('sorts items by aisle order, then alphabetically (Swedish collation) within an aisle', () => {
    const items = ['Kaffe', 'Äpplen', 'Bananer', 'Mjölk']
    const sorted = sortByAisle(items, x => x)
    // frukt_gront (Bananer, then Äpplen — 'sv' collation sorts Å/Ä/Ö after Z, not with A)
    // before mejeri (Mjölk) before dryck (Kaffe).
    expect(sorted).toEqual(['Bananer', 'Äpplen', 'Mjölk', 'Kaffe'])
  })
})

describe('groupByAisle', () => {
  it('groups consecutive same-aisle items into one group with the right label', () => {
    const items = ['Äpplen', 'Bananer', 'Mjölk']
    const groups = groupByAisle(items, x => x)
    expect(groups.map(g => g.id)).toEqual(['frukt_gront', 'mejeri'])
    expect(groups[0].label).toBe('Frukt & Grönt')
    expect(groups[0].items).toEqual(['Bananer', 'Äpplen'])
    expect(groups[1].items).toEqual(['Mjölk'])
  })
})
