import { useState } from 'react'
import type { Activity, PresenceStore, Weekday } from '../presence/types'
import { addDays } from '../presence/resolver'
import { draftFromActivity, emptyDraft, endActivity, saveActivity, type ActivityDraft, type SaveResult } from './activityForm'

const DAYS = ['', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

/** An activity's timing in one line: "Mån 18:00 (kom 17:45, åk 17:30)". */
export function activityTimes(a: Activity): string {
  const extra = [a.arriveBy ? `kom ${a.arriveBy}` : null, a.leaveBy ? `åk ${a.leaveBy}` : null].filter(Boolean).join(', ')
  return `${DAYS[a.weekday]} ${a.startTime ?? 'dagtid'}${a.endTime ? `–${a.endTime}` : ''}${extra ? ` (${extra})` : ''}`
}

type Apply = (s: PresenceStore) => SaveResult

interface Props {
  schema: PresenceStore
  today: string
  /** Applies a change to data/schema.json; resolves to an error text or null. */
  onChange: (apply: Apply) => Promise<string | null>
}

export default function Aktiviteter({ schema, today, onChange }: Props) {
  const [draft, setDraft] = useState<ActivityDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const names = new Map(schema.persons.map(p => [p.id, p.name]))
  const live = (schema.activities ?? []).filter(a => a.validUntil === null || a.validUntil >= today)
  const byPerson = new Map<string, Activity[]>()
  for (const a of live) byPerson.set(a.personId, [...(byPerson.get(a.personId) ?? []), a])

  const run = async (apply: Apply, after?: () => void) => {
    setBusy(true)
    setError(null)
    const err = await onChange(apply)
    setBusy(false)
    if (err) setError(err)
    else after?.()
  }

  if (draft) {
    const set = <K extends keyof ActivityDraft>(k: K, v: ActivityDraft[K]) => setDraft({ ...draft, [k]: v })
    const editing = draft.id !== null
    const previous = editing ? (schema.activities ?? []).find(a => a.id === draft.id) : undefined
    const running = previous !== undefined && previous.validFrom <= today
    return (
      <>
        <h2 className="laget-h">{editing ? 'Ändra aktivitet' : 'Ny aktivitet'}</h2>
        <section className="laget-card">
          <label className="laget-field"><span>Vem</span>
            <select value={draft.personId} onChange={e => set('personId', e.target.value)} disabled={editing}>
              {schema.persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="laget-field"><span>Namn</span>
            <input type="text" value={draft.label} onChange={e => set('label', e.target.value)} />
          </label>
          <label className="laget-field"><span>Veckodag</span>
            <select value={draft.weekday} onChange={e => set('weekday', Number(e.target.value) as Weekday)}>
              {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{DAYS[d]}</option>)}
            </select>
          </label>
          <label className="laget-field"><span>Börjar</span><input type="time" value={draft.startTime} onChange={e => set('startTime', e.target.value)} /></label>
          <label className="laget-field"><span>Vara på plats</span><input type="time" value={draft.arriveBy} onChange={e => set('arriveBy', e.target.value)} /></label>
          <label className="laget-field"><span>Åka hemifrån</span><input type="time" value={draft.leaveBy} onChange={e => set('leaveBy', e.target.value)} /></label>
          <label className="laget-field"><span>Slutar</span><input type="time" value={draft.endTime} onChange={e => set('endTime', e.target.value)} /></label>
          <label className="laget-check"><input type="checkbox" checked={draft.affectsWindow} onChange={e => set('affectsWindow', e.target.checked)} /><span>Styr middagsfönstret<span className="laget-tl-sub">Av för dagtid och sådant som inte påverkar maten</span></span></label>
          <label className="laget-check"><input type="checkbox" checked={draft.pausedOnBreak} onChange={e => set('pausedOnBreak', e.target.checked)} /><span>Ställs in under lov</span></label>
          <label className="laget-field"><span>Gäller från</span><input type="date" value={draft.validFrom} onChange={e => set('validFrom', e.target.value)} /></label>
          <label className="laget-field"><span>Gäller till</span><input type="date" value={draft.validUntil} onChange={e => set('validUntil', e.target.value)} /></label>
          <label className="laget-field laget-field--stack"><span>Förbered dagen före (en per rad)</span>
            <textarea rows={3} value={draft.prepareLines} onChange={e => set('prepareLines', e.target.value)} />
          </label>
          {running && <p className="laget-sub">Ändringen gäller från idag. Tidigare dagar påverkas inte.</p>}
          {error && <p className="laget-status laget-status--unauthorized">{error}</p>}
          <div className="laget-row">
            <button disabled={busy} onClick={() => void run(s => saveActivity(s, draft, today), () => setDraft(null))}>Spara</button>
            <button disabled={busy} className="laget-secondary" onClick={() => { setDraft(null); setError(null) }}>Avbryt</button>
          </div>
        </section>
      </>
    )
  }

  const firstPerson = schema.persons[0]?.id ?? ''
  return (
    <>
      <h2 className="laget-h">Aktiviteter</h2>
      <p className="laget-sub">Återkommande aktiviteter som gäller nu eller längre fram.</p>
      <button onClick={() => setDraft(emptyDraft(firstPerson, today))}>+ Ny aktivitet</button>
      {error && <p className="laget-status laget-status--unauthorized">{error}</p>}
      {byPerson.size === 0 && <p className="laget-muted">Inga aktiviteter.</p>}
      {[...byPerson.entries()].map(([personId, acts]) => (
        <section key={personId} className="laget-card">
          <h3>{names.get(personId) ?? personId}</h3>
          <ul className="laget-list">
            {acts
              .sort((a, b) => a.weekday - b.weekday || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
              .map(a => (
                <li key={a.id} className="laget-act">
                  <span>
                    <strong>{a.label}</strong>
                    <span className="laget-tl-sub">
                      {activityTimes(a)}
                      {a.validFrom > today ? ` · från ${a.validFrom}` : ''}{a.validUntil ? ` · till ${a.validUntil}` : ''}
                    </span>
                  </span>
                  <span className="laget-act-buttons">
                    <button className="laget-secondary" onClick={() => setDraft(draftFromActivity(a))}>Ändra</button>
                    <button
                      className="laget-secondary"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Avsluta "${a.label}" från och med idag? Tidigare dagar påverkas inte.`)) void run(s => endActivity(s, a.id, addDays(today, -1)))
                      }}
                    >
                      Avsluta
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  )
}
