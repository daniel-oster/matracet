# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Matracet is a personal meal-planning web app for one Swedish family. It is intentionally minimal: no backend, no auth, no state manager, no router, no tests. All data lives as JSON files in Git. The app is a static React build hosted on GitHub Pages at `/matracet/`.

## Commands

```bash
npm install      # install dependencies
npm run dev      # start dev server (Vite)
npm run build    # tsc + vite build → dist/
npm run preview  # serve the production build locally
```

There is no lint or test script configured.

## Architecture

### Two entry points

Vite is configured with two HTML entry points (`vite.config.ts`):
- `index.html` → main app (`src/main.tsx`)
- `sysdoc.html` → system documentation (`src/sysdoc.tsx`, at `/matracet/sysdoc/`)

### Component hierarchy

```
App           – fetches initial data (week, eaters, recipe index)
└── Binder    – manages active tab and portrait-mode side flip
    ├── Page (left)  – renders the left half of the spread
    ├── rings        – decorative binder rings
    ├── Page (right) – renders the right half of the spread
    └── Tabs         – navigation tabs along the right edge
```

Each `Page` renders one view based on `activeTab`. Every view component receives `side: PageSide` (`'left' | 'right'`) and is responsible for splitting its own content between the two sides. For example, `VeckanView` shows Mon–Wed on the left and Thu–Sun on the right.

### Tabs and views

| Tab (`TabName`) | Left page | Right page |
|---|---|---|
| `veckan` | Mon–Wed meals | Thu–Sun meals |
| `handla` | Shopping groups A | Shopping groups B |
| `recept` | Recipe list (scrollable) | Recipe detail (loaded on demand) |
| `familj` | First 2 eater profiles | Remaining eaters + weekly routine |
| `anteckningar` | Current notes | Long-term ideas |

### Data loading

`App.tsx` fetches three resources on mount using `Promise.all`:
- `/matracet/data/weeks/<CURRENT_WEEK>.json`
- `/matracet/data/eaters.json`
- `/matracet/data/recipes/_index.json`

The active week is hardcoded at the top of `App.tsx` as `const CURRENT_WEEK = '2026-W21'`. **Update this string when adding a new week.**

`ReceptView` fetches individual recipes lazily: `/matracet/data/recipes/<slug>/recept.json` when the user selects a recipe.

### URL base path

All fetch URLs and internal links must use the `/matracet/` prefix (Vite `base` is `/matracet/`). This is already set in `vite.config.ts`.

### Styling

A single vanilla CSS file `src/styles/filofax.css` covers the entire app. There is no Tailwind. Design tokens live in `:root` CSS variables at the top of the file:
- `--leather-*`: binder cover colours
- `--paper`, `--paper-edge`, `--line`, `--line-margin`: page colours and ruled lines
- `--t-veckan`, `--t-handla`, etc.: tab accent colours
- `--ink`, `--ink-soft`, `--ink-blue`, `--ink-red`: text colours

Typography is Google Fonts loaded in `index.html`:
- **Fraunces** (serif) — page titles, day numbers
- **Caveat** (cursive) — meal names, prominent handwritten text
- **Patrick Hand** (cursive) — ingredients, notes, body copy
- **Inter Tight** (sans-serif) — labels, UI chrome
- **JetBrains Mono** (monospace) — dates, codes, metadata

Portrait/mobile layout is handled entirely via `@media (orientation: portrait), (max-width: 700px)` — one page at a time with flip buttons.

## Data conventions

### Recipe files

Each recipe lives at `public/data/recipes/<slug>/recept.json`. The slug is the directory name — lowercase, hyphens, Swedish vowels transliterated (ö→o, ä→a, å→a).

Required JSON fields: `schema_version`, `slug`, `nummer`, `namn`, `tid_min`, `portioner`, `kategorier`, `ingredienser`, `instruktioner`, `komplett`.

Ingredients use Swedish field names: `vara` (item), `mangd` (amount), `enhet` (unit), optional `grupp` (ingredient subgroup).

Category values: `vegansk`, `vegetarisk`, `fisk`, `kott`, `glutenfri`, `laktosfri`.

`dagkedja` links a recipe to a "day chain" (e.g. use Monday's leftovers on Tuesday). Set to `null` if not applicable.

### Recipe index

`public/data/recipes/_index.json` is a manually maintained list of all recipes with lightweight fields only (slug, nummer, namn, tid_min, kategorier, bildUrl). **When adding a new recipe, add an entry here too.**

### Week menus

`public/data/weeks/YYYY-Www.json` — one file per week. The `recept` field in each day entry contains the **display name** of the meal (free text), not the recipe slug. Set `recept: null` and use `anteckning` for nights out.

### Currently hardcoded data

`HandlaView` and `AnteckningarView` have their content hardcoded as constants inside the component. These are MVP placeholders — they are not yet driven by JSON files.

## Deploy

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`) which runs `npm ci && npm run build` and deploys `dist/` to GitHub Pages. No manual steps needed.
