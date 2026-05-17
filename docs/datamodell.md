# Datamodell — Matracet

Komplett referens för alla datatyper i projektet. Hänvisas till från README.md.

---

## Tumregler

- **Människor skriver/läser** → Markdown med frontmatter
- **Maskiner producerar/konsumerar** → JSON
- **Mappnamn = slug** (för recept)
- **Konvention över konfiguration** (bild.jpg, recept.md — inga konfigurerbara filnamn)

---

## 1. Recept (`data/recipes/<slug>/recept.md`)

### Struktur

```markdown
---
slug: svamprisotto
namn: Krämig svamprisotto
tid_min: 35
kategorier: [vegetarisk, glutenfri]
sasong: [host, vinter]
svarighet: enkel
barnvanlig: ja
taggar: [comfort-food, billig]
ingredienser:
  - { vara: arborioris, mangd: 300, enhet: g }
  - { vara: skogssvamp, mangd: 400, enhet: g }
  - { vara: gul lök, mangd: 1, enhet: st }
  - { vara: vitlöksklyfta, mangd: 2, enhet: st }
  - { vara: grönsaksbuljong, mangd: 1, enhet: l }
  - { vara: parmesan, mangd: 50, enhet: g }
  - { vara: smör, mangd: 30, enhet: g }
varianter:
  vegansk:
    byt:
      parmesan: näringsjäst
      smör: olivolja
---

# Krämig svamprisotto

En av höstens lugnaste middagar. Riset gör jobbet medan
man pratar bort dagen.

## Tillagning

1. Hacka löken fint och pressa vitlöken.
2. Fräs i smöret tills löken är glansig.
3. Tillsätt riset och rör så det blir blankt.
...
```

### Fält i frontmatter

| Fält | Typ | Obligatorisk | Beskrivning |
|---|---|---|---|
| `slug` | string | ja | Matchar mappnamnet. URL-säker, gemener, bindestreck |
| `namn` | string | ja | Visningsnamn |
| `tid_min` | number | ja | Total tid i minuter |
| `kategorier` | string[] | ja | `vegansk`, `vegetarisk`, `fisk`, `kott`, `glutenfri`, `laktosfri`, osv. |
| `sasong` | string[] | nej | `var`, `sommar`, `host`, `vinter`. Tom = året om |
| `svarighet` | string | nej | `enkel`, `medel`, `avancerad` |
| `barnvanlig` | string | nej | `ja`, `delvis`, `nej` |
| `taggar` | string[] | nej | Fria taggar: `comfort-food`, `helgmys`, `matlåda`, `billig`, etc. |
| `ingredienser` | array | ja | Strukturerade ingredienser (se nedan) |
| `varianter` | object | nej | Kostvarianter (se nedan) |

### Ingredienser

```yaml
ingredienser:
  - { vara: arborioris, mangd: 300, enhet: g }
  - { vara: vitlöksklyfta, mangd: 2, enhet: st }
```

| Fält | Typ | Beskrivning |
|---|---|---|
| `vara` | string | Normaliserat namn (gemener) — används för aggregering |
| `mangd` | number | Mängd för standardportionen (4 personer som default) |
| `enhet` | string | `g`, `kg`, `dl`, `l`, `msk`, `tsk`, `st`, `krm`, `pkt`, `burk`, osv. |

### Varianter

```yaml
varianter:
  vegansk:
    byt:
      parmesan: näringsjäst
      smör: olivolja
  glutenfri:
    byt:
      pasta: glutenfri pasta
```

Strukturen `varianter.<namn>.byt` är ett enkelt key→value-map som säger "när du genererar denna variant, byt ut vänster mot höger".

---

## 2. Veckomeny (`data/weeks/<year>-W<week>.json`)

```json
{
  "vecka": "2026-W21",
  "starts": "2026-05-18",
  "middagar": [
    {
      "dag": "mandag",
      "datum": "2026-05-18",
      "recept": "svamprisotto",
      "portioner": 4,
      "kommentar": "Sarah har träning kl 18"
    },
    {
      "dag": "tisdag",
      "datum": "2026-05-19",
      "recept": "linsgryta",
      "portioner": 4,
      "varianter": { "yngsta": "kottfars" }
    },
    {
      "dag": "onsdag",
      "datum": "2026-05-20",
      "recept": "pasta-pesto",
      "portioner": 4
    },
    {
      "dag": "torsdag",
      "datum": "2026-05-21",
      "recept": "lax-rotsaker",
      "portioner": 4,
      "varianter": { "sarah": "vegansk" }
    },
    {
      "dag": "fredag",
      "datum": "2026-05-22",
      "recept": null,
      "anteckning": "Pizza-utflykt på Roma"
    },
    {
      "dag": "lordag",
      "datum": "2026-05-23",
      "recept": "stekt-flask",
      "portioner": 6,
      "kommentar": "Mormor & morfar kommer!"
    },
    {
      "dag": "sondag",
      "datum": "2026-05-24",
      "recept": "coq-au-vin",
      "portioner": 4
    }
  ],
  "anteckningar": [
    { "nar": "denna-vecka", "text": "Mormor & morfar kommer på lördag — fixa något lite festligt!" },
    { "nar": "vecka-22", "text": "Sarah åker på lägret onsdag–söndag. Mindre vegoplanering." },
    { "nar": "ide", "text": "Indisk linsgryta med kokosmjölk — Sarah gillade på restaurang." }
  ],
  "extra_inkop": [
    "toalettpapper",
    "tvättmedel",
    "blommor till mormor"
  ],
  "skapad": "2026-05-17T18:30:00Z"
}
```

| Fält | Typ | Beskrivning |
|---|---|---|
| `vecka` | string | ISO-veckonummer, `YYYY-Www` |
| `starts` | string | Måndagens datum (ISO) |
| `middagar` | array | Lista per dag |
| `middagar[].dag` | string | `mandag`, `tisdag`, ..., `sondag` |
| `middagar[].datum` | string | ISO-datum |
| `middagar[].recept` | string\|null | Slug till recept, eller `null` om bortakväll |
| `middagar[].portioner` | number | Antal portioner att laga |
| `middagar[].kommentar` | string | Fri text |
| `middagar[].varianter` | object | `{ "<eater-id>": "<variant-name>" }` |
| `middagar[].anteckning` | string | Används när `recept` är `null` |
| `anteckningar` | array | Fritextlappar för veckan |
| `extra_inkop` | string[] | Saker som inte är ingredienser (toalettpapper etc.) |

---

## 3. Ätare (`data/eaters.json`)

```json
{
  "eaters": [
    {
      "id": "daniel",
      "namn": "Daniel",
      "roll": "Pappa",
      "kost": [],
      "halsa": ["lågt natrium", "högt blodtryck"],
      "gillar": ["svamp", "fisk", "starka smaker"],
      "undviker": []
    },
    {
      "id": "sarah",
      "namn": "Sarah",
      "roll": "Dotter · år 9",
      "kost": ["vegan"],
      "halsa": [],
      "gillar": ["pasta", "curry", "avokado"],
      "undviker": ["svamp", "bittert"]
    },
    {
      "id": "yngsta",
      "namn": "Yngsta barnet",
      "roll": "Barn",
      "kost": [],
      "halsa": [],
      "gillar": ["kött", "potatismos", "pasta"],
      "undviker": ["bönor", "linser", "grön sallad"]
    }
  ],
  "veckorutin": {
    "vardag_max_min": 35,
    "specialer": [
      { "dag": "tisdag", "anteckning": "Sarah har träning 18 — snabbmat" },
      { "dag": "fredag", "anteckning": "Oftast pizza-utflykt" }
    ]
  }
}
```

---

## 4. Skafferi (`data/pantry.json`)

```json
{
  "always_have": [
    "salt",
    "peppar",
    "olivolja",
    "vitlök",
    "gul lök",
    "smör",
    "grönsaksbuljong",
    "köttbuljong",
    "tomatpuré",
    "vetemjöl",
    "ägg"
  ],
  "current_stock": [
    { "vara": "parmesan", "exp": "2026-06-01" },
    { "vara": "vitlök", "antal": 3 },
    { "vara": "kanel" }
  ]
}
```

`always_have` används av inköpslistgeneratorn för att slippa visa dem som "att köpa" — de antas alltid finnas. Användaren kan klicka "köp ändå" om de tagit slut.

`current_stock` är dynamiskt och kan uppdateras från UI:t när användaren markerar "har hemma" i inköpslistan.

---

## 5. Priser (`data/prices/<year>-W<week>-<butik>.json`)

```json
{
  "butik": "willys",
  "vecka": "2026-W21",
  "kalla": "reklamblad",
  "hamtat": "2026-05-17T10:00:00Z",
  "erbjudanden": [
    {
      "vara": "rotfrukter",
      "ordinarie": 24.95,
      "rea": 14.95,
      "enhet": "kg",
      "rabatt_pct": 40,
      "tom": "2026-05-24"
    },
    {
      "vara": "kycklinglår",
      "ordinarie": 89.00,
      "rea": 59.00,
      "enhet": "kg",
      "rabatt_pct": 34,
      "tom": "2026-05-24"
    }
  ]
}
```

Detta är V2-data — inte med i MVP. Strukturen är förberedd här så vi inte behöver tänka om designen sen.

---

## 6. localStorage-data (inte commitad)

Sparas i webbläsaren, inte i Git. Skapar inga filer.

### Nyckel: `matracet:shopping:<week>`

```json
{
  "week": "2026-W21",
  "checked": ["svamp-400g", "halloumi-250g"],
  "have_home": ["parmesan", "vitlok"],
  "extra_added": ["choklad"]
}
```

### Nyckel: `matracet:current-week`

```json
{ "week": "2026-W21" }
```

Vilken vecka som visas just nu (om man bläddrar tillbaka).

---

## 7. Aggregeringsregler för inköpslista

När `shopping.ts` genererar inköpslistan från en veckomeny:

1. **Slå ihop alla ingredienser** från alla middagar (med rätt antal portioner)
2. **Applicera varianter** — om någon ätare har en variant ändras ingredienslistan
3. **Konvertera enheter** där möjligt (t.ex. `2 tsk + 1 msk → 5 tsk` eller behåll som är om det inte är trivialt)
4. **Filtrera bort `always_have`-saker** i `pantry.json`
5. **Filtrera bort manuellt avbockade `have_home`** från localStorage
6. **Gruppera per butikszon** (frukt/grönt, mejeri, kött/fisk, frys, skafferi, övrigt)
7. **Lägg till `extra_inkop`** från veckomenyn (under "övrigt")
8. **Lägg till `extra_added`** från localStorage (under "övrigt")

### Butikszoner

```
butikszoner = {
  "frukt-gront": ["lök", "vitlök", "tomat", "gurka", "sallad", "äpple", ...],
  "mejeri": ["mjölk", "smör", "ost", "yoghurt", "grädde", "creme fraiche", ...],
  "kott-fisk": ["nötfärs", "kyckling", "fläsk", "lax", "tonfisk", ...],
  "frys": ["frysta ärtor", "fryst lax", ...],
  "skafferi": ["pasta", "ris", "olja", "vinäger", "kryddor", ...],
  "ovrigt": []  // default
}
```

Skapa en zon-mappning i `data/zones.json` och normalisera ingrediensnamn till en zon vid behov. Okända varor hamnar i "övrigt".

---

## 8. Slug-konventioner

- Gemener
- Bindestreck mellan ord
- Svenska tecken översätts: ö→o, ä→a, å→a
- Korta och beskrivande

Exempel: `svamprisotto`, `linsgryta`, `pasta-pesto`, `coq-au-vin`, `stekt-flask`, `lax-rotsaker`
