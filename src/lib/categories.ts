import { GROUPS } from './kategoriTaxonomy.mjs'

export interface KategoriOption {
  id: string
  label: string
  emoji: string
}

/** Canonical list of valid `kategori` ids for erbjudanden, used by the
 * category-mismatch picker (long-press an offer in Fynd). Built directly from
 * kategoriTaxonomy.mjs — the taxonomy module — rather than a hand-copied id list, so
 * this can't drift out of sync with the real taxonomy. Only leaf ids are offered here
 * (not group ids); a group id is a valid `matchesBevakning` target but never a real
 * offer's `kategori`. */
export const KATEGORI_OPTIONS: KategoriOption[] = GROUPS.flatMap(g =>
  g.leaves.map(l => ({ id: l.id, label: `${g.label} · ${l.label}`, emoji: g.emoji })),
)

const KATEGORI_LABELS = new Map(KATEGORI_OPTIONS.map(o => [o.id, o.label]))

export function kategoriLabel(id: string): string {
  return KATEGORI_LABELS.get(id) ?? id
}
