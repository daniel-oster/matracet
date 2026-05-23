import { PageSide, Eater } from '../../types'

interface Props {
  side: PageSide
  eaters: Eater[]
}

export default function FamiljView({ side, eaters }: Props) {
  const visibleEaters = side === 'left' ? eaters.slice(0, 2) : eaters.slice(2)

  return (
    <>
      <div className="page-head">
        <div className="title">{side === 'left' ? 'Familjen' : 'Familjen (forts.)'}</div>
        <div className="sub">{side === 'left' ? 'ätarprofiler' : 'veckorutiner'}</div>
      </div>

      {visibleEaters.map(eater => (
        <div className="eater" key={eater.id}>
          <div className="eater-name">{eater.namn}</div>
          <div className="eater-role">{eater.roll}</div>
          <div className="eater-list">
            {eater.halsa && eater.halsa.length > 0 && (
              <><strong>Hälsa:</strong>{' '}
                {eater.halsa.map(h => <span className="tag" key={h}>{h}</span>)}
                <br />
              </>
            )}
            {eater.kost && eater.kost.length > 0 && (
              <><strong>Kost:</strong>{' '}
                {eater.kost.map(k => <span className="tag" key={k}>{k}</span>)}
                <br />
              </>
            )}
            {eater.gillar.length > 0 && (
              <><strong>Gillar:</strong>{' '}
                {eater.gillar.map(g => <span className="tag good" key={g}>{g}</span>)}
              </>
            )}
          </div>
        </div>
      ))}

      {side === 'right' && (
        <div className="eater">
          <div className="eater-name">Veckorutin</div>
          <div className="eater-role">så här ser veckan ut</div>
          <div className="eater-list">
            <strong>Måndag–fredag:</strong> max 35 min middagar<br />
            <strong>Fredag:</strong> oftast pizza-utflykt<br />
            <strong>Lördag–söndag:</strong> tid för längre matlagning
          </div>
        </div>
      )}
    </>
  )
}
