# Matracet-ombyggnaden (2026-11)

Mål: det ska vara lätt att planera veckans mat utan ansträngning, och rabatterna ska komma med.
Grund: måltidsbiblioteket (`public/data/meals.json`, måltid → `recept[]`) är på plats, se CLAUDE.md
"Everyday dishes and their recipes". Livet-planen är `docs/livet-plan.md` (steg 3–5 här).

## Jobb

| Jobb | Vad | Rör | Beror på |
|---|---|---|---|
| **A** | Förslagsmotor `src/lib/weekProposal.ts` + tester | bara nya filer | – |
| **B** | Veckoförslaget i UI (Veckan → Planera öppnar med förslaget) | `VeckanView`, `VeckanPlanner`, ny `week/WeekProposal.tsx`, `App.tsx` | A |
| **C** | Enklare startsida: kvällens middag + Veckan/Handla/Recept, resten under "Mer" | `Hub.tsx`, `paper.css` | – |

A och C körs parallellt, B efter A. Varje jobb körs av en subagent (Sonnet 5.5); huvudsessionen
granskar, bygger, testar och committar.

### A – förslagsmotorn (ren logik)

`proposeWeek(opts)` → per dag en rankad lista kandidater; första = förslaget, resten = "byt".
- Kandidater: planerbara recept (`filterPlannableRecipes`) grupperade per måltid via `meals[].recept`
  (recept utan måltid räknas som sin egen virtuella måltid).
- Uteslut: någon närvarande `refuses`, `excludeFromWeekPlan`, kostkonflikt som inte går att lösa
  (`evaluateFit` – byten är ok, konflikter/okända utan byte uteslut för vegan).
- Poäng: rabatt på en ingrediens (`findOfferMatch` + `parseSavings`), gillas av närvarande, snabb
  (≤ `FAST_THRESHOLD_MIN`) när dagen är "kort om tid", minus om receptet/måltiden ätits nyligen.
- Variation: samma måltid högst en gång bland veckans förstaval.
- Deterministisk givet `seed` (så "Föreslå nytt" kan ge en annan vecka).
- Varje kandidat bär korta skäl på svenska ("🏷 kycklingfilé −20 kr", "❤ Barn A", "⚡ 25 min").

### B – veckoförslaget

- Planera öppnar med ett kort "Veckans förslag" överst: en rad per ledig middag som behöver mat
  (samma `needsMeal`-logik som budgeten, skoldagar/skip respekteras).
- Varje rad: dag, måltid + recept, skäl. Knappar **Behåll** (lägger in via samma väg som
  slot-pickern, `assignToSlot`), **Byt** (nästa kandidat), **✕** (hoppa över dagen i förslaget).
- **Behåll alla** och **Föreslå nytt** (nytt seed).
- Nyligen ätet: historiken från `history.json` (de senaste 14 dagarna) skickas in.
- Resten av Planera (listan, tavlan, fynd, recept) ligger kvar under förslaget.

### C – startsidan

- Överst kvällens middag (som i dag).
- Tre stora knappar: **Veckan**, **Handla**, **Recept**.
- "Mer" (ihopfällt) med övriga rutor: Fynd, Bevaka, Skafferi, Historik, Anteckningar, Nytt,
  Familj, Hantera appen, Livet.
- Inga funktioner tas bort.

## Senare (inte nu)

- "Köp nu"-kort från en lista över det vi brukar köpa.
- Familj/Hantera flyttar till Livet (livet-plan steg 2).
