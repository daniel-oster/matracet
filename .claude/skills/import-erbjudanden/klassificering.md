# Klassificering av nya lexikon-poster

Körs av dig (Claude), inne i samma session som importerar en veckas erbjudanden — inte
av ett script. `scripts/erbjudanden-lexikon.mjs`/`erbjudanden-recategorize.mjs`
klassificerar automatiskt via `src/lib/kategoriClassify.mjs`s regelmotor (ett
kallstarts-facit, se den filens header), men den motorn har en hård gräns: den kan
aldrig veta att "Präst" är en ost eller att "Ballerina" är ett kex — den informationen
finns bara i din världskunskap. Detta dokument är decision-proceduren för **dig** att
tillämpa på de produkter regelmotorn lämnar med `confidence: "lag"` (i praktiken:
`kategori: "ovrigt"`), eller där du av annan anledning misstänker regelmotorns svar är
fel.

Resultatet skrivs in i `public/data/erbjudanden/_kategori-lexikon.json` (via
`upsertLexikon` i `scripts/erbjudanden-lexikon.mjs`) — **inte bara in i veckans
JSON-fil** — så att samma produkt aldrig behöver klassificeras två gånger.

## Kategorier

Välj exakt ett `kategori` (löv-id) ur listan nedan. Ingen annan sträng är giltig — se
`src/lib/kategoriTaxonomy.mjs` för den auktoritativa listan om den här har hunnit
driva (den genereras därifrån, men kolla ändå vid tvivel).

- **Frukt & Grönt** (`frukt_gront`): `frukt`, `bar`, `gronsaker`, `potatis_rotfrukt`, `lok`, `svamp`, `farska_kryddor`
- **Protein** (`protein`): `kott`, `fars_kottbullar`, `fagel`, `fisk`, `skaldjur`, `inlagd_fisk_kaviar`, `agg`, `korv`, `bacon_skinka`, `charkuterier`, `palagg_pastej`, `tofu_tempeh`, `baljvaxter`
- **Mejeri & Ost** (`mejeri_ost`): `mjolk_gradde`, `fil_yoghurt`, `smor_margarin`, `ost_hard`, `ost_fars_mjuk`, `ost_vit_grill`
- **Bröd** (`brod`): `matbrod`, `frallor_tunnbrod`, `knackebrod`, `korv_hamburgerbrod`, `fikabrod`, `tarta_kaka`, `kex`
- **Färdigmat** (`fardigmat`): `pizza`, `gratang_paj`, `enportionsratt`, `potatisprodukter`, `deli_sallad_wrap`, `kyld_soppa`
- **Glass & Dessert** (`glass_dessert`): `glass`, `dessert`, `dessertsas`
- **Godis & Snacks** (`godis_snacks`): `choklad`, `godis`, `chips_snacks`, `notter_torkat`, `bars`
- **Dryck** (`dryck`): `kaffe_te`, `lask_vatten`, `juice_saft`, `vaxtdryck`, `ol_cider`, `energidryck`
- **Skafferi** (`skafferi`): `pasta`, `ris_gryn`, `flingor_musli`, `konserv_tomat`, `sas_dressing`, `olja_vinager`, `kryddor_buljong`, `bak_sott`, `inlagt_delikatess`
- **Hushåll & Hygien** (`hushall_hygien`): `stad_disk_tvatt`, `papper_pasar_folie`, `engangs_grill`, `skadedjur`, `hygien`, `halsa`
- **Barn** (`barn`): `bloja_babyvard`, `barnmat`
- **Djur** (`djur`): `djurmat`, `djurgodis_tillbehor`
- **Övrigt** (`ovrigt`): `blommor_vaxter`, `ovrigt`

## Kost är en märkning, inte en kategori

En vegansk/vegetarisk produkt klassificeras efter **vad den är**, aldrig efter kosten
— en vego-korv hör hemma i `korv`, tre rader från falukorven den ersätter, inte i en
egen "vego"-kategori (som ändå aldrig skulle rymma en vegansk majonnäs eller en
havredryck). Exempel:

- "Vegokorv" → `kategori: "korv"`, `markeringar: ["vegansk"]`
- "Vegofärs, vegobullar" → `kategori: "fars_kottbullar"`, `markeringar: ["vegansk"]`
- "Vegetariskt pålägg" (Quorn) → `kategori: "palagg_pastej"`, `markeringar: ["vegetarisk"]`
- "Vegan mayo" → `kategori: "sas_dressing"`, `markeringar: ["vegansk"]`
- "Vegansk ärtdryck" (Sproud) → `kategori: "vaxtdryck"`, `markeringar: ["vegansk"]`
- "Fryst vego" (Oumph, härmar köttbitar) → `kategori: "kott"`, `markeringar: ["vegansk"]`
  — **inte** `tofu_tempeh`: den kategorin är bara för vegoprotein **utan** en animalisk
  motsvarighet (tofu, seitan, bönor, linser). En vegoprodukt som härmar en köttprodukt
  hör hemma hos köttprodukten.

## Beslutsordning

Gå igenom testerna i ordning. Första testet som ger ett svar vinner.

1. **Ätbarhetstestet.** Är produkten avsedd att ätas eller drickas av en människa?
   Nej → någon av `hushall_hygien`/`barn`/`djur`-lövblad, eller `blommor_vaxter`. Gör
   detta först. Ett livsmedelsord i namnet på en icke-livsmedelsprodukt är alltid en
   doft, en form eller ett varumärke: "Allrengöringssvamp" är en disksvamp, inte
   svamp. "Palmolive" innehåller inga oliver.

2. **Huvudordstestet.** I svenska sammansättningar står produkten *sist*; allt före är
   smak, ingrediens, form eller ursprung. Klassificera på det sista/dominerande ledet.
   - Pizza**mjöl** → mjöl → `bak_sott`. Pizza**sås** → sås → `sas_dressing`.
   - Glass**sås** → sås → `dessertsas` (inte `sas_dressing` — det är specifikt en
     dessertsås, inte en matsås).
   - Jordnöts**ringar** → snacks → `chips_snacks`.
   - Tomat**puré**/krossade tomater → `konserv_tomat`, inte färsk tomat.
   - Färsk**potatis** → `potatis_rotfrukt` (adjektivet "färsk" är inte "färs").
   - Undantag att känna till: "-bulle" i *köttbulle* är inte ett bröd (`fars_kottbullar`);
     "-spett" i *nötspett*/*grillspett* är kött (`kott`), inte snacks.

3. **Förädlingstestet.** Är den färdig att värma/äta som en rätt? →
   `fardigmat`-gruppens löv (pizza, gratäng/paj, potatisprodukter, delisallad/wrap,
   kyld soppa, eller `enportionsratt` som fallback). Är den en råvara man lagar *med*?
   → gå vidare. Är den konserverad/torkad/inlagd men fortfarande en ingrediens? →
   `skafferi`-gruppen (`konserv_tomat`, `inlagt_delikatess`, …).

4. **Varumärkestestet.** Om namnet bara är ett varumärke utan generiskt ord, använd
   faktakunskap om svenska livsmedel:
   Präst/Herrgård/Grevé/Västerbottens/Grana Padano/Burrata → `ost_hard`.
   Ballerina/Singoalla/Brago/Digestive/Mariekex → `kex`.
   Dogman/Latz/Smart Pets → `djurgodis_tillbehor`/`djurmat`.
   Smash/Jätten/Dumle/Ahlgrens bilar → `godis`.
   Bregott → `smor_margarin`. Yoggi/Proviva/Cultura → `fil_yoghurt`.
   Grandiosa → `pizza`. Billys/Dafgårds → **klassificera på produktordet, inte
   varumärket** (Dafgårds säljer både bröd och färdigmat — se `kategoriClassify.mjs`s
   kommentar om varför en blank Dafgårds-override en gång gav "Grekiskt lantbröd"
   fel kategori).
   Känner du inte till varumärket: `ovrigt` med låg confidence. **Gissa inte.**

5. **Smaktestet.** Ett frukt- eller grönsaksord är ofta bara en smak, inte råvaran:
   "Fotbollsnacks Paprika" → `chips_snacks`, inte `gronsaker`. "Knatter Frukt"
   (Brynild) → `godis`, inte `frukt`. "Paprika Lök Färskost" → `ost_fars_mjuk`, inte
   grönsaker. Regeln: frukt/grönt-lövbladen är för *råvaran själv*, inte för
   produkter som smakar av den.

## `form`

Sätt oberoende av `kategori`: `fryst` | `kyld` | `farsk` | `torr` | `konserv` | `null`.
- `fryst` om namnet säger fryst/frysta/djupfryst, om det är glass, eller om
  varumärket gör det uppenbart (Findus, GB Glace, SIA Glass, Triumf Glass,
  Grandiosa, Royal Greenlands frysta räkor).
- `farsk` för färskvaror med kort datum (frukt, grönt, kött, fisk, bröd från disk).
- `kyld` för kylvaror (mejeri, ost, chark, färsk pasta, kylda såser/soppor).
- `torr`/`konserv` för skafferivaror.
- `null` om det inte går att avgöra. Gissa inte.

## `varutyp`

Öppet vokabulär, inte en fast enum — men **återanvänd** en befintlig slug ur
lexikonet om en passar, mynta bara en ny när ingen gör det (annars driver "bonor"/
"bönor"/"torkade_bonor" isär precis som de gamla nyckelordslistorna gjorde). Default
är `varutyp === kategori`; avvik bara när produkten annars skulle jämföras felaktigt
mot en helt annan sorts vara inom samma löv (se `baljvaxter`s bönor/kikärtor/linser-
uppdelning i `kategoriClassify.mjs::detectVarutyp` som referens).

Regeln: *skulle jag byta ut den ena mot den andra i ett recept utan att skriva om
receptet?* Ja → samma `varutyp`.

## Utdata

Skriv resultatet till lexikonet via `upsertLexikon()` (se
`scripts/erbjudanden-lexikon.mjs`) — inte direkt in i veckans JSON-fil (det gör
`erbjudanden-recategorize.mjs` åt dig när du kör den efteråt, som applicerar hela
lexikonet på filerna). Om du klassificerar flera nya produkter i en session, samla
dem och skriv lexikonet en gång i slutet snarare än en gång per produkt.

Per produkt:
- `kategori`, `form`, `varutyp` — se ovan.
- `markeringar`: lägg till `vegansk`/`vegetarisk` när namnet eller varumärket säger
  det (vego-, vegan-, vegetarisk-, Oumph, Quorn, Peas of Heaven, Sproud).
- `confidence`: `"hog"` bara när du är säker på både kategori och att inget annat
  rimligt alternativ finns. Annars `"lag"`.
- `kalla`: `"model"` (du klassificerade den i den här sessionen — skiljer den från
  `"regel"`, som `kategoriClassify.mjs` sätter automatiskt, och `"manuell"`, som bara
  sätts av en människas uttryckliga korrigering via `sync-category-feedback`).
- `motivering`: max 12 ord, på svenska. Läses av en människa vid granskning.

**`ovrigt` är ett godkänt svar.** En felaktig gissning är dyrare än en ärlig
`ovrigt`, eftersom felet skrivs till Git och kan bli svårt att upptäcka igen — kör
alltid `node scripts/erbjudanden-verify.mjs` efter en klassificeringsomgång, den
fångar en del (men inte alla — den kan bara motbevisa, aldrig bekräfta, se dess
header) uppenbara felklassificeringar innan de committas.
