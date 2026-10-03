// Fetch for the app's static data files under /matracet/data/.
//
// GitHub Pages serves them with `cache-control: max-age=600`, so a phone can
// keep showing a stale recipe list for up to 10 minutes after a deploy. Hub's
// ⟳ button reloads the page with a `?_r=<timestamp>` param; when that param is
// present, every data fetch for this page load uses `cache: 'reload'` — it
// skips the HTTP cache *and* overwrites it, so later normal loads get the fresh
// copy too. Captured once at module load, since App later rewrites the URL.
const FORCE_RELOAD =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('_r')

export function fetchData(url: string): Promise<Response> {
  return FORCE_RELOAD ? fetch(url, { cache: 'reload' }) : fetch(url)
}
