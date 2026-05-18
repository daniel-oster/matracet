import { useState, useEffect } from 'react'
import { WeekMenu, EatersData } from './types'
import Binder from './components/Binder'

const CURRENT_WEEK = '2026-W21'

export default function App() {
  const [week, setWeek] = useState<WeekMenu | null>(null)
  const [eaters, setEaters] = useState<EatersData | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/matracet/data/weeks/${CURRENT_WEEK}.json`).then(r => r.json()),
      fetch('/matracet/data/eaters.json').then(r => r.json()),
    ]).then(([weekData, eatersData]) => {
      setWeek(weekData)
      setEaters(eatersData)
    })
  }, [])

  if (!week || !eaters) {
    return (
      <div style={{ color: '#e0d4b8', fontFamily: 'Inter Tight, sans-serif', textAlign: 'center', paddingTop: '80px' }}>
        Laddar…
      </div>
    )
  }

  return <Binder week={week} eaters={eaters.eaters} />
}
