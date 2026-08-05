// Deep links to a single recipe.
//
// There's no router in this app (navigation is a `screen` state in App.tsx), so a shareable
// "open this recipe" link is expressed as a hash on the app's own base URL:
//
//   https://daniel-oster.github.io/matracet/#recept/ugnsbakad-lax
//
// A hash was chosen over a real path because GitHub Pages serves this as a static build with
// no SPA rewrite — any path other than /matracet/ would 404 before the app ever loads.
//
// The URL is deliberately rebuilt from origin + base rather than mutating the *current*
// location, so a copied link never carries along whatever transient query string happens to
// be there (notably Hub's `?_r=<timestamp>` cache-buster).

const PREFIX = 'recept/'

/** Absolute, shareable URL for a recipe. `base` is Vite's BASE_URL, e.g. `/matracet/`. */
export function buildRecipeUrl(slug: string, origin: string, base: string): string {
  const cleanBase = base.endsWith('/') ? base : `${base}/`
  return `${origin}${cleanBase}#${PREFIX}${encodeURIComponent(slug)}`
}

/** The recipe slug a location hash points at, or null if it isn't a recipe link. */
export function parseRecipeHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw.startsWith(PREFIX)) return null
  const slug = decodeURIComponent(raw.slice(PREFIX.length)).trim()
  return slug === '' ? null : slug
}

/** The hash a given open recipe (or none) should produce. */
export function recipeHash(slug: string | null): string {
  return slug === null ? '' : `#${PREFIX}${encodeURIComponent(slug)}`
}

/** Convenience wrapper around buildRecipeUrl for browser call sites. */
export function currentRecipeUrl(slug: string): string {
  return buildRecipeUrl(slug, window.location.origin, import.meta.env.BASE_URL)
}
