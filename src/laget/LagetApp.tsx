import { useEffect, useMemo, useState } from 'react'
import { addDays } from '../presence/resolver'
import { buildDay } from './buildDay'
import { stockholmNow } from './time'
import { Idag, Imorgon, Shield } from './Dagen'
import KopplingView from './KopplingView'
import { useLagetData } from './useLagetData'

type View = 'hem' | 'idag' | 'imorgon' | 'koppling'

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
  const [tickError, setTickError] = useState<string | null>(null)
  const { data, status, stale, setPrepDone, setTodoDone, reload } = useLagetData()
  const now = useNow()

  // Drop ?vy= once read so a later reload doesn't jump back to it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('vy')) return
    params.delete('vy')
    const qs = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
  }, [])

  const today = useMemo(() => (data ? buildDay(now.date, data) : null), [data, now.date])
  const tomorrow = useMemo(() => (data ? buildDay(addDays(now.date, 1), data) : null), [data, now.date])

  const tick = async (key: string, on: boolean) => setTickError(await setPrepDone(key, on))
  const tickTodo = async (id: string) => setTickError(await setTodoDone(id))

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
            <button className="laget-back" onClick={() => setView('hem')}>‹ Läget</button>
          )}
        </div>
        {view !== 'koppling' && (
          <button className="laget-gear" onClick={() => setView('koppling')} aria-label="Koppling och notiser">⚙︎</button>
        )}
      </header>

      {view === 'koppling' ? (
        <KopplingView onChanged={reload} />
      ) : !today || !tomorrow ? (
        <section className="laget-card">
          <h3>{status === 'loading' ? 'Hämtar läget…' : 'Läget är inte kopplat'}</h3>
          {status !== 'loading' && (
            <>
              <p>Utan token går det inte att läsa schemat.</p>
              <button onClick={() => setView('koppling')}>Koppla</button>
            </>
          )}
        </section>
      ) : (
        <>
          {stale && <p className="laget-stale">Visar sparad data – kunde inte nå GitHub.</p>}
          {view === 'hem' && (
            <>
              <Shield view={today} nowTime={now.time} onOpen={() => setView('idag')} />
              <button className="laget-tile" onClick={() => setView('imorgon')}>
                <span className="laget-tile-title">Imorgon</span>
                <span className="laget-tile-sub">{today.tomorrowTeaser ?? 'inget att förbereda'}</span>
              </button>
            </>
          )}
          {view === 'idag' && <Idag view={today} tomorrow={tomorrow} onTomorrow={() => setView('imorgon')} onTickTodo={tickTodo} error={tickError} />}
          {view === 'imorgon' && <Imorgon today={today} tomorrow={tomorrow} onTick={tick} error={tickError} />}
        </>
      )}
    </div>
  )
}
