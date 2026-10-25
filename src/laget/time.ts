// Clock helpers. The notification job runs in UTC on GitHub's runners but the household lives
// in Europe/Stockholm, so "what day is it / what time is it" is always asked here, never of
// the runner's own timezone.

export const TIME_ZONE = 'Europe/Stockholm'

const fmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** The wall-clock date (YYYY-MM-DD) and time (HH:MM) in Stockholm at an instant. */
export function stockholmNow(now: Date): { date: string; time: string } {
  const parts: Record<string, string> = {}
  for (const p of fmt.formatToParts(now)) parts[p.type] = p.value
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}
