# Erbjudanden (veckans extrapriser)

Veckans extrapriser från de tre närbutikerna, sparade per butik och vecka så att
de kan jämföras mot varandra och mot veckans middagsplanering — och sparas
historiskt. Målet: planera en runda mellan butikerna och laga billigare middagar.

## Filstruktur

```
erbjudanden/
  <butik-id>/<vecka>.json     ett reklamblad per butik och vecka
  _index.json                 lista över butiker + alla veckor som finns sparade
  _latest.json                pekare till senaste veckan (UI:ts default)
  README.md                   detta dokument
  bevakningslista.json        stående bevakningslista (kaffe, toapapper m.m.)
```

Butiker hittills:
- `willys-borlange-stora-tuna` — Willys Borlänge Stora Tuna
- `maxi-ica-stormarknad-borlange` — Maxi ICA Stormarknad Borlänge
- `hemkop-borlange-sodra-backa` — Hemköp Borlänge Södra Backa

**När en ny vecka läggs till:** lägg till `<butik-id>/<vecka>.json` för varje
butik, lägg till veckan i `_index.json` → `veckor`, och peka `_latest.json` →
`vecka` på den nya veckan. UI:t (fliken *Fynd*) visar `_latest.json` som
förval men låter dig bläddra till valfri sparad vecka i `_index.json.veckor`.

> **Tips om källor:** spara alltid den *strukturerade* listan / e-handelsexporten,
> inte det grafiska reklambladet. Det grafiska bladet renderar ofta priser med
> egen teckensnittskodning som blir obrukbar text vid extraktion. Den
> strukturerade listan ger rena priser, jämförpris, ordinarie pris och
> 30-dagarspris. (Hemköps grafiska blad var t.ex. oläsligt, den strukturerade
> listan var bäst av alla tre butikerna.)
>
> **Sedan 2026-07 är en Safari `.webarchive` av butikens erbjudande-sida den
> förväntade källan för alla tre butiker**, inte bara Willys — se
> `.claude/skills/import-erbjudanden/SKILL.md` steg 1 för extraktion
> (`erbjudanden-webarchive-extract.py`) och respektive `erbjudanden-parse-<butik>-html.mjs`.
> Det ger exakta prissiffror direkt ur sidans DOM (schema.org-markup för Willys,
> `data-testid`-attribut för ICA/Hemköp) utan kolumndelning eller
> teckensnittsgissning. PDF-vägen nedan finns kvar som fallback.

`<vecka>` följer samma ISO-format som veckomenyerna, t.ex. `2026-W25`.

## Importverktyg (PDF → JSON)

När en ny veckas reklamblad kommer in som uppladdade PDF:er (t.ex. utskrivna
från butikens webbsida), använd `scripts/erbjudanden-*` istället för att läsa
PDF-sidorna som bilder — sidorna har en text-lager som `pdftotext` kan läsa
rakt av, vilket är mycket billigare än bild-tolkning av 30–200 sidor per butik.

```bash
# 1. Installera poppler-utils om det saknas (ofta redan installerat):
apt-get install -y poppler-utils

# 2. Extrahera text (bevarar layout så kolumner hamnar på samma rad):
pdftotext -layout willys.pdf willys.txt

# 3a. Willys och Hemköps strukturerade lista renderas som två kolumner
#     (2 varor per rad) — dela upp i två enkla textflöden först:
node scripts/erbjudanden-split-columns.mjs willys.txt
#     → willys.left.txt, willys.right.txt

# 3b. Kör butikens parser på varje kolumn (Willys/Hemköp) eller hela
#     filen direkt (ICA, som redan är en kolumn):
node scripts/erbjudanden-parse-willys.mjs willys.left.txt > left.json
node scripts/erbjudanden-parse-willys.mjs willys.right.txt > right.json
node scripts/erbjudanden-parse-ica.mjs ica.txt > ica-draft.json
node scripts/erbjudanden-parse-hemkop.mjs hemkop.left.txt > left.json
```

Varje parser skriver ut ett **utkast** (draft) — inte den färdiga filen.
Stämmer alltid av mot källtexten innan utkastet vävs in i veckans JSON:
- **ICA**: blandar in icke-livsmedel (kläder, elektronik, leksaker, böcker,
  kosmetik) i samma lista — filtrera bort dem manuellt (se `urval`-fältet).
- **Willys**: `kategori`-gissningen är en enkel nyckelordslista
  (`erbjudanden-lib.mjs`) och missar egennamn (t.ex. ostmärken) — "ovrigt"
  är en godkänd reserv, inte ett fel.
- **Hemköp**: parsern täcker bara den strukturerade prislistan. Ursprungsland
  för frukt/grönt/kött finns bara i det grafiska reklambladet (samma
  butik, andra PDF:en) — dela upp den filen med samma
  `erbjudanden-split-columns.mjs`-skript och slå upp ursprung per
  produktnamn manuellt (siffrorna i det bladet är trasiga p.g.a.
  teckensnittskodning, men löptexten går att läsa).
- Sidbrytningar i källans PDF-export upprepar ibland sista raden på nästa
  sida, eller delar ett erbjudande mitt i (namnet hamnar före priset istället
  för efter) — parsern hanterar de vanligaste fallen men enstaka poster kan
  behöva handpatchas (sök på produktnamnet i källtexten, `pdftotext`-filen).
- **Kolumndelningen (`erbjudanden-split-columns.mjs`) lär sig var kolumnerna
  börjar från dokumentets egna rader** (median-indrag för rader med en synlig
  lucka), och använder det lokalt (närmsta rad med lucka) för rader utan
  egen lucka — t.ex. en lös "Visa fler sorter", "Max N köp" eller ett pris
  utan enhet. Detta är en riktig förbättring över att alltid gissa "vänster":
  den första versionen läckte högerkolumnens fält (max-köp, "Välj &
  blanda") in i vänsterkolumnens post och gav fel produkt fel data. **Kvarvarande
  känd lucka**: ett pris som renderas som två separata textkörningar av
  olika typsnittsstorlek (kronor + upphöjda ören, t.ex. "28    00" för
  "28,00") ser identiskt ut som en kolumn-lucka och kan inte skiljas åt
  automatiskt — hittills sett en gång (Willys), handpatchad efter att ha
  läst källraden. Om ett pris ser orimligt ut (0 kr, eller en 1–2-siffrig
  "kronor"-del), sök upp produktnamnet i `pdftotext`-filen och kontrollera.
- Willys markerar slutsålda varor med **"Slut i lager"** istället för den
  vanliga `N st`-räknaren som annars avslutar varje post — parsern känner
  igen båda som postavslut (annars sväljer den slutsålda varans post in
  nästa varas fält).

Formatet växlar lite mellan veckor/källor (special-erbjudanden, nya etiketter
som "HANDLA FÖR 300 KR"), så vänta dig att behöva justera en parser något
varje gång — men grundstrukturen (kolumndelning → radvis tillståndsmaskin)
håller över tid.

## Schema (per fil)

| Fält | Beskrivning |
|---|---|
| `schema_version` | 1 |
| `kalla` | `willys` \| `ica` \| `hemkop` |
| `butik` | Visningsnamn |
| `butik_id` | Katalognamn (slug) |
| `vecka` | `YYYY-Www` |
| `giltigt_fran` / `giltigt_till` | Giltighetsperiod (ISO-datum) |
| `hamtad` | När bladet hämtades |
| `kalla_url` | Källa, om webb (annars `null`) |
| `urval` | Vad som tagits med (t.ex. bara livsmedel + hushåll) |
| `antal` | Antal poster |
| `erbjudanden[]` | Lista, se nedan |

## Schema (per erbjudande)

Supersättning — varje butik fyller i det den exponerar, resten är `null`.

| Fält | Beskrivning |
|---|---|
| `namn` | Produktnamn |
| `marke` | Varumärke |
| `storlek` | Storlek/vikt som text |
| `pris_text` | Priset som det visas (`"44:90/st"`, `"2 för 55:-"`, `"15% rabatt"`) |
| `pris` | **Numeriskt** styckpris i kr (vid multipris = per enhet), annars `null` |
| `pris_typ` | `st` \| `multi` \| `rabatt` |
| `jamforpris` | **Jämförpris** (kr/kg, kr/liter, kr/st) — nyckeln för jämförelse mellan butiker och förpackningsstorlekar. ICA anger detta; Willys oftast inte. |
| `ord_pris` | Ordinarie pris (ICA) |
| `pris_30dgr` | Lägsta 30-dagarspris |
| `besparing` | Uttalad besparing (Willys "Spara X kr") |
| `klubbpris` | `true` om priset kräver medlemskap (Hemköp Klubbpris, ICA-app m.m.) |
| `max_kop` | Köpgräns per hushåll |
| `markeringar` | Märkningar: `nyckelhal`, `msc`, `asc`, `krav`, `eko`, `svanen`, `rainforest`, `fairtrade`, `fagel_sverige`, `kott_sverige`, `svensk`, `miljomarkt`, `eu_blomman`, `glutenfri` … |
| `ursprung` | Ursprungsland (ICA anger ibland) |
| `notering` | Fritext (t.ex. "Tillfälligt parti", "Välj & blanda") |
| `kategori` | Se nedan |

### Kategorier

Grupperat efter "vad lagar jag med", inte butikens hyllplacering:

`protein_farsk`, `protein_fryst`, `gront_farsk`, `gront_fryst`, `frukt`,
`snacks_godis`, `ovrigt`.

`protein_*` täcker kött, fågel, fisk, skaldjur, ägg och vegetariska/veganska
proteinkällor (tofu, quorn, bönor, linser …), delat i färskt/fryst. `gront_*`
är grönsaker, samma färskt/fryst-delning. `frukt` är frukt & bär (ingen
färskt/fryst-delning). `ovrigt` är allt annat på ett reklamblad — mejeri,
bröd, dryck, skafferivaror, hygien/hushåll, färdigrätter, glass — snarare än
en egen kategori vardera, eftersom UI:t (`FyndView`) numera grupperar just
efter protein/grönt/frukt/snacks/resten. Se `scripts/erbjudanden-lib.mjs`
(`guessKategori`) för nyckelordsgissningen och `scripts/erbjudanden-recategorize.mjs`
för engångsmigreringen från den gamla 11-kategori-listan (kott_fagel,
fisk_skaldjur, frukt_gront, mejeri, brod_bakverk, torrvaror, frys, dryck,
snacks_godis, hygien_hushall, ovrigt) till denna.

### Noteringar

- Belopp i `ord_pris`, `pris_30dgr` och `jamforpris` skrivs med **decimalpunkt**
  (`34.02`, `159.90-177.67/kg`) för enhetlig tolkning mellan butiker. `pris` är
  alltid ett numeriskt styckpris i kr (vid multipris = per enhet).
- `jamforpris` är **nyckeln för jämförelse** mellan butiker: pris per kg/liter/st
  oberoende av förpackningsstorlek. UI kan parsa `tal + enhet` ur strängen.
- Personliga kuponger (Hemköps "Bara för dig", kräver aktivering och har ofta
  längre giltighet) markeras i `notering` och har `klubbpris: false`.

### Ursprung & märkningar (viktigt för beslut)

Vid små prisskillnader är ursprung/märkning ofta det som avgör. Därför:

- **Ursprung samlas alltid i `ursprung`** (t.ex. `Sverige`, `Irland/UK`,
  `Nya Zeeland`), oavsett hur butiken angav det. Willys uttrycker svenskt
  ursprung som märkningar (`svensk`, `kott_sverige`, `fagel_sverige`) — dessa
  speglas även in i `ursprung` så att fältet går att jämföra mellan butiker.
- `markeringar` håller certifieringar/märken som **står som text** i källan
  (Willys reklamblad är textrikt). I ICAs och Hemköps PDF-exporter är många
  märken (Nyckelhålet, MSC, KRAV m.fl.) **bildikoner** och går inte att läsa
  maskinellt — där fångas bara det som skrivs i klartext (`Ursprung X`, `ASC`/
  `Eko`/`Svensk` i produktnamnet). Komplett märkningsdata kräver butikens
  API/strukturerade källa eller manuell taggning.
- För Hemköp lönar det sig att läsa **båda** filerna: den strukturerade listan
  för priser, det grafiska bladet för extra ursprungsrader (t.ex. Färskpotatis
  → Sverige) som saknas i listan.

## Bevakningslista (stående)

`bevakningslista.json` håller varor man gärna bunkrar när de är på extrapris
(t.ex. kaffe i rätt märke, toapapper, maskindiskmedel). Visas i UI:t under
fliken **Bevaka** (`BevakaView.tsx`): vänster sida listar hela bevakningslistan
med en 🔔 på varor som har en träff just nu, höger sida visar själva träffarna
(butik, pris, storlek) grupperat per bevakad vara.

Schema per post (`BevakningItem` i `src/types.ts`):

| Fält | Beskrivning |
|---|---|
| `id` | Unik nyckel (slug) |
| `vara` | Visningsnamn |
| `kategori` | Samma kategori-id som erbjudanden, styr emoji/gruppering |
| `sok` | Lista med gemener-substrängar som matchas mot erbjudandets `namn`/`marke`. **Tom lista** = bevaka hela `kategori` istället för enskilda sökord (t.ex. all frukt & grönt, alla snacks) |
| `undvik_marken` | Varumärkes-substrängar som diskvalificerar en annars matchande träff (t.ex. inte Gevalia) |
| `onskat_marke` | Ev. specifikt märke man vill ha (`null` om inte bestämt) |
| `storlek_hint` | Fritext om önskad storlek/förpackning (`null` annars) |
| `troskel_kr` | Ev. priströskel i kr för "bra köp" (`null` = ingen automatisk gräns, bara manuell bedömning) |
| `anteckning` | Fritext-anteckning |

Matchningen är enkel substrängsmatchning (case-insensitive), inte samma
normalisering som `FyndView`s jämför-läge — bra nog för en handfull stående
varor, men kan ge falska positiva för korta sökord. Det finns inget
in-app-formulär för att lägga till varor (appen har ingen backend) — nya
poster eller kompletteringar (t.ex. fylla i `onskat_marke` när märket är
bestämt) läggs till direkt i filen.
