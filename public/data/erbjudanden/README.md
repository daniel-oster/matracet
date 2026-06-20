# Erbjudanden (veckans extrapriser)

Veckans extrapriser från de tre närbutikerna, sparade per butik och vecka så att
de kan jämföras mot varandra och mot veckans middagsplanering — och sparas
historiskt. Målet: planera en runda mellan butikerna och laga billigare middagar.

## Filstruktur

```
erbjudanden/
  <butik-id>/<vecka>.json     ett reklamblad per butik och vecka
  README.md                   detta dokument
  bevakningslista.json        stående bevakningslista (kaffe, toapapper m.m.)
```

Butiker hittills:
- `willys-borlange-stora-tuna` — Willys Borlänge Stora Tuna
- `maxi-ica-stormarknad-borlange` — Maxi ICA Stormarknad Borlänge
- `hemkop-borlange-sodra-backa` — Hemköp Borlänge Södra Backa

> **Tips om källor:** spara alltid den *strukturerade* listan / e-handelsexporten,
> inte det grafiska reklambladet. Det grafiska bladet renderar ofta priser med
> egen teckensnittskodning som blir obrukbar text vid extraktion. Den
> strukturerade listan ger rena priser, jämförpris, ordinarie pris och
> 30-dagarspris. (Hemköps grafiska blad var t.ex. oläsligt, den strukturerade
> listan var bäst av alla tre butikerna.)

`<vecka>` följer samma ISO-format som veckomenyerna, t.ex. `2026-W25`.

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

`mejeri`, `kott_fagel`, `fisk_skaldjur`, `frukt_gront`, `torrvaror`,
`brod_bakverk`, `dryck`, `frys`, `snacks_godis`, `hygien_hushall`, `ovrigt`.

### Noteringar

- Belopp i `ord_pris`, `pris_30dgr` och `jamforpris` skrivs med **decimalpunkt**
  (`34.02`, `159.90-177.67/kg`) för enhetlig tolkning mellan butiker. `pris` är
  alltid ett numeriskt styckpris i kr (vid multipris = per enhet).
- `jamforpris` är **nyckeln för jämförelse** mellan butiker: pris per kg/liter/st
  oberoende av förpackningsstorlek. UI kan parsa `tal + enhet` ur strängen.
- Personliga kuponger (Hemköps "Bara för dig", kräver aktivering och har ofta
  längre giltighet) markeras i `notering` och har `klubbpris: false`.

## Bevakningslista (stående)

`bevakningslista.json` håller varor man gärna bunkrar när de är på extrapris
(t.ex. kaffe i rätt märke, toapapper, maskindiskmedel). Tanken är att kunna
flagga automatiskt när en bevakad vara dyker upp i något reklamblad — och helst
sätta ett tröskelpris (kr eller jämförpris) som räknas som "ett bra köp".
