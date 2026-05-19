import { useState } from 'react'

type Tab = 'schema' | 'exempel'

const FIELDS = [
  { name: 'vecka',                type: 'string',     req: true,  desc: 'ISO-veckonummer, format YYYY-Www, t.ex. "2026-W21".' },
  { name: 'starts',               type: 'string',     req: true,  desc: 'Måndagens datum i ISO-format, t.ex. "2026-05-18".' },
  { name: 'middagar',             type: 'DayMeal[]',  req: true,  desc: 'Lista med 7 objekt, ett per dag.' },
  { name: 'middagar[].dag',       type: 'string',     req: true,  desc: <>Dag på svenska: <code>mandag</code> · <code>tisdag</code> · … · <code>sondag</code></> },
  { name: 'middagar[].datum',     type: 'string',     req: true,  desc: 'Datum i ISO-format.' },
  { name: 'middagar[].recept',    type: 'string|null',req: true,  desc: 'Slug till recept, eller null om borta.' },
  { name: 'middagar[].portioner', type: 'number',     req: false, desc: 'Antal portioner. Default 4.' },
  { name: 'middagar[].kommentar', type: 'string',     req: false, desc: 'Fri text, t.ex. "Mormor & morfar kommer".' },
  { name: 'middagar[].varianter', type: 'object',     req: false, desc: <>Map <code>{'{ "<eater-id>": "<variant-name>" }'}</code> för per-person-anpassningar.</> },
  { name: 'middagar[].anteckning',type: 'string',     req: false, desc: 'Används när recept är null, t.ex. "Pizza-utflykt".' },
  { name: 'anteckningar',         type: 'WeekNote[]', req: false, desc: 'Fritextlappar kopplade till veckan.' },
  { name: 'anteckningar[].nar',   type: 'string',     req: true,  desc: <><code>denna-vecka</code> · <code>vecka-NN</code> · <code>ide</code></> },
  { name: 'anteckningar[].text',  type: 'string',     req: true,  desc: 'Innehållet i anteckningen.' },
  { name: 'extra_inkop',          type: 'string[]',   req: false, desc: 'Inköp som inte är ingredienser: toalettpapper, blommor…' },
  { name: 'skapad',               type: 'string',     req: true,  desc: 'ISO 8601-timestamp när filen skapades.' },
]

function ExampleJson() {
  return (
    <div className="code-block">
      <span className="cb-label">2026-W21.json</span>
      <span><span className="cp">{'{'}</span></span>
      <span className="ind1"><span className="ck">"vecka"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">2026-W21</span><span className="cp">",</span></span>
      <span className="ind1"><span className="ck">"starts"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">2026-05-18</span><span className="cp">",</span></span>
      <span className="ind1"><span className="ck">"middagar"</span><span className="cp">: [</span></span>
      <span className="ind2"><span className="cp">{'{'}</span></span>
      <span className="ind3"><span className="ck">"dag"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">mandag</span><span className="cp">",</span></span>
      <span className="ind3"><span className="ck">"datum"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">2026-05-18</span><span className="cp">",</span></span>
      <span className="ind3"><span className="ck">"recept"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">het-kikärtsgryta</span><span className="cp">",</span></span>
      <span className="ind3"><span className="ck">"portioner"</span><span className="cp">: </span><span className="cn">4</span></span>
      <span className="ind2"><span className="cp">{'}'}</span><span className="cp">,</span></span>
      <span className="ind2"><span className="cp">{'{'}</span></span>
      <span className="ind3"><span className="ck">"dag"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">tisdag</span><span className="cp">",</span></span>
      <span className="ind3"><span className="ck">"datum"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">2026-05-19</span><span className="cp">",</span></span>
      <span className="ind3"><span className="ck">"recept"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">linsgryta-kokos-lime</span><span className="cp">",</span></span>
      <span className="ind3"><span className="ck">"varianter"</span><span className="cp">: {'{'} </span><span className="ck">"yngsta"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">barnvänlig</span><span className="cp">" {'}'}</span></span>
      <span className="ind2"><span className="cp">{'}'}</span><span className="cp">,</span></span>
      <span className="ind2"><span className="cp">{'{'}</span></span>
      <span className="ind3"><span className="ck">"dag"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">fredag</span><span className="cp">",</span></span>
      <span className="ind3"><span className="ck">"datum"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">2026-05-22</span><span className="cp">",</span></span>
      <span className="ind3"><span className="ck">"recept"</span><span className="cp">: </span><span className="cnl">null</span><span className="cp">,</span></span>
      <span className="ind3"><span className="ck">"anteckning"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">Pizza-utflykt på Roma</span><span className="cp">"</span></span>
      <span className="ind2"><span className="cp">{'}'}</span></span>
      <span className="ind1"><span className="cp">],</span></span>
      <span className="ind1"><span className="ck">"anteckningar"</span><span className="cp">: [</span></span>
      <span className="ind2"><span className="cp">{'{'} </span><span className="ck">"nar"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">denna-vecka</span><span className="cp">", </span><span className="ck">"text"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">Mormor & morfar på lördag!</span><span className="cp">" {'}'}</span><span className="cp">,</span></span>
      <span className="ind2"><span className="cp">{'{'} </span><span className="ck">"nar"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">ide</span><span className="cp">", </span><span className="ck">"text"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">Testa indisk linsgryta med kokos nästa gång</span><span className="cp">" {'}'}</span></span>
      <span className="ind1"><span className="cp">],</span></span>
      <span className="ind1"><span className="ck">"extra_inkop"</span><span className="cp">: [</span><span className="cp">"</span><span className="cs">toalettpapper</span><span className="cp">", </span><span className="cp">"</span><span className="cs">blommor till mormor</span><span className="cp">"],</span></span>
      <span className="ind1"><span className="ck">"skapad"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">2026-05-17T18:30:00Z</span><span className="cp">"</span></span>
      <span><span className="cp">{'}'}</span></span>
    </div>
  )
}

export default function WeekMenuSection() {
  const [tab, setTab] = useState<Tab>('schema')

  return (
    <div className="doc-section">
      <h2>Veckomenyn</h2>
      <p className="section-sub">
        Varje vecka lagras som <code>public/data/weeks/YYYY-Www.json</code>. Filen skapas manuellt (eller med Claude) och refererar till recept via slug.
      </p>

      <div className="doc-tabs">
        {(['schema', 'exempel'] as Tab[]).map(t => (
          <button key={t} className={`doc-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'schema' && (
        <>
          <div className="callout info">
            <span className="callout-icon">📅</span>
            <div className="callout-body">
              <strong>Konvention</strong>
              Varje vecka skapar Claude en ny JSON-fil baserat på Daniel's preferenser och familjens rutiner. Filen commitas direkt till repot.
            </div>
          </div>
          <table className="field-table">
            <thead>
              <tr><th>Fält</th><th>Typ</th><th>Krav</th><th>Beskrivning</th></tr>
            </thead>
            <tbody>
              {FIELDS.map(f => (
                <tr key={f.name}>
                  <td><span className="field-name">{f.name}</span></td>
                  <td><span className="field-type">{f.type}</span></td>
                  <td><span className={`field-req ${f.req ? '' : 'opt'}`}>{f.req ? '✓' : '–'}</span></td>
                  <td><span className="field-desc">{f.desc}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Dag-konventioner</h3>
          <ul className="convention-list">
            <li><span className="conv-key">måndag</span><span>Alltid söndagsöver — inget nytt tillagas</span></li>
            <li><span className="conv-key">fredag</span><span>Oftast pizza-utflykt — <code>recept: null</code></span></li>
            <li><span className="conv-key">onsdag</span><span>Under 40 min</span></li>
            <li><span className="conv-key">söndag</span><span>Batchkok med måndag i åtanke (dagkedja)</span></li>
          </ul>
        </>
      )}

      {tab === 'exempel' && <ExampleJson />}
    </div>
  )
}
