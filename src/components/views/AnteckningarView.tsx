import { PageSide, WeekNote } from '../../types'

const NOTES_LEFT: WeekNote[] = [
  { nar: 'Den här veckan', text: 'Mormor & morfar kommer på lördag — fixa något lite festligt!' },
  { nar: 'Vecka 22',       text: 'Sarah åker på lägret onsdag–söndag. Mindre vegoplanering.' },
  { nar: 'Idé',            text: 'Indisk linsgryta med kokosmjölk!' },
]

const NOTES_RIGHT: WeekNote[] = [
  { nar: 'Säsong nu',     text: 'Sparris & nya potatisar börjar komma!' },
  { nar: 'Långsiktigt',   text: 'Få in mer fiber — minst 2 baljväxtmiddagar/v.' },
  { nar: 'Att prova',     text: 'Bygga ut frukostmodulen — vi tjatar varje morgon.' },
  { nar: 'Inköp-idé',     text: 'Kolla Matspar — kan vi spara på att dela över flera butiker?' },
]

interface Props {
  side: PageSide
  weekNotes?: WeekNote[]
}

export default function AnteckningarView({ side, weekNotes }: Props) {
  const notes = weekNotes ?? (side === 'left' ? NOTES_LEFT : NOTES_RIGHT)

  return (
    <>
      <div className="page-head">
        <div className="title">{side === 'left' ? 'Anteckningar' : 'Tankar & idéer'}</div>
        <div className="sub">{side === 'left' ? 'aktuellt' : 'långsiktigt'}</div>
      </div>

      {notes.map((note, i) => (
        <div className="note" key={i}>
          <div className="note-when">{note.nar}</div>
          <div className="note-body">{note.text}</div>
        </div>
      ))}
    </>
  )
}
