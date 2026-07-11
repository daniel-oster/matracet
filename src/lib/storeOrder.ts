/**
 * "Normal order" aisle sequence for the shopping list — a generic Swedish grocery-store
 * walk order used as a placeholder until real per-store aisle layouts are configured
 * (see CLAUDE.md: store-specific ordering is a planned follow-up, this is the interim default).
 */
export interface AisleCategory {
  id: string
  label: string
}

export const AISLE_CATEGORIES: AisleCategory[] = [
  { id: 'frukt_gront', label: 'Frukt & Grönt' },
  { id: 'brod', label: 'Bröd' },
  { id: 'kott_fisk', label: 'Kött & Fisk' },
  { id: 'mejeri', label: 'Mejeri & Ägg' },
  { id: 'skafferi', label: 'Skafferi' },
  { id: 'fryst', label: 'Fryst' },
  { id: 'dryck', label: 'Dryck' },
  { id: 'snacks_godis', label: 'Snacks & Godis' },
  { id: 'hushall', label: 'Hushåll & Hygien' },
  { id: 'ovrigt', label: 'Övrigt' },
]

const AISLE_LABEL = new Map(AISLE_CATEGORIES.map(c => [c.id, c.label]))
const DEFAULT_SEQUENCE = AISLE_CATEGORIES.map(c => c.id)

/** Per-store walk order — every store uses the same placeholder sequence today
 * (`DEFAULT_SEQUENCE`), but each store gets its own array so a real, distinct aisle
 * order can be dropped in per store later without touching the categorizer at all. */
const AISLE_SEQUENCES: Record<string, string[]> = {
  willys: DEFAULT_SEQUENCE,
  ica: DEFAULT_SEQUENCE,
  hemkop: DEFAULT_SEQUENCE,
}

function sequenceFor(store?: string | null): string[] {
  return (store && AISLE_SEQUENCES[store]) || DEFAULT_SEQUENCE
}

function includesAny(hay: string, words: string[]): boolean {
  return words.some(w => hay.includes(w))
}

function matchesAny(hay: string, words: string[], patterns: RegExp[] = []): boolean {
  return includesAny(hay, words) || patterns.some(p => p.test(hay))
}

// Checked in this exact order — narrower/compound-word groups first, so e.g.
// "kokosmjölk" (skafferi) resolves before the broad "mjölk" (mejeri) keyword ever runs,
// and "kaffebönor" (dryck) resolves before the broad "böna" (skafferi) keyword.
// See CLAUDE.md "Lessons learned" for the substring-collision trap this guards against.
const AMBIGUOUS_RE: [RegExp, string][] = [
  [/pålägg/, 'ovrigt'], // generic "sandwich topping", any kind — can't classify narrower
]

const HUSHALL_WORDS = [
  'tvättmedel', 'diskmedel', 'diskborste', 'disksvamp', 'handdisk',
  'toalettpapper', 'hushållspapper', 'rengöring', 'rengör', 'städ',
  'servett', 'tandkräm', 'schampo', 'tvål', 'sopsäck', 'blöja', 'plastfolie', 'bakplåtspapper',
]
const SNACKS_WORDS = ['godis', 'choklad', 'chips', 'kex', 'lakrits', 'karamell', 'popcorn', 'jordnötsring']
const DRYCK_WORDS = ['kaffe', ' te ', 'läsk', 'juice', 'saft', ' öl', 'vin', 'cider', 'mineralvatten', 'dricka', 'vatten']
const FRYST_WORDS = ['fryst', 'frysta', 'glass']
const SKAFFERI_WORDS = [
  'pasta', 'spagetti', 'fusilli', 'penne', 'makaroner', 'lasagneplatt', 'nudlar', 'äggnudlar', 'äggpasta',
  'ris', 'quinoa', 'couscous', 'socker', 'honung', 'sirap', 'russin',
  'mandel', 'cashew', 'jordnöt', 'sesam', 'kikärt', 'lins', 'kokosmjölk', 'kokosgrädde', 'jordnötssmör',
  'konserv', 'buljong', 'fond', 'olja', 'vinäger', 'ketchup', 'senap', 'majonnäs', 'curry', 'krydda',
  'peppar', 'salt', 'soja', 'ströbröd', 'böna', 'bönor', 'tomatpuré', 'krossade tomater', 'passerade tomater',
]
// "mjöl" (flour) as a bare substring also matches inside "mjölk" (milk) — exclude that one case.
const SKAFFERI_PATTERNS = [/mjöl(?!k)/]
const MEJERI_WORDS = [
  'mjölk', 'grädde', 'yoghurt', 'yogurt', 'kvarg', 'keso', 'ost', 'halloumi',
  'smör', 'margarin', 'ägg', 'crème fraiche', 'creme fraiche', 'mozzarella', 'parmesan', 'fetaost',
]
// "fil" (cultured milk) as a bare substring also matches inside "filé" (meat/fish fillet, e.g.
// "laxfilé") — exclude that one case; the actual protein keyword (lax/oxfilé/...) picks it up instead.
const MEJERI_PATTERNS = [/fil(?!é)/]
const KOTT_FISK_WORDS = [
  'kött', 'fläsk', 'färs', 'kyckling', 'bacon', 'sidfläsk', 'skinka', 'korv', 'salami', 'prosciutto',
  'biff', 'entrecote', 'oxfilé', 'karré', 'revben', 'kalkon', 'anka', 'lamm', 'vilt',
  'fisk', 'torsk', 'lax', 'sej', 'kolja', 'räka', 'räkor', 'mussl', 'bläckfisk', 'tonfisk', 'sill', 'ansjovis',
  'tofu', 'quorn', 'seitan', 'tempeh',
]
const BROD_WORDS = ['bröd', 'limpa', 'fralla', 'baguette', 'tortilla', 'pitabröd', 'knäckebröd', 'skorpor', 'croissant', 'bulle']
const FRUKT_GRONT_WORDS = [
  'lök', 'morot', 'potatis', 'tomat', 'gurka', 'paprika', 'broccoli', 'blomkål', 'zucchini', 'aubergine',
  'spenat', 'sallad', 'citron', 'lime', 'äpple', 'banan', 'päron', 'apelsin', 'avokado', 'champinjon', 'svamp',
  'kål', 'chili', 'ingefära', 'koriander', 'basilika', 'persilja', 'dill', 'sötpotatis', 'pumpa', 'frukt', 'grönt',
]

/** Best-effort aisle guess for a grocery item name — the interim "normal order" categorizer. */
export function guessAisleCategory(name: string): string {
  // "färsk(t/a)" (fresh, an adjective) contains "färs" (mince/ground meat) as a substring —
  // strip it before matching so e.g. "Grönt (färskt)" doesn't land in kött_fisk.
  const hay = ` ${name.trim().toLowerCase()} `.replace(/färsk\w*/g, ' ')

  for (const [re, id] of AMBIGUOUS_RE) if (re.test(hay)) return id

  if (includesAny(hay, HUSHALL_WORDS)) return 'hushall'
  if (includesAny(hay, SNACKS_WORDS)) return 'snacks_godis'
  if (includesAny(hay, DRYCK_WORDS)) return 'dryck'
  if (includesAny(hay, FRYST_WORDS)) return 'fryst'
  if (matchesAny(hay, SKAFFERI_WORDS, SKAFFERI_PATTERNS)) return 'skafferi'
  if (matchesAny(hay, MEJERI_WORDS, MEJERI_PATTERNS)) return 'mejeri'
  if (includesAny(hay, KOTT_FISK_WORDS)) return 'kott_fisk'
  if (includesAny(hay, BROD_WORDS)) return 'brod'
  if (includesAny(hay, FRUKT_GRONT_WORDS)) return 'frukt_gront'
  return 'ovrigt'
}

/** Rank within one store's walk order (or the shared placeholder order if `store` is
 * unset/unknown) — lower sorts first. */
export function aisleRank(name: string, store?: string | null): number {
  const seq = sequenceFor(store)
  const idx = seq.indexOf(guessAisleCategory(name))
  return idx === -1 ? seq.length : idx
}

export function aisleLabel(id: string): string {
  return AISLE_LABEL.get(id) ?? 'Övrigt'
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
    const id = guessAisleCategory(getName(item))
    const last = groups[groups.length - 1]
    if (last && last.id === id) last.items.push(item)
    else groups.push({ id, label: aisleLabel(id), items: [item] })
  }
  return groups
}
