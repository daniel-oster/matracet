/** Reload the app with a `?_r=<timestamp>` cache-buster, which pulls a fresh index.html (and
 * with it the latest content-hashed bundle) and makes every data fetch bypass the HTTP cache
 * (see dataFetch.ts). Never touches localStorage. */
export function hardRefresh(): void {
  const url = new URL(window.location.href)
  url.searchParams.set('_r', Date.now().toString())
  window.location.href = url.toString()
}
