# Livet – plan (2026-11)

Beslutat i samtal med hushållet. Ändra inte på egen hand; fråga först.

## Mental modell

**Livet** är basen. Därifrån förgrenar sig två appar:

- **Läget** – visar snabbt hur det står till nu. Bara visning, ingen konfiguration.
- **Matracet** – vad vi äter och handlar, inklusive matens egna inställningar
  (måltidsbibliotek med måltider och deras recept, "det vi brukar köpa").

Livets startsida har tre stora sköldar:

- **Läget** → `/matracet/laget/`
- **Matracet** → `/matracet/`
- **Livet** → det som handlar om oss: familjen, schema och perioder, aktiviteter, notiser,
  koppling (token/synk).

Startsidan är bara de tre sköldarna; allt innehåll ligger bakom dem.

All data ligger i det privata repot `livet-data`. Inget om familjens personer i det här publika repot.

## Adresser (beslut: inget flyttas nu)

| App | Adress |
|---|---|
| Livet | `/matracet/livet/` (ny) |
| Matracet | `/matracet/` (oförändrad) |
| Läget | `/matracet/laget/` (oförändrad) |

Inga nya repon, inga nya tokens. En snyggare adressstruktur (t.ex. Livet på roten) kan vi ta senare.

**Token/lagring:** varje hemskärmsikon på iPhone har egen lagring. Matracets ikon har `scope: /matracet/`
och täcker därför Livet, så samma token gäller. Lägets ikon har `scope: /matracet/laget/` – att öppna
Livet därifrån måste testas på riktig telefon. Kräver det ny token löser vi det på annat sätt, inte
genom att be hushållet koppla in igen.

## Vad flyttar

| Från | Till Livet |
|---|---|
| Matracet: Familj-skärmen | Familjen |
| Matracet: Hantera appen (token, synk, export) | Koppling |
| Läget: menyns schema, aktiviteter, perioder, notistider, koppling | respektive sektion |

Kvar i Lägets meny: Utseende, Natthimlen och en länk "Livet ›". Kvar i Matracet: allt om mat.

## Ordning

1. Livet-sidan med tre sköldar; Livet-skölden leder till en sida med länkar till de befintliga
   inställningsskärmarna (ingen flytt av logik ännu).
2. Flytta skärmarna en i taget enligt tabellen; Matracets och Lägets menyer länkar dit.
3. Matracet: förenkla startsidan till Veckan, Handla, Recept (+ Mer).
4. Matracet: måltidsbibliotek – måltider med recept, där nya (gärna korta) recept tillkommer från
   det vi äter och från förslag – aldrig handklassning. Grundsorteringen är gjord (2026-11).
5. Matracet: veckoförslag (behåll/byt/ta bort) som startpunkt, rabatter synliga i förslagen,
   "köp nu"-kort från listan över det vi brukar köpa.
