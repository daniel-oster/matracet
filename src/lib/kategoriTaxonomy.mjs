// Canonical erbjudanden category taxonomy — the ONE place group/leaf ids, labels,
// emoji, aisle mapping and display order live. See the "Rework offer categorisation"
// design issue (2026-07) for the full rationale: granularity follows attention, not
// store-shelf symmetry (deep where the household cooks — protein, produce — shallow
// where it skims — hygien, djur), and diet (vegansk/vegetarisk) is a `markeringar`
// flag, never a category, because real vego products span sauces/drinks/meatballs
// that no single "vego" leaf could ever hold (see e.g. "Vegan mayo" → sas_dressing,
// "Vegokorv" → korv, right next to the meat sausage it substitutes for).
//
// Plain isomorphic ESM (no Node built-ins, no browser globals) so it can be imported
// directly both by scripts/*.mjs (Node) and by the Vite/React app (src/*.ts, via
// tsconfig.app.json's `allowJs`) — one physical file, zero drift between a "script"
// copy and an "app" copy of the same knowledge (see CLAUDE.md's repeated warnings
// about exactly that drift happening with the old guessKategori/guessAisleCategory
// pair).
//
// `aisle` on a group is the *default* shopping-list aisle for its leaves; a leaf
// whose offer/ingredient has `form: 'fryst'` is walked in the `fryst` aisle instead,
// regardless of its group's default (see aisleFor() below) — this is what replaces
// storeOrder.ts's old guessAisleCategory keyword list with a lookup.

/** @typedef {{id: string, label: string}} KategoriLeaf */
/** @typedef {{id: string, label: string, emoji: string, aisle: string, standardDold?: boolean, leaves: KategoriLeaf[]}} KategoriGroup */

export const GROUPS = [
  {
    id: 'frukt_gront', label: 'Frukt & Grönt', emoji: '🥦', aisle: 'frukt_gront',
    leaves: [
      { id: 'frukt', label: 'Frukt' },
      { id: 'bar', label: 'Bär' },
      { id: 'gronsaker', label: 'Grönsaker' },
      { id: 'potatis_rotfrukt', label: 'Potatis & rotfrukt' },
      { id: 'lok', label: 'Lök & vitlök' },
      { id: 'svamp', label: 'Svamp' },
      { id: 'farska_kryddor', label: 'Färska kryddor' },
    ],
  },
  {
    id: 'protein', label: 'Protein', emoji: '🥩', aisle: 'kott_fisk',
    leaves: [
      { id: 'kott', label: 'Kött' },
      { id: 'fars_kottbullar', label: 'Färs & köttbullar' },
      { id: 'fagel', label: 'Fågel' },
      { id: 'fisk', label: 'Fisk' },
      { id: 'skaldjur', label: 'Skaldjur' },
      { id: 'inlagd_fisk_kaviar', label: 'Inlagd fisk & kaviar' },
      { id: 'agg', label: 'Ägg' },
      { id: 'korv', label: 'Korv' },
      { id: 'bacon_skinka', label: 'Bacon & skinka' },
      { id: 'charkuterier', label: 'Charkuterier' },
      { id: 'palagg_pastej', label: 'Pålägg & pastej' },
      { id: 'tofu_tempeh', label: 'Tofu & tempeh' },
      { id: 'baljvaxter', label: 'Baljväxter' },
    ],
  },
  {
    id: 'mejeri_ost', label: 'Mejeri & Ost', emoji: '🧀', aisle: 'mejeri',
    leaves: [
      { id: 'mjolk_gradde', label: 'Mjölk & grädde' },
      { id: 'fil_yoghurt', label: 'Fil & yoghurt' },
      { id: 'smor_margarin', label: 'Smör & margarin' },
      { id: 'ost_hard', label: 'Hårdost' },
      { id: 'ost_fars_mjuk', label: 'Färskost & mjukost' },
      { id: 'ost_vit_grill', label: 'Vitost & grillost' },
    ],
  },
  {
    id: 'brod', label: 'Bröd', emoji: '🍞', aisle: 'brod',
    leaves: [
      { id: 'matbrod', label: 'Matbröd' },
      { id: 'frallor_tunnbrod', label: 'Frallor & tunnbröd' },
      { id: 'knackebrod', label: 'Knäckebröd' },
      { id: 'korv_hamburgerbrod', label: 'Korv- & hamburgerbröd' },
      { id: 'fikabrod', label: 'Fikabröd' },
      { id: 'tarta_kaka', label: 'Tårta & kaka' },
      { id: 'kex', label: 'Kex' },
    ],
  },
  {
    id: 'fardigmat', label: 'Färdigmat', emoji: '🍕', aisle: 'skafferi',
    leaves: [
      { id: 'pizza', label: 'Pizza' },
      { id: 'gratang_paj', label: 'Gratäng & paj' },
      { id: 'enportionsratt', label: 'Enportionsrätt' },
      { id: 'potatisprodukter', label: 'Potatisprodukter' },
      { id: 'deli_sallad_wrap', label: 'Delisallad & wrap' },
      { id: 'kyld_soppa', label: 'Kyld soppa' },
    ],
  },
  {
    id: 'glass_dessert', label: 'Glass & Dessert', emoji: '🍨', aisle: 'fryst',
    leaves: [
      { id: 'glass', label: 'Glass' },
      { id: 'dessert', label: 'Dessert' },
      { id: 'dessertsas', label: 'Dessertsås' },
    ],
  },
  {
    id: 'godis_snacks', label: 'Godis & Snacks', emoji: '🍫', aisle: 'snacks_godis',
    leaves: [
      { id: 'choklad', label: 'Choklad' },
      { id: 'godis', label: 'Godis' },
      { id: 'chips_snacks', label: 'Chips & snacks' },
      { id: 'notter_torkat', label: 'Nötter & torkat' },
      { id: 'bars', label: 'Bars' },
    ],
  },
  {
    id: 'dryck', label: 'Dryck', emoji: '🥤', aisle: 'dryck',
    leaves: [
      { id: 'kaffe_te', label: 'Kaffe & te' },
      { id: 'lask_vatten', label: 'Läsk & vatten' },
      { id: 'juice_saft', label: 'Juice & saft' },
      { id: 'vaxtdryck', label: 'Växtdryck' },
      { id: 'ol_cider', label: 'Öl & cider' },
      { id: 'energidryck', label: 'Energidryck' },
    ],
  },
  {
    id: 'skafferi', label: 'Skafferi', emoji: '🥫', aisle: 'skafferi',
    leaves: [
      { id: 'pasta', label: 'Pasta' },
      { id: 'ris_gryn', label: 'Ris & gryn' },
      { id: 'flingor_musli', label: 'Flingor & müsli' },
      { id: 'konserv_tomat', label: 'Konserverad tomat' },
      { id: 'sas_dressing', label: 'Sås & dressing' },
      { id: 'olja_vinager', label: 'Olja & vinäger' },
      { id: 'kryddor_buljong', label: 'Kryddor & buljong' },
      { id: 'bak_sott', label: 'Bak & sött' },
      { id: 'inlagt_delikatess', label: 'Inlagt & delikatess' },
    ],
  },
  {
    id: 'hushall_hygien', label: 'Hushåll & Hygien', emoji: '🧴', aisle: 'hushall',
    leaves: [
      { id: 'stad_disk_tvatt', label: 'Städ, disk & tvätt' },
      { id: 'papper_pasar_folie', label: 'Papper, påsar & folie' },
      { id: 'engangs_grill', label: 'Engångs & grill' },
      { id: 'skadedjur', label: 'Skadedjur' },
      { id: 'hygien', label: 'Hygien' },
      { id: 'halsa', label: 'Hälsa' },
    ],
  },
  {
    id: 'barn', label: 'Barn', emoji: '👶', aisle: 'barn', standardDold: true,
    leaves: [
      { id: 'bloja_babyvard', label: 'Blöja & babyvård' },
      { id: 'barnmat', label: 'Barnmat' },
    ],
  },
  {
    id: 'djur', label: 'Djur', emoji: '🐾', aisle: 'djur', standardDold: true,
    leaves: [
      { id: 'djurmat', label: 'Djurmat' },
      { id: 'djurgodis_tillbehor', label: 'Djurgodis & tillbehör' },
    ],
  },
  {
    id: 'ovrigt', label: 'Övrigt', emoji: '📦', aisle: 'ovrigt', standardDold: true,
    leaves: [
      { id: 'blommor_vaxter', label: 'Blommor & växter' },
      { id: 'ovrigt', label: 'Övrigt' },
    ],
  },
]

/** Shopping-list aisle walk order (frukt_gront → ... → ovrigt), independent of the
 * category-group order above (which is optimized for browsing Fynd, not shopping). */
export const AISLE_ORDER = [
  'frukt_gront', 'brod', 'kott_fisk', 'mejeri', 'skafferi', 'fryst',
  'dryck', 'snacks_godis', 'hushall', 'barn', 'djur', 'ovrigt',
]

export const GROUP_ORDER = GROUPS.map(g => g.id)

/** leaf id -> its group */
export const LEAF_TO_GROUP = new Map(
  GROUPS.flatMap(g => g.leaves.map(l => [l.id, g])),
)

const LEAF_LABEL = new Map(GROUPS.flatMap(g => g.leaves.map(l => [l.id, l.label])))
const GROUP_LABEL = new Map(GROUPS.map(g => [g.id, g.label]))
const GROUP_EMOJI = new Map(GROUPS.map(g => [g.id, g.emoji]))

export function leafLabel(leafId) {
  return LEAF_LABEL.get(leafId) ?? leafId
}

export function groupLabel(groupId) {
  return GROUP_LABEL.get(groupId) ?? groupId
}

export function groupOf(leafId) {
  return LEAF_TO_GROUP.get(leafId)?.id ?? 'ovrigt'
}

export function emojiFor(leafId) {
  const g = LEAF_TO_GROUP.get(leafId)
  return g ? GROUP_EMOJI.get(g.id) : '📦'
}

/** All valid leaf ids, for validation (verifier, KATEGORI_OPTIONS). */
export function allLeafIds() {
  return GROUPS.flatMap(g => g.leaves.map(l => l.id))
}

/** `form: 'fryst'` always wins the walk-order aisle regardless of the leaf's default
 * group aisle (a frozen salmon is still salmon for meal planning, but it's walked in
 * the freezer aisle) — this is the one lookup that replaces the old guessAisleCategory
 * keyword classifier entirely; see storeOrder.ts. */
export function aisleFor(leafId, form) {
  if (form === 'fryst') return 'fryst'
  const g = LEAF_TO_GROUP.get(leafId)
  return g ? g.aisle : 'ovrigt'
}

/** Groups worth showing while planning meals — see the 2026-08 Planera redesign (issue #93).
 * "Food only" per the household's own framing ("I don't need to see that tampons are on sale
 * when I'm planning dinner"): excludes hushall_hygien/barn/djur/ovrigt outright (the first
 * three are non-food, ovrigt is the genuine remainder), and — a second, narrower cut — also
 * excludes godis_snacks/glass_dessert/dryck by default: real food, but not meal-building
 * material. A single named export rather than a scattered inline list so FyndView-adjacent
 * screens (Planera's offer strip today, possibly Fynd's own default-collapse later) share one
 * definition instead of drifting apart. */
export const MEAL_PLANNING_GROUPS = ['frukt_gront', 'protein', 'mejeri_ost', 'brod', 'fardigmat', 'skafferi']
