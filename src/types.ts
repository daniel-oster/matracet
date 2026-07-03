export type TabName = 'veckan' | 'handla' | 'recept' | 'familj' | 'anteckningar' | 'fynd'
export type PageSide = 'left' | 'right'

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
  kategori: string
}

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

export interface Ingredient {
  vara: string
  mangd: number
  enhet: string
  grupp?: string | null
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
}

export interface RecipeIndex {
  recipes: RecipeIndexEntry[]
}

export interface DayMeal {
  dag: string
  datum: string
  recept: string | null
  receptSlug?: string
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
