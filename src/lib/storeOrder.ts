// Shopping-list aisle ("store walk") ordering — a generic Swedish grocery-store walk
// order used as a placeholder until real per-store aisle layouts are configured (see
// CLAUDE.md: store-specific ordering is a planned follow-up, this is the interim
// default).
//
// This used to carry its own hand-maintained keyword classifier (`guessAisleCategory`,
// a ~10-category list that drifted from `erbjudanden-lib.mjs`'s `guessKategori` more
// than once — see CLAUDE.md's "Two taxonomies already exist and disagree"). The
// categorisation-rework design issue (2026-07) replaced both with a single shared
// classifier (`kategoriClassify.mjs`) and a single taxonomy (`kategoriTaxonomy.mjs`);
// this file now only maps a taxonomy leaf (+ its `form`) to a walk-order aisle id via
// `aisleFor()` — it does not re-derive a category from a product name itself, and
// there is exactly one place in the codebase that does that keyword matching.
import { classify } from './kategoriClassify.mjs'
import { aisleFor, AISLE_ORDER } from './kategoriTaxonomy.mjs'

const AISLE_LABELS: Record<string, string> = {
  frukt_gront: 'Frukt & Grönt',
  brod: 'Bröd',
  kott_fisk: 'Kött & Fisk',
  mejeri: 'Mejeri & Ost',
  skafferi: 'Skafferi',
  fryst: 'Fryst',
  dryck: 'Dryck',
  snacks_godis: 'Snacks & Godis',
  hushall: 'Hushåll & Hygien',
  barn: 'Barn',
  djur: 'Djur',
  ovrigt: 'Övrigt',
}

/** Per-store walk order — every store uses the same placeholder sequence today
 * (`AISLE_ORDER`), but each store gets its own array so a real, distinct aisle order
 * can be dropped in per store later without touching the categorizer at all. */
const AISLE_SEQUENCES: Record<string, string[]> = {
  willys: AISLE_ORDER,
  ica: AISLE_ORDER,
  hemkop: AISLE_ORDER,
}

function sequenceFor(store?: string | null): string[] {
  return (store && AISLE_SEQUENCES[store]) || AISLE_ORDER
}

/** Best-effort aisle guess for a grocery item name — used for items that only carry a
 * plain name (a hand-typed "Eget tillägg" list entry, or a recipe ingredient that
 * hasn't been backfilled with its own `kategori` yet, see Ingredient.kategori in
 * types.ts). An item with a known taxonomy leaf already assigned (an offer, or a
 * recipe ingredient authored with `kategori` set) should call `aisleFor()` directly
 * instead of re-classifying its name here. */
export function guessAisleId(name: string): string {
  const { kategori, form } = classify(name, null, '')
  return aisleFor(kategori, form)
}

/** Rank within one store's walk order (or the shared placeholder order if `store` is
 * unset/unknown) — lower sorts first. */
export function aisleRank(name: string, store?: string | null): number {
  const seq = sequenceFor(store)
  const idx = seq.indexOf(guessAisleId(name))
  return idx === -1 ? seq.length : idx
}

export function aisleLabel(id: string): string {
  return AISLE_LABELS[id] ?? 'Övrigt'
}

/** Sorts by one store's aisle order (see `aisleRank`), then alphabetically within each aisle. */
export function sortByAisle<T>(items: T[], getName: (item: T) => string, store?: string | null): T[] {
  return [...items].sort((a, b) => {
    const diff = aisleRank(getName(a), store) - aisleRank(getName(b), store)
    if (diff !== 0) return diff
    return getName(a).localeCompare(getName(b), 'sv')
  })
}

export interface AisleGroup<T> {
  id: string
  label: string
  items: T[]
}

/** Groups already-aisle-sorted items into consecutive runs per aisle, for section headers. */
export function groupByAisle<T>(items: T[], getName: (item: T) => string, store?: string | null): AisleGroup<T>[] {
  const sorted = sortByAisle(items, getName, store)
  const groups: AisleGroup<T>[] = []
  for (const item of sorted) {
    const id = guessAisleId(getName(item))
    const last = groups[groups.length - 1]
    if (last && last.id === id) last.items.push(item)
    else groups.push({ id, label: aisleLabel(id), items: [item] })
  }
  return groups
}
