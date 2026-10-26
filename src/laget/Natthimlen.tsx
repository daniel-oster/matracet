import { useState } from 'react'
import SkyCanvas, { SKY_PRESETS } from './sky/SkyCanvas'
import { HERMANUS, lstDeg } from './sky/astro'

const SPEEDS = [
  { id: 1, label: 'Nu' },
  { id: 300, label: 'Spola ×300' },
  { id: 3000, label: 'Spola ×3000' },
] as const

const clock = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })

/** Menu → Natthimlen: the sky over Hermanus, South Africa, as it is right now (or fast-forwarded). */
export default function Natthimlen() {
  const [speed, setSpeed] = useState<number>(1)
  const [look, setLook] = useState<keyof typeof SKY_PRESETS>('pol')
  const [ms, setMs] = useState(() => Date.now())
  return (
    <>
      <h2 className="laget-h">Natthimlen</h2>
      <p className="laget-sub">{HERMANUS.name}, Sydafrika · {HERMANUS.lat.toFixed(1).replace('-', '')}° S · det är {clock.format(ms)} där</p>
      <div className="laget-sky">
        <SkyCanvas speed={speed} preset={SKY_PRESETS[look]} labels onTime={setMs} className="laget-sky-canvas" />
      </div>
      <div className="laget-sky-controls" role="group" aria-label="Tid">
        {SPEEDS.map(s => (
          <button key={s.id} className={`laget-chip${speed === s.id ? ' laget-chip--on' : ''}`} onClick={() => setSpeed(s.id)}>{s.label}</button>
        ))}
      </div>
      <div className="laget-sky-controls" role="group" aria-label="Riktning">
        {(Object.keys(SKY_PRESETS) as (keyof typeof SKY_PRESETS)[]).map(k => (
          <button key={k} className={`laget-chip${look === k ? ' laget-chip--on' : ''}`} onClick={() => setLook(k)}>{SKY_PRESETS[k].label}</button>
        ))}
      </div>
      <p className="laget-sub">
        Från Hermanus står sydpolen {(-HERMANUS.lat).toFixed(0)}° över horisonten och stjärnorna cirklar medsols runt den (riktiga varv tar ett dygn).
        Stjärnor och stjärnbilder ligger där katalogen säger att de gör just nu (stjärntid {lstDeg(ms, HERMANUS.lon).toFixed(0)}°).
        Vintergatan är bara en känsla, men bandet går där den verkligen går.
      </p>
    </>
  )
}
