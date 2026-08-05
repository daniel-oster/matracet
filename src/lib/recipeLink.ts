// Deep links to a single recipe.
//
// There's no router in this app (navigation is a `screen` state in App.tsx), so a shareable
// "open this recipe" link needs to work without one. It's a real path on the app's own base URL:
//
//   https://daniel-oster.github.io/matracet/recept/ugnsbakad-lax/
//
// A hash was used originally, but a hash never reaches the server — a crawler building a link
// preview (iMessage, Slack, ...) fetches /matracet/ and sees the same page for every recipe, so
// there's no way to serve a recipe-specific <title>/OpenGraph card. The build now generates a
// real file per recipe (`scripts/build-recipe-pages.mjs` → `dist/recept/<slug>/index.html`), so
// GitHub Pages serves it directly with no SPA rewrite needed — the trailing slash matters here,
// otherwise GitHub Pages 301s `/recept/<slug>` → `/recept/<slug>/` as an extra round trip.
// Old `#recept/<slug>` links (shared before this changed) still work — parseRecipeHash/recipeHash
// stay in place, and App.tsx checks the path first, hash second.
//
// The URL is deliberately rebuilt from origin + base rather than mutating the *current*
// location, so a copied link never carries along whatever transient query string happens to
// be there (notably Hub's `?_r=<timestamp>` cache-buster).

const PREFIX = 'recept/'

/** The path a given open recipe (or none) should appear at, relative to the app base. */
export function recipePath(slug: string | null, base: string): string {
  const cleanBase = base.endsWith('/') ? base : `${base}/`
  return slug === null ? cleanBase : `${cleanBase}${PREFIX}${encodeURIComponent(slug)}/`
}

/** Absolute, shareable URL for a recipe. `base` is Vite's BASE_URL, e.g. `/matracet/`. */
export function buildRecipeUrl(slug: string, origin: string, base: string): string {
  return `${origin}${recipePath(slug, base)}`
}

/** The recipe slug a URL pathname points at, or null if it isn't a recipe path. */
export function parseRecipePath(pathname: string, base: string): string | null {
  const cleanBase = base.endsWith('/') ? base : `${base}/`
  if (!pathname.startsWith(cleanBase)) return null
  const rest = pathname.slice(cleanBase.length)
  if (!rest.startsWith(PREFIX)) return null
  const slug = decodeURIComponent(rest.slice(PREFIX.length).replace(/\/$/, '')).trim()
  return slug === '' ? null : slug
}

/** The recipe slug a location hash points at, or null if it isn't a recipe link. */
export function parseRecipeHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw.startsWith(PREFIX)) return null
  const slug = decodeURIComponent(raw.slice(PREFIX.length)).trim()
  return slug === '' ? null : slug
}

/** The hash a given open recipe (or none) should produce. Kept for old shared links only. */
export function recipeHash(slug: string | null): string {
  return slug === null ? '' : `#${PREFIX}${encodeURIComponent(slug)}`
}

/** Convenience wrapper around buildRecipeUrl for browser call sites. */
export function currentRecipeUrl(slug: string): string {
  return buildRecipeUrl(slug, window.location.origin, import.meta.env.BASE_URL)
}
