// Deterministic classifier for the erbjudanden taxonomy (kategoriTaxonomy.mjs).
//
// This is the rule-based half of the "lexicon-first, model generates, rules verify"
// pipeline from the categorisation-rework design issue (2026-07): it is the §3.3.5
// cold-start fallback used whenever a product has no lexicon entry yet. IMPORTANT,
// learned the hard way (see CLAUDE.md's "the lexicon shipped 100% regex output"
// post-mortem): it is NOT a substitute for the model-classification step, however
// good its output looks. `confidence` reflects that — only a `BRAND_OVERRIDES` hit
// (a fact, not a guess) or a caller that already knows the answer some other way
// (an exact lexicon/manual match) may report `'hog'`; every plain regex leaf-rule
// match self-reports `'lag'`, because a regex cascade's opinion of its own certainty
// is not evidence (design issue §3.3.2 — "Red Bull → brod" was a clean,
// single-pattern, maximum-confidence match with no competing category, and it was
// completely wrong). Brand-only names with no generic word left (Präst, Ballerina,
// Jätten...) are fundamentally unreachable by regex no matter how many patterns get
// added here — that ceiling is real and is the actual argument for running the model
// pass on `'lag'` entries, not a problem this file can fix by growing further.
//
// Decision order follows the design issue's §4 prompt almost exactly, just as code
// instead of prose: (0) known brand facts, (1) edibility (non-food bail), (2) a
// "head-noun" pass for compounds where the *product type itself* is unambiguous
// (bread, ready-meal, glass, pasta/rice, dairy) — checked before any produce/flavour
// keyword specifically so e.g. "Tortelloni Ricotta Och Spenat" resolves as pasta, not
// spinach, and "Paprika Lök Färskost" resolves as cream cheese, not vegetables — then
// (3) protein, (4) fruit, (5) snacks (checked before veg — "Fotbollsnacks Paprika" is
// a snack, not a vegetable), (6) veg, (7) drink, (8) remaining pantry goods, (9) ovrigt.
//
// Plain isomorphic ESM — see kategoriTaxonomy.mjs's header for why (imported by both
// Node scripts and the Vite app from one physical file).

import { aisleFor, LEAF_TO_GROUP } from './kategoriTaxonomy.mjs'

// ---------------------------------------------------------------------------
// 0. Known brand facts — names with no generic word left for any regex to catch.
// ---------------------------------------------------------------------------
const BRAND_OVERRIDES = [
  [/after eight/i, 'choklad'],
  [/ella'?s kitchen/i, 'barnmat'],
  // no \b after "grevé" — JS regex \b treats accented letters as non-word chars, so a
  // boundary check right after "é" silently never matches (same class of bug as the
  // documented \böl\b trap); this substring is distinctive enough without one.
  [/\bpräst\b|\bherrgård(?:sost)?\b|grevé|västerbottens?\b|grana padano|\bnorvegia\b/i, 'ost_hard'],
  // Burrata is a fresh/soft cheese (same family as mozzarella, not a hard cheese) —
  // was grouped with the ost_hard pattern above until the "run the 125 hog entries"
  // review caught it; moved in with mozzarella instead.
  [/mozzarella|\bburrata\b/i, 'ost_fars_mjuk'],
  [/ballerina|singoalla|\bbrago\b|digestive|mariekex|\btuc\b|\boreo\b/i, 'kex'],
  [/\bdogman\b|chew rolls|hundbajspås\w*/i, 'djurgodis_tillbehor'],
  // "smart pets" deliberately NOT a blanket override: the brand spans kattmat (food),
  // kattgodis and kattsand (accessories), so the bare brand name was preempting the
  // more specific product word — "Kattsand | SMART PETS" landed in djurmat while
  // "Kattsand | BEST FRIEND" correctly resolved to djurgodis_tillbehor, caught by
  // erbjudanden-verify's cross-source consistency check. Same lesson as Dafgards/Billys.
  [/\bdoggy\b|\blatz\b(?!e)/i, 'djurmat'],
  [/\bjätten\b|\bdumle\b|ahlgrens|\bknatter\b|tutti frutti|tyrkisk peber|frökusar|pingvinstång/i, 'godis'],
  // Kinder is primarily a chocolate brand (Kinder Chocolate/Bueno/Surprise), not
  // boiled-sweets/gummy godis — moved here from the godis line above.
  [/marabou|\bdaim\b|kitkat|\blion\b|smarties|noblesse|\bkinder\b/i, 'choklad'],
  // Lavazza makes coffee and nothing else — "Hela bönor | LAVAZZA" (whole coffee
  // beans) otherwise lands in baljvaxter, since the existing "kaffe AND böna" check
  // needs the word "kaffe" and this product's coffee-ness is only in the brand.
  [/\blavazza\b/i, 'kaffe_te'],
  [/\bbregott\b/i, 'smor_margarin'],
  // "Produkter från gräddhyllan | Flora • Flora by Milda" has no product name at
  // all beyond a generic aisle description ("products from the cream shelf") — the
  // "grädd" substring alone would otherwise fall through to mjolk_gradde, but Flora/
  // Milda are margarine brands, not cream (a lost manual correction reapplied here
  // as a real brand fact after a lexicon reset, per "run the 125" review).
  [/\bflora\b|\bmilda\b/i, 'smor_margarin'],
  [/\byoggi\b|\bproviva\b|\bcultura\b|smakrike/i, 'fil_yoghurt'],
  [/\bgrandiosa\b/i, 'pizza'],
  // "Glace" (GB Glace) doesn't contain the substring "glass", so GLASS_RE's own gate
  // wouldn't catch it on its own — the other frozen-dessert brands (Sia Glass, Triumf
  // Glass) already do contain "glass" and need no override.
  [/gb glace/i, 'glass'],
  // Billys/Dafgårds deliberately NOT overridden blanket-to-enportionsratt — both
  // brands also sell bread (Dafgårds "Grekiskt lantbröd", "Lyxbulle") and pizza
  // (Billys "Pizza supersize"), and a blanket brand override was preempting that
  // more specific, correct signal (found via the golden set, see kategori-golden.json
  // "Grekiskt lantbröd"/"Lyxbulle, Solbulle"/"Pizza supersize"). Only the genuine
  // compound product-type words (not bare brand names) are safe to hardcode here.
  [/ostschnitzel|kycklingschnitzel|fläskschnitzel|\bpirog\b/i, 'enportionsratt'],
  [/red\s*bull/i, 'energidryck'],
  [/palmolive|dusch(?:kräm|creme|gel)?|ansiktstvätt|ansikts\s*scrub|ansiktsvård|ansiktsmask|deospray|\bhyvel\b/i, 'hygien'],
  [/\bwettex\b|\bmopp\b|maskindisk/i, 'stad_disk_tvatt'],
  [/pärsons|smörgåsmat/i, 'palagg_pastej'],
  [/\bmaggi\b/i, 'kryddor_buljong'],
  // Pucko/Cocio are chocolate MILK drinks (a dairy product), not a juice/must —
  // caught by the same "run the 125 hog entries" review as the burrata fix above.
  [/\bpucko\b|\bcocio\b/i, 'mjolk_gradde'],
  // "Snackpot" as one word has no \b in front of "pot", so the two-token form below
  // never matched Hemköp's "Snackpot | Knorr" — the product word itself is safe to
  // hardcode (it is always the instant-noodle pot), unlike a bare brand name.
  [/\bknorr\b.*\bpot\b|\bpot\b.*\bknorr\b|snackpot/i, 'enportionsratt'],
  // Wasa makes crispbread and nothing else — a real brand fact, so the product name
  // alone ("Sport, rågi") not carrying "knäcke" costs nothing.
  [/\bwasa\b/i, 'knackebrod'],
]

// ---------------------------------------------------------------------------
// 1. Edibility test — non-food first, so a food word borrowed as a scent/shape/brand
//    (svamp="sponge" or "mushroom", äpple-scented wipes) never reaches a food branch.
// ---------------------------------------------------------------------------
export const NON_FOOD_GATE_RE = /rengör|städ|disk(?:medel|borste|svamp|trasa|duk)|tvättmedel|tvättkapsl|tvättsvamp|badsvamp|sköljmedel|fluorskölj|mjukmedel|fläckborttag|toalettpapper|toapapper|hushållspapper|servett|avfallspåse|fryspås|plastpås|ugnsfolie|grillfolie|plastfolie|aluminiumfolie|sopsäck|bakplåtspapper|dammsugarpås|papptallrik|papperstallrik|\btallrik\b|pappmugg|bestick\b|\bgaffel\b|dricksglas|grillkol|grillbrikett|tändbrikett|tändvätska|grillpinnar|engångsgrill|kolgrill|myggmedel|mygg(?:spray|lotion)|insektsspray|getingspray|myrdosa|\bmyrr\b|flugsmäll|schampo|balsam\b|tvål\b|tandkräm|tandborst|tandvård|munskölj|deo(?:dorant)?|rakhyvel|rakblad|rakgel|rakvård|\btwin lady\b|engångshyvel|\bhyvel\b|bindor|trosskydd|tampong|våtservett|solskydd|solvård|\bspf\b|hårfärg|hudkräm|ansiktskräm|ansiktstvätt|ansikts\s*scrub|ansiktsvård|ansiktsmask|kroppslotion|(?:dag|natt|ögon)creme|dusch(?:kräm|creme|gel)?|vätskeersättning|\bresorb\b|kosttillskott|hälsokost|vitamintablett|blöj|byxblöj|babytvätt|babyvård|nappflaska|hundmat|kattmat|torrfoder|våtfoder|hundben|tuggben|tuggpinn|dentastick|kattsand|kattgodis|hundgodis|djurgodis|snittblomm|bukett|krukväxt|calandiva|tulpan|orkidé|\brosor\b|margerit|midsommarstång|gröna växter|barnmat|välling|\bwettex\b|\bmopp\b|golvmopp|dammvippa|moppduk|swiffer|maskindisk|doftblock|damastduk/i

const NON_FOOD_LEAF_RULES = [
  [/blöj|byxblöj|babyschampo|babytvätt|babyvård|nappflaska|(?=.*baby)(?=.*servett)/i, 'bloja_babyvard'],
  [/barnmat|välling/i, 'barnmat'],
  [/hundben|tuggben|tuggpinn|dentastick|kattsand|kattgodis|hundgodis|djurgodis|chew rolls|hundbajspås\w*/i, 'djurgodis_tillbehor'],
  [/hundmat|kattmat|torrfoder|våtfoder/i, 'djurmat'],
  [/snittblomm|bukett|krukväxt|calandiva|tulpan|orkidé|\brosor\b|margerit|midsommarstång|gröna växter/i, 'blommor_vaxter'],
  [/myggmedel|mygg(?:spray|lotion)|insektsspray|getingspray|myrdosa|\bmyrr\b|flugsmäll/i, 'skadedjur'],
  [/papptallrik|papperstallrik|\btallrik\b|pappmugg|bestick\b|\bgaffel\b|dricksglas|grillkol|grillbrikett|tändbrikett|tändvätska|grillpinnar|engångsgrill|kolgrill/i, 'engangs_grill'],
  [/toalettpapper|toapapper|hushållspapper|servett|avfallspåse|fryspås|plastpås|ugnsfolie|grillfolie|plastfolie|aluminiumfolie|sopsäck|bakplåtspapper|dammsugarpås/i, 'papper_pasar_folie'],
  // "fluorskölj" (a fluoride mouth rinse) was here until a blind random-sample audit
  // caught it — it's dental hygiene, not laundry/cleaning; "sköljmedel" (fabric
  // softener) is the unrelated word this rule actually means to catch.
  [/(?<!ansikts)rengör|städ|disk(?:medel|borste|svamp|trasa|duk)|tvättmedel|tvättkapsl|tvättsvamp|badsvamp|sköljmedel|mjukmedel|fläckborttag|\bwettex\b|\bmopp\b|golvmopp|dammvippa|moppduk|swiffer|maskindisk|doftblock|damastduk/i, 'stad_disk_tvatt'],
  // "Hälsokost" (a supplement brand's shelf label) embeds "ost" and was landing in
  // ost_hard via DAIRY_GATE_RE's generic cheese fallback — the same substring-collision
  // shape as "rostbiff"/"Costa Rica", but resolvable here as a real leaf rule
  // (found by eye-reading the 2026-W36 import's own categorised output).
  [/vätskeersättning|\bresorb\b|kosttillskott|hälsokost|vitamintablett/i, 'halsa'],
  // This rule was missing entirely until a blind-random-sample audit caught it (see
  // CLAUDE.md's post-mortem) — every one of these words was already in
  // NON_FOOD_GATE_RE (so the item correctly bailed out of the food branches), but
  // with no matching leaf rule here, `firstMatch` returned null and every one of them
  // silently fell through to the `?? 'stad_disk_tvatt'` default below instead of
  // `hygien` — shampoo, toothpaste, deodorant, sanitary products, sun/skin care, razors.
  [/schampo|balsam\b|tvål\b|tandkräm|tandborst|tandvård|munskölj|fluorskölj|deo(?:dorant)?|rakhyvel|rakblad|rakgel|rakvård|\btwin lady\b|engångshyvel|\bhyvel\b|bindor|trosskydd|tampong|våtservett|solskydd|solvård|\bspf\b|hårfärg|hudkräm|ansiktskräm|ansiktstvätt|ansikts\s*scrub|ansiktsvård|ansiktsmask|ansiktsrengör|kroppslotion|(?:dag|natt|ögon)creme|dusch(?:kräm|creme|gel)?/i, 'hygien'],
]

// ---------------------------------------------------------------------------
// 2. Head-noun / processing guards — the product *type* is unambiguous, so these run
//    before any flavour/ingredient keyword (fruit, veg, generic protein cuts).
// ---------------------------------------------------------------------------
// A sixth collision shape: a *durable* appliance or piece of cookware named after the
// food it acts on — "Kaffebryggare" (kaffe_te), "Brödrost" (matbrod), "Frukt- och
// svamptork" (frukt) all landed in a food category in the 2026-W33 ICA import, which
// carries an unusually large non-food catalog. NON_FOOD_GATE_RE doesn't help: these
// aren't hygiene/cleaning consumables, they're hardware, and the taxonomy has no leaf
// for hardware — `ovrigt` is the honest answer. Kept deliberately narrow (specific
// head-nouns, not a blanket "anything electrical") so it can't swallow real food:
// "tork" alone would eat "torkad frukt", so only the two attested compounds are
// listed; "gryta"/"panna" are excluded entirely since both name real dishes.
// `brio` is a toy brand here rather than an appliance, but it needs the same early
// bail: it would otherwise hit the `flora` margarine BRAND_OVERRIDES entry ("BRIO
// Flora" → smor_margarin with a self-reported 'hog' confidence), the same
// blanket-brand-preempts-real-signal trap documented for Dafgårds/Billys above.
const NON_FOOD_DURABLE_RE = /bryggare|brödrost|svamptork|frukttork|stavmixer|\bblender\b|airfryer|matberedare|vattenkokare|elvisp|smörgåsgrill|våffeljärn|stekpanna|kastrull|skärbräda|förvaringsburk|matlåda|termosmugg|dammsugare|strykjärn|hårklippare|högtalare|hörlurar|personvåg|\bbrio\b/i

const CANNED_TOMAT_RE = /(?=.*tomat)(?=.*(?:kross|passerad|puré))/i
// Same two-lookahead AND shape as CANNED_TOMAT_RE, for the same reason: the word
// that makes "Skivade rödbetor" a pickled pantry product rather than a raw root
// vegetable can sit on either side of "rödbet", so no fixed-width lookaround works.
const PICKLED_VEG_RE = /(?=.*rödbet)(?=.*(?:skivad|inlagd|syrad|ättik))/i
const SAUCE_RE = /sås|sauce|dressing|marinad|majo(?:nnäs)?|\bmayo\b|mayonnaise|ketchup|pesto|bearnaise|aioli|senap|vinägrett/i
const BAK_HEAD_RE = /pizzamjöl|pizzadeg|pizzabotten/i

// "X-bullar" is ambiguous between bread rolls (kanelbulle) and meatballs
// (köttbullar, delikatessbullar) — MEATBALL_RE below is checked first so a real
// meatball compound is claimed before BROD_RE's own bare "bull" ever sees it,
// which is more robust than trying to enumerate every meatball-prefix in a
// lookbehind chain on this pattern (an earlier version tried exactly that and still
// missed "Vegetariska delikatessbullar" — the lookbehind list simply didn't include
// "delikatess"). No lookbehind needed here any more as a result.
// "grytbitar" (diced stew meat, e.g. lamb) removed from here — a whole-muscle diced
// cut isn't ground/formed the way mince or meatballs are, and the taxonomy's own
// fars_kottbullar examples don't include it; moved to PROTEIN_GENERIC_RE's plain
// "kott" below (found via a full lexicon review: "Lammgrytbitar" was landing here).
const MEATBALL_RE = /köttbullar|bifteki|nötfärs|fläskfärs|köttfärs|kycklingfärs|blandfärs|vegofärs|vegobullar|delikatessbullar|färs(?!k)/i
// Bare "kex" added to the gate (not \b-bounded — needs to also catch it glued onto
// another word, e.g. "Mariakex") — the leaf rule below already listed it, but with no
// matching gate trigger "Kex Maria"/"Mariakex"/"Tux kex"/"Zoo kex" never reached
// BROD_RE at all, fell through to SNACKS_RE's bare "kex" instead, and landed on that
// branch's "?? 'godis'" fallback since no SNACKS_LEAF_RULES pattern matched either
// (found via a full lexicon review).
const BROD_RE = /majskak|riskak|(?:^| )kakor(?: |,|$)|bröd|limpa|frall|baguett(?!esallad)|tortilla(?!\s*chips)|pitabröd|knäckebröd|skorp|croissant|bull(?:ar)?|giffl|levain|bâtard|kavring|rågbröd|sportbröd|surdeg|tannour|hönökaka|knäcke|orientbrd|kladdkaka|tårta|muffin|donut|brownie|wienerbröd|(?<!choklad)(?<!kola)kaka(?!o)|jubileum|franska|roast.?n.?toast|smörgåsrån|pane napoletano|saltiner|kanellängd|kardemummalängd|kex/i
const BROD_LEAF_RULES = [
  // Bare standalone "Kakor" is always biscuits ("Kakor | Filipinos"); the word is only
  // matched on its own so compound plurals keep their own, better verdicts
  // (riskakor → knackebrod, chokladkakor → choklad, pannkakor → enportionsrätt).
  [/kex|digestive|\btuc\b|\boreo\b|mariekex|saltiner|(?:^| )kakor(?: |,|$)/i, 'kex'],
  [/tårta|kladdkaka|muffin|donut|(?<!choklad)(?<!kola)kaka(?!o)|brownie/i, 'tarta_kaka'],
  [/bull(?:ar)?|giffl|wienerbröd\b|kanellängd|kardemummalängd/i, 'fikabrod'],
  [/korvbröd|hamburgerbröd|brioche/i, 'korv_hamburgerbrod'],
  [/knäcke|skorp|hönökaka|smörgåsrån|majskak|riskak/i, 'knackebrod'],
  [/frall|baguett(?!esallad)|tortilla(?!\s*chips)|pitabröd|croissant|somun|roast.?n.?toast|pane napoletano/i, 'frallor_tunnbrod'],
]

// "schnitzel" (breaded cutlet) is a heat-and-eat ready meal, not raw protein — same
// protective role as the rest of FARDIGMAT_RE (checked before PROTEIN_RE).
const FARDIGMAT_RE = /pizza|pinsa|surdegspizza|efterrätt|paj\b|gratäng|quiche|matpaj|pommes|frites|rösti|husmans|enportionsrätt|matvete\s*rätt|soppa|potatissallad|krämiga? sallad|salladsbaren|caesarsallad|baguettesallad|wrap\b|schnitzel|mac\s*(?:&|and|n)?\s*cheese|vårrull|dumpling|gyoza|wonton|thaibox|pannkak(?:a|or)|snabbnudlar|kelda|\boxpytt\b|(?=.*potatis)(?=.*strips)/i
const FARDIGMAT_LEAF_RULES = [
  [/pizza|pinsa|surdegspizza/i, 'pizza'],
  [/gratäng|paj\b|quiche|matpaj/i, 'gratang_paj'],
  // Two-lookahead AND (same shape as CANNED_TOMAT_RE) so "Frysta sötpotatis strips"
  // resolves as a processed potato product, not a raw root vegetable — a plain
  // "strips"/"pommes"/"frites"/"rösti" alone stays potatisprodukter too.
  [/pommes|frites|rösti|(?=.*potatis)(?=.*strips)/i, 'potatisprodukter'],
  [/potatissallad|krämiga? sallad|salladsbaren|caesarsallad|baguettesallad|wrap\b/i, 'deli_sallad_wrap'],
  [/kelda|kyld soppa/i, 'kyld_soppa'],
  [/\boxpytt\b/i, 'enportionsratt'],
]

// "glass" is grouped with dessert everywhere in Swedish retail, never with färdigmat
// (see the design issue's §2 chain-taxonomy research) — glassås is checked first so
// it doesn't fall into the plain "glass" leaf.
// "dessertost" (a cheese board/dessert cheese) is excluded — the strip below rewrites
// it to plain "ost" so the dairy pass catches it instead (found via the golden set:
// "Dessertost | Kvibille" was landing in the glass_dessert group).
const GLASS_RE = /glass|efterrätt|dessert(?!ost)|pannacotta|barattolino/i
const GLASS_LEAF_RULES = [
  // Was "odense dessertsås" (requiring that exact brand-then-name word order) — a
  // real product's fields concatenate as "Dessertsås Odense" (name first, brand
  // second), so the compound never matched and it fell all the way through to the
  // GLASS_LEAF_RULES fallback ('glass') instead (found via a full lexicon review).
  // Bare "dessertsås" doesn't need the brand at all.
  [/glassås|glasstrut|dessertsås/i, 'dessertsas'],
  [/efterrätt|dessert(?!sås)(?!ost)|pannacotta|barattolino/i, 'dessert'],
]

const STARCH_HEAD_RE = /havreris|pasta|spag(?:h)?etti|risottoris|arborio|avorio|makaron|macaroni|fettuccine|lasagne|risoni|tortelloni|ravioli|gnocchi|penne|fusilli|rigatoni|chitarra|maniche|orecchiette|farfalle|tagliatelle|nudlar|noodle|äggnudlar|äggpasta|\bris\b|jasminris|basmatiris|rismål|rislunsj|bulgur|couscous|quinoa|matvete(?!\s*rätt)/i
const STARCH_LEAF_RULES = [
  [/pasta|spagetti|makaron|macaroni|fettuccine|lasagne|risoni|tortelloni|ravioli|gnocchi|penne|fusilli|rigatoni|chitarra|maniche|orecchiette|farfalle|tagliatelle|nudlar|noodle|äggnudlar|äggpasta/i, 'pasta'],
  [/\bris\b|havreris|jasminris|basmatiris|risottoris|arborio|avorio|rismål|rislunsj|bulgur|couscous|quinoa|matvete/i, 'ris_gryn'],
]

// Dairy checked as an explicit head noun (not a late fallback) so a flavour prefix
// never wins first — "Paprika Lök Färskost" is cream cheese, not vegetables.
// (?<!jordnöts)/(?!choklad) guard the two documented collisions: peanut butter and
// milk chocolate both carry a real dairy word (smör/mjölk) that isn't the product.
const DAIRY_GATE_RE = /gräddfil|cr[eè]me fraiche|(?:^| )fil(?:en)?(?: |,|$)|yoghurt|yogurt|kvarg|keso|philadelphia|färskost|mjukost|ricotta|mascarpone|burrata|\bbrie\b|feta\b|halloumi|grillost|apetina|norrloumi|cheddar|gouda|jarlsberg|grana padano|hårdost|ost(?!ron)|(?<!jordnöts)smör(?!gås)|margarin|matfett|(?<!kokos)mjölk(?!choklad)|(?<!kokos)grädd(?!fil)|skyr|kefir/i
const DAIRY_LEAF_RULES = [
  // "filmjölk" is soured milk, not milk — the mjolk_gradde rule below matches its
  // "mjölk" half, so it has to be claimed explicitly here first (the corpus already
  // held both verdicts for the same Verum product line).
  [/gräddfil|filmjölk|cr[eè]me fraiche|(?:^| )fil(?:en)?(?: |,|$)|yoghurt|yogurt|kvarg|skyr|kefir/i, 'fil_yoghurt'],
  [/philadelphia|färskost|mjukost|smältost|keso|ricotta|mascarpone|burrata|\bbrie\b|räkost/i, 'ost_fars_mjuk'],
  [/feta\b|halloumi|grillost|apetina|norrloumi/i, 'ost_vit_grill'],
  [/cheddar|gouda|jarlsberg|grana padano|hårdost/i, 'ost_hard'],
  [/(?<!jordnöts)smör(?!gås)|margarin|matfett/i, 'smor_margarin'],
  [/(?<!kokos)mjölk(?!choklad)|(?<!kokos)grädd(?!fil)/i, 'mjolk_gradde'],
  [/ost(?!ron)/i, 'ost_hard'],
]

// ---------------------------------------------------------------------------
// 3. Protein — checked after the head-noun guards above, so bread/ready-meal/dairy
//    compounds that happen to contain a meat-ish substring are already resolved.
// ---------------------------------------------------------------------------
const PALAGG_RE = /pålägg|pastej/i
// (?<!kaffe) guards the coffee-beans collision; bare "nöt" (peanuts/hazelnuts) is
// deliberately excluded — only real compounds reach beef this way.
const PROTEIN_LEAF_RULES = [
  [/pålägg|pastej/i, 'palagg_pastej'],
  [/(?<!kaffe)böna|(?<!kaffe)bönor|kikärt|\blins(?:er)?\b/i, 'baljvaxter'],
  // Two independent lookaheads (order-independent — "Vegansk korv, tofu" has "korv"
  // *before* "tofu", so a single negative lookahead on tofu alone wouldn't catch it)
  // — "Tofukorv"/"Vegansk korv, tofu" are sausages that happen to be made of tofu, not
  // tofu itself, per this taxonomy's own rule that a vego product mimicking a specific
  // meat product files under that product (Vegokorv → korv), not under tofu_tempeh
  // (reserved for vego protein with no animal counterpart at all). Found via a full
  // lexicon review.
  [/(?=.*(?:tofu|tempeh|seitan))(?=.*korv)/i, 'korv'],
  [/tofu|tempeh|seitan/i, 'tofu_tempeh'],
  [/sill(?!i)|matjes|kaviar|caviar|(?:^| )rom(?: |,|$)|strömming/i, 'inlagd_fisk_kaviar'],
  // "räk" (shrimp) hides inside "räkna"/"räknar" (to count) — a very common Swedish
  // word, and ICA's back-to-school flyer is full of it ("Räkna med Greta", "Börja
  // räkna" were both landing in skaldjur). Real shrimp compounds are "räkor",
  // "räksallad", "räkost", "räkmacka" — none continue into "-na", so the lookahead is
  // exact. Same targeted-guard shape as (?<!kokos)mjölk and färs(?!k) elsewhere here.
  [/räk(?!na)|skaldjur|kräft|mussl|scampi|hummer|krabba|skagenröra/i, 'skaldjur'],
  // "sej"/"gös" used to be space-anchored (defensively, without checking whether that
  // was actually needed) which missed "Sejfilé" entirely — it fell through to
  // PROTEIN_GENERIC_RE's "filé" and landed in plain kött instead of fisk. Checked the
  // real corpus for a bare-substring collision on either word and found none, so both
  // are unanchored now, same as every other fish species in this pattern.
  [/lax|torsk|sej|skädda|tonfisk|fisk(?!e)|\bfish\b|makrill|abborre|gös|kolja|surimi|kummel|pollock/i, 'fisk'],
  // Checked here — right after fisk, before charkuterier/bacon_skinka/korv/fagel —
  // so a fish burger ("Laxburgare", already claimed above by "lax") stays fisk, but a
  // *chicken* burger doesn't get claimed by the fagel rule below first: the taxonomy's
  // own worked example lists "färska burgare" under fars_kottbullar (a formed patty is
  // the same product shape as a meatball), and that includes a chicken patty just as
  // much as a beef one (found via a full lexicon review: "Kycklingburgare" was landing
  // in fagel).
  [MEATBALL_RE, 'fars_kottbullar'],
  [/burgare|\bburger\b/i, 'fars_kottbullar'],
  // salsiccia(?!korv) — "Salsicciakorv" literally ends in the "-korv" suffix, a
  // stronger signal than the charcuterie-style "salsiccia" on its own (found via a
  // blind random-sample audit: it was landing in charkuterier ahead of the korv\b
  // rule below purely because this line is checked first).
  [/salami|salame|pros?c[iu]{2}tto|mortadella|medwurst|lufttorkat|ölkorv|\bfuet\b|serrano|\bparma\b|salsiccia(?!korv)/i, 'charkuterier'],
  [/bacon|skinka|kassler|stekfläsk|pancetta/i, 'bacon_skinka'],
  // korv(?:ar|en)? — "Vegetariska korvar" (a vego sausage, which by this taxonomy's own
  // vego rule belongs under the product it mimics) matched nothing at all while this
  // pattern required a boundary straight after "korv".
  [/korv(?:ar|en)?\b/i, 'korv'],
  [/kyckling|kalkon|(?:^| )anka(?: |,|$)/i, 'fagel'],
  [/(?:^| )ägg(?:et|en|ar)?(?: |,|$)/i, 'agg'],
  // Fallback for a bare Quorn product with no more specific signal above — closest
  // existing precedent is "Quorn måltidsdelar → tofu_tempeh" (design issue §3.1b).
  [/\bquorn\b/i, 'tofu_tempeh'],
]
// "oumph" mimics meat chunks (a substitute for a specific meat product, unlike
// tofu/tempeh/seitan which have no animal counterpart) — filed as plain kött, per
// the design issue's own "what is it" rule for vego products that stand in for meat.
// "burgare"/"burger" moved to PROTEIN_LEAF_RULES' fars_kottbullar (a formed ground-meat
// patty is the same product shape as a meatball — the taxonomy's own examples list
// "färska burgare" under fars_kottbullar, not kott, see kategoriTaxonomy.mjs). "oxpytt"
// moved to FARDIGMAT_LEAF_RULES' enportionsratt — in practice this is almost always a
// Findus-style pre-seasoned ready dish, not raw diced beef from a butcher counter (the
// old pre-rework classifier's protein_farsk verdict for it was carried over here
// unexamined; a real butcher-counter product would normally say "oxkött i tärningar" or
// "grytbitar" instead).
const PROTEIN_GENERIC_RE = /entrec[oô]te|karré|filé|\bbiff\b|kotlett|ryggbiff|lövbiff|picanha|revben|spareribs|\bribs\b|grillspett|grillrulle|grytbitar|lamm|tomahawk|oxfilé|högrev|nötkött|nötstek|nötspett|nötgrytbitar|fläsk(?!färs)|\bvilt\b|pluma|flankstek|flintastek|t-?bone|kamben|club\s*steak|griskött|ytterlår|innanlår|rimmad|kalv(?!sylta)?|gyros|kebab|\boumph\b|pulled\s*pork/i

// ---------------------------------------------------------------------------
// 4. Fruit (checked before veg/snacks so the produce keyword wins its own category
//    when nothing else claims it — but flavoured dairy/drink/snack forms are excluded
//    first, same as the pre-existing FRUIT_DAIRY/DRINK/SNACK exclusions).
// ---------------------------------------------------------------------------
const BAR_RE = /jordgubb|blåbär|hallon|björnbär|körsbär|bigarrå|vinbär|smultron|(?:^| )bär(?: |,|$)/i
const FRUIT_RE = /frukt|äpple|royal gala|granny smith|pink lady|jonagold|banan|apelsin|citron|clementin|(?:^| )lime(?: |,|$)|avokado|melon|druv|persik|paraguayos|nektarin|mango|ananas|päron|kiwi|plommon|aprikos|fikon|granatäpple|citrus/i
const FRUIT_SNACK_RE = /klämmis|stång/i
const FRUIT_DAIRY_RE = /yoghurt|yogurt|kvarg|(?:^| )fil(?: |,|$)|grädd/i
// "kolsyrat" — flavoured sparkling water ("Citron kolsyrat vatten", "Päron kolsyrat
// vatten") was landing in frukt without it (found via a full lexicon review).
const FRUIT_DRINK_RE = /dryck|smoothie|juice|saft|läsk|soda|kolsyrat|(?:^| )cider(?: |,|$)/i
// havregott/havregryn/havrekuddar/nesquik added alongside flingor/müsli/granola — a
// flavoured cereal ("Havregott Jordgubb") needs the same exclusion as a flavoured
// drink (found via a full lexicon review).
const FRUIT_CEREAL_RE = /flingor|müsli|granola|havregott|havregryn|havrekuddar|nesquik/i
// "Fruktsmoothie ... Från 6 Månader" / "Fruktstång ... Från 12 Månader" (baby food,
// found alongside the berry/drink collision below) — checked ahead of both.
const BABY_AGE_RE = /från \d+ månader/i

// ---------------------------------------------------------------------------
// 5. Snacks — checked before veg so a flavour word ("Fotbollsnacks Paprika",
//    Estrella's "Stjärnor, Dillskruvar") doesn't get claimed by the vegetable it's
//    named after. Real meat compounds are already resolved by PROTEIN above, so bare
//    "nöt" here safely means peanuts, not beef (see PROTEIN_LEAF_RULES's comment).
// ---------------------------------------------------------------------------
// (?<!s)kola guards "s*kola*n"/"skolstart" (school) — ICA's back-to-school flyer put
// "Börja skolan" in godis. Real caramel compounds ("gräddkola", "kolakaka", bare
// "Kola") never carry a preceding "s", so the lookbehind costs nothing.
const SNACKS_RE = /chips|godis|snacks|choklad|kex|nöt|nötter|pumpakärn|solroskärn|solrosfrö|linfrö|chiafrö|sesamfrö|protein\s*wafer|proteinbar|müslibar|\bcorny\b|propud|gainomax|(?<!s)kola(?!dricka)|lakrits|popcorn|tuggummi|marshmallow|toffifee|mentos|estrella|cashew|valnöt|pinjenöt|jordnöt|mandel(?!mjölk)|russin|torkad frukt|cheez doodles|ostbåg|salta pinnar|kalaspuff|mikropop/i
const SNACKS_LEAF_RULES = [
  // Checked first — a specific bar/nut *product* word should win over the generic
  // "choklad"/brand-only matches below it (found via a blind random-sample audit:
  // "Choklad Müslibar" was landing in choklad since that rule ran first, and "Jordnötter
  // Salta | Estrella" was landing in chips_snacks purely because Estrella is a brand
  // known primarily for chips — Estrella also sells salted nuts, so a bare brand match
  // shouldn't outrank an explicit "jordnötter" ingredient word. "jordnötsringar" (a
  // peanut-*flavoured puffed snack*, not real nuts) stays chips_snacks below, since
  // that's the compound word, not the bare ingredient).
  [/proteinbar|protein\s*wafer|müslibar|\bcorny\b|propud|gainomax/i, 'bars'],
  // "valnöt" is unanchored (was \bvalnöt\b, which the plural "Valnötter" never
  // matched — it fell to chips_snacks purely because the brand is "Exotic Snacks").
  // Seeds live here too: "pumpakärnor" was landing in gronsaker via VEG_GENERIC_RE's
  // "pumpa", and "linfrö" matched nothing at all.
  [/jordnötter|jordnöt(?!sring)|\bcashew\b|valnöt|pinjenöt|\bmandel\b(?!mjölk)|\brussin\b|pumpakärn|solroskärn|solrosfrö|linfrö|chiafrö|sesamfrö/i, 'notter_torkat'],
  [/choklad/i, 'choklad'],
  [/godis|lakrits|tuggummi|marshmallow|toffifee|mentos|(?<!s)kola(?!dricka)/i, 'godis'],
  [/chips|snacks|popcorn|estrella|cheez doodles|ostbåg|salta pinnar|kalaspuff|mikropop/i, 'chips_snacks'],
  [/nöt|nötter|torkad frukt/i, 'notter_torkat'],
]

// ---------------------------------------------------------------------------
// 6. Vegetables — checked after fruit/snacks so a flavour or filling word inside a
//    processed product (see the head-noun guards above) never reaches here at all.
// ---------------------------------------------------------------------------
const VEG_LEAF_RULES = [
  [/\bdill\b|persilja|basilika|gräslök|koriander|mynta\b/i, 'farska_kryddor'],
  [/svamp|champinjon|kantarell|karljohan/i, 'svamp'],
  [/lök|purjolök|salladslök|vitlök|schalottenlök/i, 'lok'],
  [/potatis|morot|morötter|rödbet(?:a|or)|sötpotatis|palsternacka|kålrot/i, 'potatis_rotfrukt'],
]
// "salla" (stem, covers sallad/sallader/sallater) — the plain "sallad" pattern
// doesn't match the plural "sallater" (a real, if slightly nonstandard, plural form
// seen in the corpus: "Finbladiga sallater i påse" — standard Swedish plural is
// "sallader", but this source used "sallater"; found via a blind random-sample audit).
const VEG_GENERIC_RE = /salla|tomat|gurka|paprika|broccoli|zucchini|kål|majs|ärtor|ärter|spenat|aubergine|blomkål|selleri|rädis|kronärtskocka|chili|ingefära|pumpa|rabarber/i

// ---------------------------------------------------------------------------
// 7. Drink.
// ---------------------------------------------------------------------------
const DRYCK_LEAF_RULES = [
  [/havredryck|ärtdryck|sproud|oatly|oddlygood|växtdryck|sojadryck|mandeldryck|mandelmjölk/i, 'vaxtdryck'],
  // "iste" (iced tea) was unanchored while its sibling "te" already was — so it matched
  // inside "Kl*iste*rmärkesbok" and "Tw*iste*r", both landing in kaffe_te. Unlike the
  // Swedish-vowel cases documented above, \b works here: "iste" is pure ASCII, so a
  // preceding/following letter genuinely suppresses the boundary.
  [/kaffe|barista|snabbkaffe|kaffebönor|ice coffee|cappuc+ino|espresso|latte|(?:^| )te(?:et)?(?: |,|$)|\biste\b|ice tea/i, 'kaffe_te'],
  [/juice|saft|smoothie|nektar|fruktdryck|blandsaft/i, 'juice_saft'],
  [/(?:^| )öl(?: |,|$)|folköl|cider|ginger beer/i, 'ol_cider'],
  [/energidryck|celsius|monster|vitamin\s*well/i, 'energidryck'],
  [/läsk|cola|pepsi|kolsyrat|tonic|mineralvatten|(?:^| )vatten(?: |,|$)|drinkmixer/i, 'lask_vatten'],
]
const DRYCK_GATE_RE = /dryck|dricka/i

// ---------------------------------------------------------------------------
// 8. Whatever's left of the pantry.
// ---------------------------------------------------------------------------
const SKAFFERI_LEAF_RULES = [
  // Coconut milk/cream is a pantry item, not dairy — DAIRY_GATE_RE already excludes it
  // (kokos-prefix guard), so it needs its own explicit landing spot here.
  [/kokosmjölk|kokosgrädde/i, 'inlagt_delikatess'],
  [/flingor|müsli|granola|havregryn|havregott|havrekuddar|nesquik/i, 'flingor_musli'],
  // oliv(?!olja) — "Olivolja" is an oil, not the olives themselves (found via a blind
  // random-sample audit: it was landing here ahead of the olja_vinager rule below
  // purely because this line is checked first).
  [/(?<!palm)oliv(?!olja)|cornichon|hummus|kimchi|antipasti|tapas|soltorkade tomater|delikatess|bruschetta|kronärtskockshjärt|\bröror\b/i, 'inlagt_delikatess'],
  [/vinäger|ättiksprit|balsamvinäger|olja/i, 'olja_vinager'],
  [/krydd|buljong|\bfond\b|marinad|grillkrydda|matmix|middagsmix/i, 'kryddor_buljong'],
  [/mjöl(?!k)|socker|honung|sirap|marmelad|sylt|pajdeg|bladdeg|vetemjöl|matvete|ströbröd|panko/i, 'bak_sott'],
  [/konserv|soja(?!dryck)/i, 'inlagt_delikatess'],
]

const VEGAN_RE = /vegansk|\bvegan\b|vego(?:färs|bullar|korv)?\b|\boumph\b|peas of heaven|\bsproud\b/i
const VEGETARISK_RE = /vegetarisk|\bquorn\b/i

const FROZEN_HINT_RE = /frys(?:t|ta|en)?|djupfryst|findus|gb glace|sia glass|triumf glass|royal greenland/i

function firstMatch(rules, haystack) {
  for (const [re, id] of rules) if (re.test(haystack)) return id
  return null
}

function detectForm(haystack, kategori, groupId) {
  // A dessert sauce/topping isn't itself frozen even though it lives in the
  // glass_dessert group (the group's other two leaves, glass/dessert, are).
  if (groupId === 'glass_dessert' && kategori !== 'dessertsas') return 'fryst'
  if (FROZEN_HINT_RE.test(haystack)) return 'fryst'
  if (groupId === 'mejeri_ost') return 'kyld'
  if (['frukt_gront'].includes(groupId)) return 'farsk'
  if (kategori === 'deli_sallad_wrap' || kategori === 'kyld_soppa') return 'kyld'
  if (groupId === 'skafferi') return /konserv|burk\b/i.test(haystack) ? 'konserv' : 'torr'
  return null
}

function detectVarutyp(kategori, haystack) {
  if (kategori === 'baljvaxter') {
    if (/(?<!kaffe)böna|(?<!kaffe)bönor/i.test(haystack)) return 'bonor'
    if (/kikärt/i.test(haystack)) return 'kikartor'
    if (/lins/i.test(haystack)) return 'linser'
    return 'bonor'
  }
  return kategori
}

function detectMarkeringar(haystack) {
  if (VEGAN_RE.test(haystack)) return ['vegansk']
  if (VEGETARISK_RE.test(haystack)) return ['vegetarisk']
  return []
}

/**
 * Classifies one product into the erbjudanden taxonomy. Returns kategori (a leaf id
 * from kategoriTaxonomy.mjs), form, varutyp, markeringar (vegan/vegetarisk tags to
 * merge into the offer's existing markeringar — never a category, see this file's
 * header), confidence ('hog' unless it fell through to the ovrigt fallback) and
 * kategori_kalla ('regel', always — a human/model correction that later overrides
 * this verdict should set kategori_kalla: 'manuell' at the call site, not here).
 */
export function classify(namn, marke, details) {
  const raw = `${namn ?? ''} ${marke ?? ''} ${details ?? ''}`
  // Checked before BRAND_OVERRIDES — "Dessertglass | Daim, Oreo" was landing in `kex`
  // purely because "Oreo" is a listed mix-in brand and BRAND_OVERRIDES runs first,
  // the same "blanket brand match preempts more specific real product signal" shape
  // as the Dafgårds/Billys lesson above (found via a blind random-sample audit). A
  // narrow, targeted exception here is lower-risk than reordering brand facts behind
  // every head-noun guard, which could affect brand overrides this audit didn't check.
  if (/dessertglass/i.test(raw)) return finish('dessert', raw)
  // "automat" hides "tomat"; "salladsost" (a feta-style white cheese in brine) hides
  // "sallad" — rewritten to "feta" so the dairy pass lands it in ost_vit_grill rather
  // than the generic ost_hard fallback; "dessertost" is kept as plain "ost"; "rostad"/"mellanrost"/"mörkrost" (roast/roasted,
  // e.g. a coffee roast level) all contain "ost" as a substring with no product
  // meaning of their own, so they're stripped entirely — but "rostbiff" (roast beef)
  // is a real meat product, so it's rewritten to "biff" (kept meaningful) rather than
  // deleted outright, unlike its purely-adjectival cousins.
  let haystack = raw
    .replace(/automat\w*/gi, '')
    .replace(/salladsost/gi, 'feta')
    .replace(/dessertost/gi, 'ost')
    .replace(/rostbiff/gi, 'biff')
    // "Rosta" (Pågen's toast-bread line, no trailing "d") also embeds "ost" — same
    // shape as "rostad"/"mellanrost"/"mörkrost" below, just missing the "d".
    .replace(/\brosta\b|rostad\w*|mellanrost\w*|mörkrost\w*/gi, '')
    // "Costa Rica" (an origin, from COUNTRIES in erbjudanden-lib.mjs) is the one
    // country name that happens to embed "ost" — found via the golden set
    // ("Hel ananas | Costa Rica" was landing in ost_hard).
    .replace(/costa rica/gi, '')
    // "Ostbågar"/"ostsnacks" (cheese-puff crisps) are a snack, not a cheese — the
    // generic dairy "ost" fallback would otherwise win first since it's checked
    // before the snacks pass (found via the golden set: "Chips, ostbågar").
    .replace(/ostbåg\w*|ostkrok\w*|ostsnacks/gi, 'snacks')
    // Same shape, a different compound: cheese-flavoured tortilla chips ("Tortillachips
    // Ost") were landing in ost_hard via the same generic "ost" fallback (found via a
    // full lexicon review) — the flavour word is redundant once "chips" is present.
    .replace(/tortillachips ost/gi, 'tortillachips')
    // "Plommontomat" (plum tomato) is a tomato, not a plum — FRUIT_RE's "plommon"
    // otherwise wins over VEG_RE's "tomat" ("Babyplommontomater" landed in frukt).
    .replace(/plommontomat\w*/gi, 'tomat')

  // "Mikropopcorn ... Smör" (butter-flavoured microwave popcorn) was landing in
  // smor_margarin via the "smör" flavour word, ahead of ever reaching SNACKS_RE's
  // "popcorn" — a plain conditional rather than a single regex, since "popcorn" comes
  // *before* "smör" in this product's actual field order (namn then marke), so a
  // forward-only lookahead alone wouldn't have caught it (found via a full lexicon
  // review).
  if (/popcorn/i.test(haystack)) haystack = haystack.replace(/smör/gi, '')

  // "Smash" is genuinely ambiguous, not a fact BRAND_OVERRIDES can safely assert: it's
  // both an Ahlgrens/Fazer-adjacent candy name and the OLW "Smash!" savory snack line
  // ("Choko crunch, smash | SMASH! • OLW" — the product name alone can't disambiguate
  // which). Checked here, ahead of BRAND_OVERRIDES, so it reports the honest 'lag'
  // confidence instead of inheriting BRAND_OVERRIDES' blanket 'hog' — caught by the
  // "run the 125 hog entries" review, which found this was the one BRAND_OVERRIDES
  // entry self-reporting certainty it didn't actually have.
  if (/\bsmash\b/i.test(raw)) return finish('godis', haystack)

  // Before BRAND_OVERRIDES: a durable named after a food must not be claimed by either
  // a food keyword or a brand fact (see NON_FOOD_DURABLE_RE's own comment).
  if (NON_FOOD_DURABLE_RE.test(haystack)) return finish('ovrigt', haystack)

  for (const [re, leaf] of BRAND_OVERRIDES) {
    if (re.test(raw)) return finish(leaf, haystack, 'hog')
  }

  if (NON_FOOD_GATE_RE.test(haystack)) {
    const leaf = firstMatch(NON_FOOD_LEAF_RULES, haystack) ?? 'stad_disk_tvatt'
    return finish(leaf, haystack)
  }

  if (CANNED_TOMAT_RE.test(haystack)) return finish('konserv_tomat', haystack)
  if (PICKLED_VEG_RE.test(haystack)) return finish('inlagt_delikatess', haystack)
  if (BAK_HEAD_RE.test(haystack)) return finish('bak_sott', haystack)
  // Checked before SAUCE_RE — "Glassås" ends in the substring "sås" and would
  // otherwise be claimed by the generic sauce pattern before ever reaching here.
  if (GLASS_RE.test(haystack)) return finish(firstMatch(GLASS_LEAF_RULES, haystack) ?? 'glass', haystack)
  // Also checked before SAUCE_RE — "Ekologiska vita bönor i tomatsås" is fundamentally
  // a bean product (the sauce describes how it's packed, not what it is), but bare
  // "sås" would otherwise claim it first (found via a full lexicon review).
  if (/böna|bönor|kikärt|lins/i.test(haystack) && /sås/i.test(haystack)) return finish('baljvaxter', haystack)
  if (SAUCE_RE.test(haystack)) return finish('sas_dressing', haystack)
  // Checked before BROD_RE — see MEATBALL_RE's own comment for why.
  if (MEATBALL_RE.test(haystack)) return finish('fars_kottbullar', haystack)
  if (BROD_RE.test(haystack)) return finish(firstMatch(BROD_LEAF_RULES, haystack) ?? 'matbrod', haystack)
  if (FARDIGMAT_RE.test(haystack)) return finish(firstMatch(FARDIGMAT_LEAF_RULES, haystack) ?? 'enportionsratt', haystack)
  if (STARCH_HEAD_RE.test(haystack)) return finish(firstMatch(STARCH_LEAF_RULES, haystack) ?? 'pasta', haystack)
  if (DAIRY_GATE_RE.test(haystack)) return finish(firstMatch(DAIRY_LEAF_RULES, haystack) ?? 'ost_hard', haystack)
  // "Kaffe hela bönor" (whole coffee beans) — the (?<!kaffe) lookbehind on
  // PROTEIN_LEAF_RULES' baljvaxter pattern only guards "kaffe" glued directly onto
  // "böna"/"bönor" ("kaffebönor"); "kaffe" anywhere earlier in the same product name
  // needs this wider check (found via the golden set).
  if (/kaffe/i.test(haystack) && /böna|bönor/i.test(haystack)) return finish('kaffe_te', haystack)

  const proteinLeaf = firstMatch(PROTEIN_LEAF_RULES, haystack)
  if (proteinLeaf) return finish(proteinLeaf, haystack)
  if (PROTEIN_GENERIC_RE.test(haystack)) return finish('kott', haystack)

  // Baby food ("Från 6 Månader") checked before the berry/fruit branch below — a
  // "Fruktsmoothie ... Från 6 Månader" or "Fruktstång ... Från 12 Månader" is baby
  // food, not a snack bar or a loose fruit, however many fruit words are in the name.
  if (BABY_AGE_RE.test(haystack)) return finish('barnmat', haystack)

  // "Torkad frukt"/dried berries are a snack, not loose produce — checked before the
  // berry/fruit branch below for the same reason BABY_AGE_RE is (found via a blind
  // random-sample audit: "Torkad frukt | Dippies Fruit Dips" was landing in plain
  // frukt because FRUIT_RE's bare "frukt" ran before SNACKS_RE ever got a look, even
  // though notter_torkat's own pattern already listed "torkad frukt" — it just never
  // got reached).
  if (/torkad(?:e)? (?:frukt|bär)/i.test(haystack)) return finish('notter_torkat', haystack)

  // Berry/fruit flavour words carry the exact same collision risk as any other
  // ingredient word — "Hallonsoda", "Blåbärsdryck" are drinks, "Flingor röda bär" is
  // cereal, not berries — so BAR_RE gets the same drink/dairy/snack/cereal exclusions
  // as FRUIT_RE below (found via a corpus-wide scan after the golden set missed this
  // shape entirely: it only sampled one product per collision family, not every one
  // sharing it).
  if (BAR_RE.test(haystack)) {
    if (FRUIT_SNACK_RE.test(haystack)) return finish('bars', haystack)
    if (FRUIT_DAIRY_RE.test(haystack)) return finish(firstMatch(DAIRY_LEAF_RULES, haystack) ?? 'fil_yoghurt', haystack)
    // firstMatch(DRYCK_LEAF_RULES, ...), not a hardcoded 'juice_saft' — "Citron
    // kolsyrat vatten" is flavoured *water*, not juice; DRYCK_LEAF_RULES already knows
    // that distinction (found in the round-3 review: both had been landing in
    // juice_saft instead of lask_vatten).
    if (FRUIT_DRINK_RE.test(haystack)) return finish(firstMatch(DRYCK_LEAF_RULES, haystack) ?? 'juice_saft', haystack)
    if (FRUIT_CEREAL_RE.test(haystack)) return finish('flingor_musli', haystack)
    return finish('bar', haystack)
  }
  if (FRUIT_RE.test(haystack)) {
    if (FRUIT_SNACK_RE.test(haystack)) return finish('bars', haystack)
    if (FRUIT_DAIRY_RE.test(haystack)) return finish(firstMatch(DAIRY_LEAF_RULES, haystack) ?? 'fil_yoghurt', haystack)
    // firstMatch(DRYCK_LEAF_RULES, ...), not a hardcoded 'juice_saft' — "Citron
    // kolsyrat vatten" is flavoured *water*, not juice; DRYCK_LEAF_RULES already knows
    // that distinction (found in the round-3 review: both had been landing in
    // juice_saft instead of lask_vatten).
    if (FRUIT_DRINK_RE.test(haystack)) return finish(firstMatch(DRYCK_LEAF_RULES, haystack) ?? 'juice_saft', haystack)
    if (FRUIT_CEREAL_RE.test(haystack)) return finish('flingor_musli', haystack)
    return finish('frukt', haystack)
  }

  if (SNACKS_RE.test(haystack)) return finish(firstMatch(SNACKS_LEAF_RULES, haystack) ?? 'godis', haystack)

  const vegLeaf = firstMatch(VEG_LEAF_RULES, haystack)
  if (vegLeaf) return finish(vegLeaf, haystack)
  if (VEG_GENERIC_RE.test(haystack)) return finish('gronsaker', haystack)

  const dryckLeaf = firstMatch(DRYCK_LEAF_RULES, haystack)
  if (dryckLeaf) return finish(dryckLeaf, haystack)
  if (DRYCK_GATE_RE.test(haystack)) return finish('lask_vatten', haystack)

  const skafferiLeaf = firstMatch(SKAFFERI_LEAF_RULES, haystack)
  if (skafferiLeaf) return finish(skafferiLeaf, haystack)

  return finish('ovrigt', haystack, 'lag')
}

function finish(kategori, haystack, confidence = 'lag') {
  const groupId = kategori === 'ovrigt' ? 'ovrigt' : (kategori === 'blommor_vaxter' ? 'ovrigt' : groupOfLeaf(kategori))
  const form = detectForm(haystack, kategori, groupId)
  return {
    kategori,
    form,
    varutyp: detectVarutyp(kategori, haystack),
    markeringar: detectMarkeringar(haystack),
    confidence,
    kategori_kalla: 'regel',
    aisle: aisleFor(kategori, form),
  }
}

function groupOfLeaf(leafId) {
  return LEAF_TO_GROUP.get(leafId)?.id ?? 'ovrigt'
}

/** Legacy-shaped wrapper (kategori id only) for any caller that hasn't moved to the
 * full classify() result yet. */
export function guessKategori(name, details) {
  return classify(name, null, details).kategori
}
