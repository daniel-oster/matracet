#!/usr/bin/env node
/**
 * The lexicon half of the "lexicon-first, model generates, rules verify" pipeline
 * (see the categorisation-rework design issue, 2026-07): a Git-tracked, cross-week
 * product → {kategori, form, varutyp, markeringar} map at
 * public/data/erbjudanden/_kategori-lexikon.json, keyed by a normalized name+brand
 * product identity — NOT by store or week, so "Präst | Arla" gets the same verdict
 * every time it recurs, and a human correction (kalla: 'manuell') sticks permanently
 * instead of being re-guessed on the next import.
 *
 * Deliberately no fuzzy matching on the key (see the design issue §3.3.4): a near-
 * duplicate spelling costs one extra classify() call, which is cheap; a false *hit*
 * from fuzzy matching would silently assign the wrong category, which is expensive to
 * ever notice again.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

export const LEXIKON_PATH = new URL('../public/data/erbjudanden/_kategori-lexikon.json', import.meta.url).pathname

/** "Kidneybönor" / "Garant" -> "kidneybonor~garant". Ascii-folds (å/ä->a, ö->o) and
 * strips size/percent tokens so "500g"/"24%" variants of the same product collapse
 * to one key — same normalization spirit as FyndView's Jämför-mode normalizeKey. */
export function normalizeProductKey(namn, marke) {
  const fold = (s) =>
    (s ?? '')
      .toLowerCase()
      .replace(/[åä]/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/\b\d+([.,]\d+)?\s*(g|kg|ml|cl|l|st|dl|p|pack|förp|%)\b/gi, '')
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  return `${fold(namn)}~${fold(marke)}`
}

export function loadLexikon(path = LEXIKON_PATH) {
  if (!existsSync(path)) return {}
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Writes with sorted keys so the diff of a re-import is small and reviewable. */
export function saveLexikon(lexikon, path = LEXIKON_PATH) {
  const sorted = {}
  for (const key of Object.keys(lexikon).sort()) sorted[key] = lexikon[key]
  writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n')
}

export function lookupLexikon(lexikon, namn, marke) {
  return lexikon[normalizeProductKey(namn, marke)]
}

/** Inserts/overwrites an entry — refuses to clobber a `kalla: 'manuell'` entry unless
 * the caller explicitly passes `force: true` (used only by the human-correction path
 * itself, e.g. sync-category-feedback). */
export function upsertLexikon(lexikon, namn, marke, entry, { force = false } = {}) {
  const key = normalizeProductKey(namn, marke)
  const existing = lexikon[key]
  if (existing?.kalla === 'manuell' && !force) return lexikon
  lexikon[key] = { ...entry, updated: new Date().toISOString().slice(0, 10) }
  return lexikon
}

/** Applies a lexicon entry's verdict onto an offer object, in place, respecting an
 * offer-level 'manuell' lock the same way upsertLexikon respects the lexicon's own. */
export function applyLexikonEntry(offer, entry) {
  if (offer.kategori_kalla === 'manuell') return offer
  offer.kategori = entry.kategori
  offer.form = entry.form
  offer.varutyp = entry.varutyp
  offer.kategori_kalla = entry.kalla
  if (entry.markeringar?.length) {
    offer.markeringar = [...new Set([...(offer.markeringar ?? []), ...entry.markeringar])]
  }
  return offer
}
