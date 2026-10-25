import { useEffect, useMemo, useState } from 'react'
import { addDays } from '../presence/resolver'
import { buildDay, buildWeek } from './buildDay'
import { stockholmNow } from './time'
import { Idag, Imorgon, Shield } from './Dagen'
import Aktiviteter from './Aktiviteter'
import KopplingView from './KopplingView'
import { Meny, Notiser, Perioder, Schema, Vecka } from './Vecka'
import { useLagetData } from './useLagetData'

type View = 'hem' | 'idag' | 'imorgon' | 'vecka' | 'meny' | 'schema' | 'aktiviteter' | 'perioder' | 'notiser' | 'koppling'

/** Where "back" goes from each screen. */
const PARENT: Record<View, View | null> = {
  hem: null, idag: 'hem', imorgon: 'hem', vecka: 'hem', meny: 'hem',
  schema: 'meny', aktiviteter: 'meny', perioder: 'meny', notiser: 'meny', koppling: 'meny',
}

/** A notification opens /matracet/laget/?vy=idag|imorgon (see the notification job). */
function initialView(): View {
  const vy = new URLSearchParams(window.location.search).get('vy')
  return vy === 'idag' || vy === 'imorgon' ? vy : 'hem'
}

/** Wall-clock "now" in Stockholm, refreshed every 30 s and when the app is resumed. */
function useNow() {
  const [now, setNow] = useState(() => stockholmNow(new Date()))
  useEffect(() => {
    const tick = () => setNow(stockholmNow(new Date()))
    const id = window.setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return now
}

export default function LagetApp() {
  const [view, setView] = useState<View>(initialView)
  const [openDate, setOpenDate] = useState<string | null>(null) // a day picked from Veckan; null = today
  const [tickError, setTickError] = useState<string | null>(null)
  const { data, settings, status, stale, setPrepDone, setTodoDone, saveNotisTimes, changeSchema, reload } = useLagetData()
  const now = useNow()

  // Drop ?vy= once read so a later reload doesn't jump back to it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('vy')) return
    params.delete('vy')
    const qs = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
  }, [])

  const shownDate = openDate ?? now.date
  const today = useMemo(() => (data ? buildDay(now.date, data) : null), [data, now.date])
  const tomorrow = useMemo(() => (data ? buildDay(addDays(now.date, 1), data) : null), [data, now.date])
  const shown = useMemo(() => (data ? (shownDate === now.date ? today : buildDay(shownDate, data)) : null), [data, shownDate, now.date, today])
  const shownNext = useMemo(() => (data ? buildDay(addDays(shownDate, 1), data) : null), [data, shownDate])
  const week = useMemo(() => (data && (view === 'vecka') ? buildWeek(now.date, data, 7) : []), [data, view, now.date])
  const fortnight = useMemo(() => (data && view === 'schema' ? buildWeek(now.date, data, 14) : []), [data, view, now.date])

  const go = (next: View) => {
    setTickError(null)
    if (next !== 'idag') setOpenDate(null)
    setView(next)
  }
  const openDay = (date: string) => {
    setOpenDate(date === now.date ? null : date)
    setView('idag')
  }
  const back = () => {
    // A day opened from Veckan goes back to Veckan.
    if (view === 'idag' && openDate) return go('vecka')
    go(PARENT[view] ?? 'hem')
  }

  const names = new Map((data?.schema.persons ?? []).map(p => [p.id, p.name]))
  const tick = async (key: string, on: boolean) => setTickError(await setPrepDone(key, on))
  const tickTodo = async (id: string) => setTickError(await setTodoDone(id))
  const needsData = view !== 'koppling' && view !== 'meny' && view !== 'notiser'

  return (
    <div className="laget">
      <header className="laget-head">
        <div>
          {view === 'hem' ? (
            <>
              <div className="laget-eyebrow">Life – as it should be</div>
              <h1 className="laget-title">Läget</h1>
            </>
          ) : (
            <button className="laget-back" onClick={back}>‹ {view === 'idag' && openDate ? 'Veckan' : PARENT[view] === 'meny' ? 'Meny' : 'Läget'}</button>
          )}
        </div>
        {view !== 'meny' && !PARENT[view]?.startsWith('meny') && (
          <button className="laget-gear" onClick={() => go('meny')} aria-label="Meny">☰</button>
        )}
      </header>

      {view === 'meny' ? (
        <Meny onGo={go} />
      ) : view === 'koppling' ? (
        <KopplingView onChanged={reload} />
      ) : view === 'notiser' ? (
        <Notiser settings={settings} onSave={saveNotisTimes} onOpenKoppling={() => go('koppling')} />
      ) : needsData && (!today || !tomorrow || !shown || !shownNext || !data) ? (
        <section className="laget-card">
          <h3>{status === 'loading' ? 'Hämtar läget…' : 'Läget är inte kopplat'}</h3>
          {status !== 'loading' && (
            <>
              <p>Utan token går det inte att läsa schemat.</p>
              <button onClick={() => go('koppling')}>Koppla</button>
            </>
          )}
        </section>
      ) : data && today && tomorrow && shown && shownNext ? (
        <>
          {stale && <p className="laget-stale">Visar sparad data – kunde inte nå GitHub.</p>}
          {view === 'hem' && (
            <>
              <Shield view={today} nowTime={now.time} onOpen={() => go('idag')} />
              <div className="laget-tiles">
                <button className="laget-tile" onClick={() => go('imorgon')}>
                  <span className="laget-tile-title">Imorgon</span>
                  <span className="laget-tile-sub">{today.tomorrowTeaser ?? 'inget att förbereda'}</span>
                </button>
                <button className="laget-tile" onClick={() => go('vecka')}>
                  <span className="laget-tile-title">Veckan</span>
                  <span className="laget-tile-sub">sju rader</span>
                </button>
              </div>
            </>
          )}
          {view === 'idag' && <Idag view={shown} tomorrow={shownNext} onTomorrow={() => (shownDate === now.date ? go('imorgon') : openDay(addDays(shownDate, 1)))} onTickTodo={tickTodo} error={tickError} />}
          {view === 'imorgon' && <Imorgon today={today} tomorrow={tomorrow} onTick={tick} error={tickError} />}
          {view === 'vecka' && <Vecka days={week} onOpenDay={openDay} />}
          {view === 'schema' && <Schema days={fortnight} />}
          {view === 'aktiviteter' && <Aktiviteter schema={data.schema} today={now.date} onChange={changeSchema} />}
          {view === 'perioder' && <Perioder periods={data.periods} names={names} />}
        </>
      ) : null}
    </div>
  )
}
