import { CATEGORY_EMOJI } from './bevaka'

export interface KategoriOption {
  id: string
  label: string
  emoji: string
}

const KATEGORI_LABELS: Record<string, string> = {
  protein_farsk: 'Protein · Färskt',
  protein_fryst: 'Protein · Fryst',
  gront_farsk: 'Grönt · Färskt',
  gront_fryst: 'Grönt · Fryst',
  frukt: 'Frukt',
  mejeri: 'Mejeri',
  brod: 'Bröd & Bakverk',
  fardigmat: 'Färdigmat',
  dryck: 'Dryck',
  skafferi: 'Skafferi',
  snacks_godis: 'Snacks & godis',
  hygien_hushall: 'Hygien & Hushåll',
  ovrigt: 'Övrigt',
}

/** Canonical list of valid `kategori` ids for erbjudanden, used by the category-mismatch
 * picker (long-press an offer in Fynd). Built from `bevaka.ts`'s `CATEGORY_EMOJI` (the one
 * place that already lists every category id) rather than a fresh id list, so this can't
 * silently drift out of sync with the real taxonomy — only the display label is new here. */
export const KATEGORI_OPTIONS: KategoriOption[] = Object.keys(CATEGORY_EMOJI).map(id => ({
  id,
  label: KATEGORI_LABELS[id] ?? id,
  emoji: CATEGORY_EMOJI[id],
}))

export function kategoriLabel(id: string): string {
  return KATEGORI_LABELS[id] ?? id
}
