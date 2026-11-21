// Livet is the base page (/matracet/livet/) that Läget and Matracet branch off from, see
// docs/livet-plan.md. Livet's settings links open a screen in one of the apps with
// ?vy=<screen>&fran=livet; "fran=livet" makes that screen's back button return to Livet
// instead of the app's own start page. Read once at module load, before the apps strip the
// query string from the address bar.

export const LIVET_URL = `${import.meta.env.BASE_URL}livet/`

function readFromLivet(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('fran') === 'livet'
}

/** True when this page load was opened from a Livet link. */
export const OPENED_FROM_LIVET = readFromLivet()

export function goToLivet(): void {
  window.location.assign(LIVET_URL)
}

/** Remove the deep-link params (vy, fran) from the address bar without reloading. */
export function stripDeepLinkParams(): void {
  const params = new URLSearchParams(window.location.search)
  if (!params.has('vy') && !params.has('fran')) return
  params.delete('vy')
  params.delete('fran')
  const qs = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
}
