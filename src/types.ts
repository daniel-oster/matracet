export type TabName = 'veckan' | 'handla' | 'recept' | 'familj' | 'anteckningar' | 'fynd' | 'bevaka' | 'skafferi' | 'historik' | 'synka'
export type ScreenName = 'hub' | TabName
export type MealKind = 'lunch' | 'dinner'

/** Storage/freshness attribute, independent of `kategori` — see the categorisation
 * rework design issue (2026-07): a frozen salmon is still salmon for meal planning,
 * but a different thing for a shopping round, so this doesn't fork the category tree
 * the way the old protein_farsk/protein_fryst split did. */
export type OfferForm = 'farsk' | 'kyld' | 'fryst' | 'torr' | 'konserv' | null

/** Where an offer's `kategori`/`form`/`varutyp` came from — 'manuell' entries are a
 * human correction (via CategoryFeedbackModal → sync-category-feedback, or a direct
 * hand-fix during import) and must never be silently overwritten by a re-classification
 * pass; see scripts/erbjudanden-verify.mjs. */
export type KategoriKalla = 'regel' | 'model' | 'manuell'

/** One offer from a store's weekly specials (see public/data/erbjudanden/README.md) */
export interface Offer {
  namn: string
  marke: string | null
  storlek: string | null
  pris_text: string
  pris: number | null
  pris_typ: string
  jamforpris: string | null
  ord_pris: string | null
  pris_30dgr: string | null
  besparing: string | null
  klubbpris: boolean
  max_kop: number | null
  markeringar: string[]
  ursprung: string | null
  notering: string | null
  /** Leaf id from src/lib/kategoriTaxonomy.mjs (e.g. "kott", "ost_hard") */
  kategori: string
  form?: OfferForm
  /** Finer-than-kategori grouping for "would I swap one for the other in a recipe" —
   * e.g. every bean product shares varutyp "bonor" regardless of kategori-leaf-mates
   * or which store it's from. Defaults to the kategori leaf id when no finer split has
   * been made yet (see design issue §3.5) — never assume it differs from kategori. */
  varutyp?: string
  kategori_kalla?: KategoriKalla
  /** Per-offer validity, when this one runs on a different clock than the flyer it was
   * captured with — Hemköp's personal "Bara för dig" coupons routinely end mid-week or run
   * a week longer than the surrounding flyer (their source page states an end date per
   * product). Absent on the ordinary case, where the file's own giltigt_fran/giltigt_till
   * apply; see src/lib/offerValidity.ts, which is the only thing that reads these. */
  giltigt_fran?: string | null
  giltigt_till?: string | null
}

/** One entry in public/data/erbjudanden/_kategori-lexikon.json, keyed by a normalized
 * name+brand product key (see scripts/erbjudanden-lexikon.mjs). Deterministic,
 * cross-week product identity — the whole point of the lexicon is that the same
 * product gets the same verdict every week without re-classifying it. */
export interface KategoriLexikonEntry {
  kategori: string
  form: OfferForm
  varutyp: string
  markeringar?: string[]
  confidence: 'hog' | 'lag'
  motivering?: string
  kalla: KategoriKalla
  updated: string
}

export type KategoriLexikon = Record<string, KategoriLexikonEntry>

/** One store's flyer for a given week */
export interface StoreOffers {
  schema_version: number
  kalla: string
  butik: string
  butik_id: string
  vecka: string
  giltigt_fran: string
  giltigt_till: string
  hamtad: string
  kalla_url: string | null
  urval: string
  antal: number
  erbjudanden: Offer[]
}

export interface OffersIndex {
  butiker: { id: string; kalla: string; namn: string; fullnamn: string }[]
  veckor: string[]
}

export interface OffersLatest {
  vecka: string
}

/** One standing watch-list entry — a product to buy in bulk whenever it's a genuine bargain. */
export interface BevakningItem {
  id: string
  vara: string
  kategori: string
  /** Lowercase substrings matched against an offer's namn/marke to detect a hit. Empty = watch the whole `kategori` instead. */
  sok: string[]
  /** Brand substrings that disqualify an otherwise-matching offer. */
  undvik_marken: string[]
  onskat_marke: string | null
  storlek_hint: string | null
  troskel_kr: number | null
  anteckning: string | null
}

export interface Bevakningslista {
  schema_version: number
  varor: BevakningItem[]
}

export interface Ingredient {
  vara: string
  mangd: number
  enhet: string
  grupp?: string | null
  /** Leaf id from src/lib/kategoriTaxonomy.mjs, set at recipe-authoring time so the
   * shopping list never needs to classify a recipe-derived item at runtime (see
   * storeOrder.ts). Not yet backfilled onto existing recipes — optional and only
   * consumed when present; falls back to a live classify() call by ingredient name
   * otherwise (see useShoppingList.ts). */
  kategori?: string | null
}

export interface RecipeVariant {
  byt: Record<string, string>
}

/** Full recipe — loaded on demand from /data/recipes/<slug>/recept.json */
export interface Recipe {
  schema_version: string
  slug: string
  nummer: number
  namn: string
  tid_min: number
  portioner: number
  kategorier: string[]
  sasong: string[]
  svarighet: string
  barnvanlig: string
  taggar: string[]
  kalla?: string
  kallaUrl?: string
  dagkedja?: string | null
  bildUrl?: string
  ingredienser: Ingredient[]
  varianter?: Record<string, RecipeVariant>
  instruktioner: string[]
  servering?: string[]
  tips?: string
  komplett: boolean
}

/** Lightweight entry used in the list index */
export interface RecipeIndexEntry {
  slug: string
  nummer: number
  namn: string
  tid_min: number
  kategorier: string[]
  bildUrl?: string
  /** Optional *subset* of the full recipe's `taggar`, carried in the index only when a tag
   *  changes how the recipe behaves in lists — today that means the non-meal tags in
   *  src/lib/recipeKind.ts (bakning/efterrätt/…), which keep a recipe out of meal planning.
   *  Never treat this as the complete tag list; read the recipe's own recept.json for that. */
  taggar?: string[]
}

export interface RecipeIndex {
  recipes: RecipeIndexEntry[]
}

export interface DayMeal {
  dag: string
  datum: string
  recept: string | null
  receptSlug?: string
  /** Resolved at load time by matching `recept` against meals.json namn/alias (see
   *  src/lib/mealResolve.ts) — public/data/weeks/*.json itself stays free text, this is
   *  never written back to those files. Undefined until that resolution has run. */
  mealSlug?: string
  kommentar?: string
  anteckning?: string
  varianter?: Record<string, string>
}

export interface WeekNote {
  nar: string
  text: string
}

export interface WeekMenu {
  vecka: string
  middagar: DayMeal[]
  luncher?: DayMeal[]
  anteckningar: WeekNote[]
  skapad: string
}

export interface Eater {
  id: string
  namn: string
  roll: string
  halsa?: string[]
  kost?: string[]
  gillar: string[]
  undviker: string[]
}

export interface EatersData {
  eaters: Eater[]
}

export interface PantryItem {
  vara: string
  exp?: string
  antal?: number
}

export interface Pantry {
  always_have: string[]
  current_stock: PantryItem[]
}
