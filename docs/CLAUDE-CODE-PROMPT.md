# Claude Code-prompt för Matracet

Klistra in följande i Claude Code när du har klonat ett tomt `matracet`-repo och lagt detta `docs/`-paket i det.

---

## Prompt att klistra in

```
Jag startar ett nytt personal MVP-projekt som heter Matracet — en matplaneringsapp för min egen familj. All kontext finns i docs/README.md i det här repot. Läs den först.

Kort sammanfattning:
- Personal MVP: en app åt mig själv, inte en kommersiell produkt
- Stack: Vite + React + TypeScript, statisk hosting
- Ingen backend, ingen databas, ingen auth — all data ligger som filer i Git
- Recept som Markdown med YAML-frontmatter (co-located med bilder)
- Veckomenyer, familj, priser som JSON
- Design: Filofax-pärm — se docs/prototypes/filofax-prototyp.html för exakt design-DNA

Hjälp mig komma igång steg för steg. Börja med att:

1. Läsa docs/README.md noggrant
2. Öppna docs/prototypes/filofax-prototyp.html och titta på designen (CSS:en är det vi vill översätta till React-komponenter)
3. Bekräfta att du förstått upplägget
4. Föreslå ordningen vi tar i: först setup (Vite/React/TS/Tailwind?), sedan mappstruktur, sedan första vyn (Veckan-fliken med dummy-data), sedan inläsning av Markdown-recept, sedan inköpslistgenerering

För varje steg: visa mig vad du tänker göra innan du gör det, så jag kan godkänna eller styra om. Jag vill behålla full kontroll över arkitekturen — jag är erfaren utvecklare och vill undvika onödiga abstraktioner och dependencies.

Viktiga principer:
- Konvention över konfiguration (bilden för ett recept heter alltid bild.jpg, mappnamnet är slugen, etc.)
- Inget mer än vi behöver (ingen state-manager, ingen router till en början)
- Allt ska kunna deploys till GitHub Pages med `npm run build`
- Markdown-läsning sker vid build-tid, inte runtime
- Vi accepterar att det är "fult" innan det är "rätt" — körbar app i mitt kök går före perfekt kod

Första frågan: läs docs/README.md och säg vad du tycker. Finns det något i upplägget du tycker är fel eller skulle göra annorlunda? Var ärlig — jag vill ha den bästa starten, inte snäll bekräftelse.
```

---

## Tips för Claude Code-sessionen

### Inställningar att aktivera först

- Sätt upp `.claude/settings.json` så Claude kan köra `npm`, `pnpm`, `git`, `vite` utan att fråga varje gång
- Eventuellt sätt `permissions.allow` för filsystemoperationer i `src/`, `data/`, `public/`

### Goda första kommandon till Claude Code efter prompten

1. **"Visa mig din plan innan vi börjar koda."** — Få Claude att lägga upp hela arbetsordningen, inte bara nästa steg.

2. **"Vad vill du veta mer om innan du börjar?"** — Får fram osäkerheter i din spec som är värda att klargöra.

3. **"Föreslå tre val där du skulle göra annorlunda än vad README:n säger, och varför."** — Tvingar fram kritiskt tänkande snarare än ja-sägeri.

### Iterationsrytm jag rekommenderar

1. **Steg 1: Setup** — Vite-skellett, mappstruktur, Tailwind eller vanilla CSS-beslut, första commit
2. **Steg 2: Filofax-skal** — Översätt CSS:en från prototypen till React-komponenter (Binder, Page, Tabs) med dummy-data
3. **Steg 3: Veckan-fliken** — Hårdkoda en vecka först, få den att se ut som prototypen
4. **Steg 4: Markdown-läsning** — Bygg loadern, lägg in 3 recept (svamprisotto, linsgryta, pasta-pesto) och få Veckan att läsa från dem
5. **Steg 5: Handla-fliken** — Generera inköpslista från veckans recept
6. **Steg 6: localStorage** — Avbockning sparas mellan sessions
7. **Steg 7: Deploy** — GitHub Actions → Pages

### När du fastnar

- "Förklara vad du gjorde och varför" — får fram din egna mentala modell
- "Lägg till det enklaste möjliga och inte mer" — när Claude vill bygga abstraktioner du inte bett om
- "Backa till föregående version och prova annan väg" — git är din vän

### Innehållsgenerering (recept) parallellt

Du kan starta en **separat Claude.ai-konversation** för att generera receptinnehåll medan Claude Code bygger appen. Berätta att du jobbar på Matracet-projektet, be om recept för dina familjefavoriter, och få dem som Markdown med rätt frontmatter-struktur (se exempel i README.md). Sen committar du in dem manuellt i repot.

---

## Lycka till!

När appen funkar i ditt eget kök tre veckor i rad — *då* är det dags att börja prata om hur den blir tillgänglig för andra familjer. Inte innan.
