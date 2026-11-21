export interface DistEntry { id: string; tidMin: number | null }
export interface DistSlot { date: string; kind: 'lunch' | 'dinner'; fast: boolean }

const FAST_MAX = 25
const isFast = (e: DistEntry) => e.tidMin !== null && e.tidMin <= FAST_MAX
const speed = (e: DistEntry) => (e.tidMin === null ? Infinity : e.tidMin)

/**
 * Spreads unslotted dishes over open slots: dinners before lunches, chronological. A fast slot
 * takes the fastest remaining dish (quick ones are saved for fast slots); other slots take
 * the slowest remaining in given order so quick dishes stay available. Never reuses an entry.
 */
export function distributeToSlots(entries: DistEntry[], slots: DistSlot[]): { entryId: string; date: string; kind: 'lunch' | 'dinner' }[] {
  const ordered = [...slots].sort((a, b) =>
    (a.kind === b.kind ? 0 : a.kind === 'dinner' ? -1 : 1) || a.date.localeCompare(b.date))
  const rest = [...entries]
  const out: { entryId: string; date: string; kind: 'lunch' | 'dinner' }[] = []
  for (const s of ordered) {
    if (rest.length === 0) break
    let pick = 0
    if (s.fast) {
      for (let i = 1; i < rest.length; i++) if (speed(rest[i]) < speed(rest[pick])) pick = i
    } else {
      const slow = rest.findIndex(e => !isFast(e))
      pick = slow >= 0 ? slow : 0
    }
    const [e] = rest.splice(pick, 1)
    out.push({ entryId: e.id, date: s.date, kind: s.kind })
  }
  return out
}
