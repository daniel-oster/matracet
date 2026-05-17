# Matracet — Projektsammanfattning

> En del av **Life - as it should be** · personal MVP för matplanering
>
> Sammanställd i samtal med Claude · Vecka 21, 2026

---

## 1. Bakgrund

Daniel (Trafikverket, Observe-teamet, .NET-bakgrund, vana att hantera kod via Claude Code) vill bygga något han kallat **"Life - as it should be"** — en app som hjälper med det praktiska i livet, gör det svåra lättare. Han började brett, men ringade snabbt in **matplanering** som rätt första domän, eftersom det är där han själv sliter mest.

Hushållet har olika kostpreferenser samtidigt:

- **Daniel**: lågt natrium (högt blodtryck), gillar svamp, fisk, starka smaker
- **Sarah** (dotter, år 9): vegan, gillar pasta/curry/avokado
- **Yngsta barnet**: "vanlig mat", gillar kött och potatismos

Utöver det: morgnar är stressiga, mat har blivit dyrt, säsongstänk är viktigt, och vardagsschemat (träningar, läxor) påverkar hur mycket tid det finns för matlagning.

---

## 2. Produktnamn och paraply

- **Paraplynamn**: Life - as it should be
- **Första produkten/modulen**: **Matracet**
  - Kort, svenskt, lätt att säga
  - Leker med "trace" (att spåra vad som ska handlas) och "race" (snabbt, effektivt)
  - Innan publik release: kolla PRV-varumärkesregister, domäner (matracet.se, .com), App Store/Play

---

## 3. Filosofi: Personal MVP

Detta är **inte en kommersiell produkt** — i alla fall inte än. Det är en app Daniel bygger åt sin egen familj först. Den ska:

- **Vara körbar inom dagar**, inte månader
- **Kosta noll i månaden** att underhålla
- **Lösa ett verkligt problem i Daniels eget kök** först
- Bli en kommersiell produkt **endast om värdet bevisas i hans eget liv**

### Konsekvenser

| Vad | Hur |
|---|---|
| Ingen backend | Bara statisk React-app, hostad gratis (GitHub Pages eller Vercel) |
| All data i Git | Recept, veckomenyer, prislistor — allt som filer i repot. Versionshistorik gratis. |
| Manuell intelligens | Veckomeny pratas fram med Claude, commitas som JSON. Automation byggs när mönstret bevisats. |
| Ingen auth | Personlig app. Ingen inloggning, inga GDPR-flöden. Eventuellt en enkel access-token om publik. |
| Webbläsarens minne | localStorage för "avbockat på listan" etc. Försvinner det är det inget drama. |
| Familjen är hela användarbasen | Inga analytics, ingen A/B, ingen marknadsföring. Feedback på köksbordet. |

### Vad MVP **inte** ska göra

- Inte automatiskt generera veckomenyer (gör det manuellt med Claude)
- Inte koppla mot Alexa eller andra integrationer
- Inte ha redigerbara recept i UI (redigera i vim/Claude Code, commita)
- Inte räkna näring eller hälsodata
- Inte göra prisjakt mellan butiker
- Inte hantera kalender

Allt det ovan **görs manuellt** tills mönstret är så stabilt att det är värt att automatisera.

---

## 4. Arkitektur

### Stack

- **Vite + React + TypeScript** — modern toolchain, snabb dev-loop, ingen ramverkstyngd
- **Statisk build** (`npm run build` → HTML/CSS/JS för GitHub Pages)
- **Tailwind eller vanilla CSS** — bestäms under bygget. Lutar mot Tailwind.
- **Vite Markdown-plugin** (eller egen loader) för att läsa recept med frontmatter vid build-tid
- **Inget mer** — ingen state-manager, ingen router (en sida räcker), inga tester

### Två datatyper, två format

| Vad | Format | Varför |
|---|---|---|
| Recept | Markdown + frontmatter | Trevligt att läsa/redigera, läsbara på GitHub |
| Veckomenyer | JSON | Maskingenererad, kort referensdata |
| Ätarprofiler | JSON | Strukturerat, kort |
| Prislistor | JSON | Tolkad data från reklamblad |
| Bilder | JPG/WebP | Co-located med recept |

**Tumregel**: Text som *människor* skriver → Markdown. Data som *kod* producerar/konsumerar → JSON.

---

## 5. Mappstruktur

```
matracet/
├── data/
│   ├── recipes/
│   │   ├── svamprisotto/
│   │   │   ├── recept.md
│   │   │   └── bild.jpg
│   │   ├── linsgryta/
│   │   │   ├── recept.md
│   │   │   └── bild.jpg
│   │   └── pasta-pesto/
│   │       ├── recept.md
│   │       ├── bild.jpg
│   │       └── steg-3.jpg          ← framtida möjlighet
│   ├── eaters.json                  ← Daniel, Sarah, yngsta barnet
│   ├── pantry.json                  ← "saker jag alltid har hemma"
│   ├── weeks/
│   │   ├── 2026-W21.json
│   │   └── 2026-W22.json
│   └── prices/
│       └── 2026-W21-willys.json
├── public/
│   └── (statiska tillgångar som inte hör till recept)
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── Binder.tsx               ← huvudvyn (Filofax-pärm)
│   │   ├── Page.tsx                 ← en sida (vänster eller höger)
│   │   ├── Tabs.tsx                 ← flikarna längs kanten
│   │   ├── views/
│   │   │   ├── VeckanView.tsx
│   │   │   ├── HandlaView.tsx
│   │   │   ├── ReceptView.tsx
│   │   │   ├── FamiljView.tsx
│   │   │   └── AnteckningarView.tsx
│   ├── lib/
│   │   ├── recipes.ts               ← läser markdown vid build
│   │   └── shopping.ts              ← aggregerar ingredienser
│   └── styles/
│       └── filofax.css              ← all design från prototypen
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Konvention över konfiguration

- Bilden för ett recept heter alltid `bild.jpg` (eller `bild.webp`)
- Receptet heter alltid `recept.md`
- Mappnamnet *är* slugen
- Koden hittar bilden själv — inget bildfält i frontmatter

### Vite-detalj

För att Vite ska servera bilder från `/data/recipes/` behöver vi antingen flytta `data/` till `public/data/` eller använda Vites `?url`-import. Båda går — bestäms vid bygget.

---

## 6. Datamodell

### Recept (Markdown med YAML-frontmatter)

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

1. Hacka löken fint och pressa vitlöken. Fräs i smöret
   tills löken är glansig.
2. Tillsätt riset och rör så det blir blankt.
3. Häll på buljong en slev i taget...
```

### Veckomeny (JSON)

```json
{
  "vecka": "2026-W21",
  "middagar": [
    {
      "dag": "mandag",
      "datum": "2026-05-18",
      "recept": "svamprisotto",
      "kommentar": "Sarah har träning kl 18"
    },
    {
      "dag": "tisdag",
      "datum": "2026-05-19",
      "recept": "linsgryta",
      "varianter": { "yngsta-barnet": "kottfars" }
    },
    {
      "dag": "fredag",
      "datum": "2026-05-22",
      "recept": null,
      "anteckning": "Pizza-utflykt på Roma"
    }
  ],
  "anteckningar": [
    { "nar": "denna-vecka", "text": "Mormor & morfar kommer på lördag" }
  ],
  "skapad": "2026-05-17T18:30:00Z"
}
```

### Ätare (JSON)

```json
{
  "eaters": [
    {
      "id": "daniel",
      "namn": "Daniel",
      "roll": "Pappa",
      "halsa": ["lågt natrium", "högt blodtryck"],
      "gillar": ["svamp", "fisk", "starka smaker"],
      "undviker": []
    },
    {
      "id": "sarah",
      "namn": "Sarah",
      "roll": "Dotter · år 9",
      "kost": ["vegan"],
      "gillar": ["pasta", "curry", "avokado"],
      "undviker": ["svamp", "bittert"]
    },
    {
      "id": "yngsta",
      "namn": "Yngsta barnet",
      "roll": "Barn",
      "kost": ["vanlig"],
      "gillar": ["kött", "potatismos", "pasta"],
      "undviker": ["bönor", "linser", "grön sallad"]
    }
  ]
}
```

### Skafferi (JSON)

```json
{
  "always_have": [
    "salt", "peppar", "olivolja", "vitlök", "gul lök", "smör",
    "grönsaksbuljong", "köttbuljong", "tomatpuré", "vetemjöl", "ägg"
  ],
  "current_stock": [
    { "vara": "parmesan", "exp": "2026-06-01" },
    { "vara": "vitlök", "antal": 3 }
  ]
}
```

---

## 7. Designspråk — Filofax

Designen är inspirerad av en personlig Filofax-pärm:

- **Dusty blue läder** (#94a8ad-ish) som pärm
- **Cognac-brunt foder** i mitten där ringbindningen sitter
- **Vita/krämfärgade sidor** med blå linjer och röd marginallinje
- **Sex metallringar** som håller ihop båda sidorna
- **Små färgade flikar** på högerkanten för navigation:
  - **Veckan** (gul)
  - **Handla** (orange)
  - **Recept** (grön)
  - **Familj** (rosa)
  - **Anteckningar** (blå)

### Typografi

- **Fraunces** (serif) — titlar, datum, "tryckt" text
- **Caveat** (handskriven, kursiv) — maträtter, viktiga rubriker
- **Patrick Hand** (handskriven, regular) — detaljer, taggar, fritext
- **Inter Tight** (sans-serif) — etiketter, småtext, UI
- **JetBrains Mono** — datumkoder, statusrader

### Layout

- **Landskap**: Tvåsidigt uppslag med ringar i mitten
- **Porträtt**: En sida åt gången, ringar i vänsterkanten (som anteckningsbok), bläddraknappar nedanför

Allt detta finns implementerat i `prototypes/filofax-prototyp.html` — det är produktionsdugligt design-DNA som kan översättas till React-komponenter.

---

## 8. MVP-scope

### Vad som faktiskt ska byggas (för att vara körbar i Daniels kök)

| Funktion | Komplexitet | Manuell eller automatisk? |
|---|---|---|
| 10–15 recept som Markdown | Medel (innehåll) | Manuell — familjefavoriterna först |
| Filofax-vy i React (5 flikar) | Medel (design) | Automatisk rendering |
| Veckomeny som JSON | Låg | Manuell — genererad i Claude-chatt, commitad |
| Inköpslista (aggregerad) | Låg | Automatisk — räknar ihop ingredienser |
| "Har hemma"-bockning | Låg | Automatisk — localStorage |
| Avbockning i butiken | Låg | Automatisk — localStorage |
| Deploy till GitHub Pages | Låg | Automatisk — vid push till main |

### Förväntad tid

En helg om allt flyter. En vecka om det krånglar. Inte månader.

---

## 9. Roadmap efter MVP

### V2 — "Min app, inte en app"
- Lägg till egna recept (fritext & URL-import)
- Frukostmodul med 3–5 default-rutiner
- Kalenderkoppling: tidsbegränsade middagar tisdagar
- Reklamblad & prisjämförelse för 2–3 svenska kedjor

### V3 — "Appen som sparar pengar"
- Optimera meny baserat på veckans rea-priser
- Dela inköpslista på flera butiker
- Budget-skjutreglage ("hur stramt denna vecka?")

### V4+ — "Appen som tar hand om hela måltidsekonomin"
- Näringsöversikt över tid
- Lunch / matlådor / restanvändning
- Foto-recept (OCR)
- Alexa / Google Home / Siri Shortcuts (synk med befintliga listor)
- Familjedelning

---

## 10. Risker att hålla koll på

1. **Innehållskostnaden** — Receptbiblioteket är inte trivialt. 50 högkvalitativa, korrekt taggade recept = 60–100 timmars arbete. Plan: LLM-genererade utkast som redigeras.

2. **"Förslag jag inte gillar"-spiralen** — Den största risken med veckomenyer är att första veckan är okej, andra träig, tredje övergiven. Lärningsslingan måste kännas snabb.

3. **Optimering är socialt, inte tekniskt** — Mat handlar om humör, vana, kultur. Algoritmen ska föreslå, aldrig diktera.

4. **Hälsopåståenden** (för marknadsversion) — "Sänker blodtryck" är medicinskt påstående i Sverige. Var försiktig med språket.

5. **GDPR & familjedata** (för marknadsversion) — Hälsouppgifter är känsliga personuppgifter. Barns data har extra skydd. Lokal lagring i MVP undviker hela frågan.

---

## 11. Konkurrenter (för referens)

- **Mealime** — engelska, ingen prisjakt, hanterar inte olika ätare elegant
- **Paprika Recipe Manager** — bibliotek, ingen planeringsintelligens
- **Whisk / Samsung Food** — AI-menyer, ingen svensk kontext
- **Tasteline / Köket.se** — receptsidor, ingen familjelogik
- **Matspar / Matpriskollen** — prisverktyg, ingen veckomeny
- **ICA / Coop-appar** — bundna till en kedja

**Matracets unika position**: svensk familjeplanerare som tar hänsyn till olika ätare, hälsobehov och pris över flera butiker — och lär sig vad just denna familj gillar.

---

## 12. Filer i detta paket

- `README.md` — detta dokument (komplett projektsammanfattning)
- `CLAUDE-CODE-PROMPT.md` — färdig prompt att klistra in i Claude Code
- `prototypes/produktbeskrivning.html` — interaktiv produktbeskrivning (öppna i webbläsare)
- `prototypes/filofax-prototyp.html` — interaktiv Filofax-prototyp med dummy-data
- `docs/datamodell.md` — detaljerade datamodell-exempel (Markdown + JSON)

---

## 13. Nästa steg

1. Skapa GitHub-repo `matracet`
2. Klona repot lokalt
3. Lägg in detta paket i en `docs/`-mapp
4. Öppna Claude Code med prompten från `CLAUDE-CODE-PROMPT.md`
5. Bygg MVP enligt scopet ovan
6. Använd i 3 veckor i ditt eget kök
7. Iterera baserat på vad som skaver

**Det viktigaste**: börja smalt, lev med det, lyssna på vad som faktiskt händer i köket. Allt annat (frukost, Alexa, prisjakt, kalender) byggs *när* behovet är konkret bevisat — inte innan.
