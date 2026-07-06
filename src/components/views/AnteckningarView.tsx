import { WeekNote } from '../../types'
import TopBar from '../TopBar'

const NOTES_CURRENT: WeekNote[] = [
  { nar: 'Den här veckan', text: 'Mormor & morfar kommer på lördag — fixa något lite festligt!' },
  { nar: 'Vecka 22',       text: 'Sarah åker på lägret onsdag–söndag. Mindre vegoplanering.' },
  { nar: 'Idé',            text: 'Indisk linsgryta med kokosmjölk!' },
]

const NOTES_LONGTERM: WeekNote[] = [
  { nar: 'Säsong nu',     text: 'Sparris & nya potatisar börjar komma!' },
  { nar: 'Långsiktigt',   text: 'Få in mer fiber — minst 2 baljväxtmiddagar/v.' },
  { nar: 'Att prova',     text: 'Bygga ut frukostmodulen — vi tjatar varje morgon.' },
  { nar: 'Inköp-idé',     text: 'Kolla Matspar — kan vi spara på att dela över flera butiker?' },
]

interface Props {
  onBack: () => void
  weekNotes?: WeekNote[]
}

export default function AnteckningarView({ onBack, weekNotes }: Props) {
  const current = weekNotes && weekNotes.length > 0 ? weekNotes : NOTES_CURRENT

  return (
    <div className="screen">
      <TopBar onBack={onBack} eyebrow="aktuellt & långsiktigt" title="Anteckningar" />
      <div className="screen-body note-grid">
        <div className="note-col">
          <h3 className="shop-group-title">Aktuellt</h3>
          {current.map((note, i) => (
            <div className="note" key={i}>
              <div className="note-when">{note.nar}</div>
              <div className="note-body">{note.text}</div>
            </div>
          ))}
        </div>
        <div className="note-col">
          <h3 className="shop-group-title">Tankar &amp; idéer</h3>
          {NOTES_LONGTERM.map((note, i) => (
            <div className="note" key={i}>
              <div className="note-when">{note.nar}</div>
              <div className="note-body">{note.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
