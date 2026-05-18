export type TabName = 'veckan' | 'handla' | 'recept' | 'familj' | 'anteckningar'
export type PageSide = 'left' | 'right'

export interface Ingredient {
  vara: string
  mangd: number
  enhet: string
}

export interface RecipeVariant {
  byt: Record<string, string>
}

export interface Recipe {
  slug: string
  namn: string
  tid_min: number
  kategorier: string[]
  sasong: string[]
  svarighet: string
  barnvanlig: boolean
  taggar: string[]
  ingredienser: Ingredient[]
  varianter?: Record<string, RecipeVariant>
  body: string
}

export interface DayMeal {
  dag: string
  datum: string
  recept: string | null
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
