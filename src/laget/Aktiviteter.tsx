import type { Activity, PresenceStore } from '../presence/types'

const DAYS = ['', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

/** An activity's timing in one line: "Mån 18:00 (kom 17:45, åk 17:30)". */
export function activityTimes(a: Activity): string {
  const extra = [a.arriveBy ? `kom ${a.arriveBy}` : null, a.leaveBy ? `åk ${a.leaveBy}` : null].filter(Boolean).join(', ')
  return `${DAYS[a.weekday]} ${a.startTime ?? 'dagtid'}${a.endTime ? `–${a.endTime}` : ''}${extra ? ` (${extra})` : ''}`
}

export default function Aktiviteter({ schema, today }: { schema: PresenceStore; today: string }) {
  const names = new Map(schema.persons.map(p => [p.id, p.name]))
  const live = (schema.activities ?? []).filter(a => a.validUntil === null || a.validUntil >= today)
  const byPerson = new Map<string, Activity[]>()
  for (const a of live) byPerson.set(a.personId, [...(byPerson.get(a.personId) ?? []), a])
  return (
    <>
      <h2 className="laget-h">Aktiviteter</h2>
      <p className="laget-sub">Återkommande aktiviteter som gäller nu eller längre fram.</p>
      {byPerson.size === 0 && <p className="laget-muted">Inga aktiviteter.</p>}
      {[...byPerson.entries()].map(([personId, acts]) => (
        <section key={personId} className="laget-card">
          <h3>{names.get(personId) ?? personId}</h3>
          <ul className="laget-list">
            {acts
              .sort((a, b) => a.weekday - b.weekday || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
              .map(a => (
                <li key={a.id}>
                  <strong>{a.label}</strong>
                  <span className="laget-tl-sub">{activityTimes(a)}</span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  )
}
