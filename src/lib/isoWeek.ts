/** ISO-8601 week string (`YYYY-Www`) for an ISO date — the key `public/data/weeks/*.json`
 * and `public/data/erbjudanden/<butik>/*.json` are both named by. Lived as a private copy
 * inside App.tsx until offerValidity.ts needed the same computation; one implementation,
 * imported by both. */
export function getISOWeekString(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}
