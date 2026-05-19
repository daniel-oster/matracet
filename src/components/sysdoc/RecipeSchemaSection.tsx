import { useState } from 'react'

type Tab = 'schema' | 'exempel' | 'ingredienser' | 'varianter'

const FIELDS = [
  { name: 'schema_version', type: 'string',     req: true,  desc: 'Schemaversion. Öka vid brytande ändringar, t.ex. "1.0" → "2.0".' },
  { name: 'slug',           type: 'string',     req: true,  desc: 'URL-säker identifierare i gemener med bindestreck. Matchar mappnamnet.' },
  { name: 'nummer',         type: 'number',     req: true,  desc: 'Receptnummer 1–55 från ursprunglig receptbank.' },
  { name: 'namn',           type: 'string',     req: true,  desc: 'Visningsnamn i full längd.' },
  { name: 'tid_min',        type: 'number',     req: true,  desc: 'Total tillagningstid i minuter.' },
  { name: 'portioner',      type: 'number',     req: true,  desc: 'Standard antal portioner (vanligtvis 4).' },
  { name: 'kategorier',     type: 'string[]',   req: true,  desc: <>Tillåtna värden: <code>vegansk</code> · <code>vegetarisk</code> · <code>fisk</code> · <code>kott</code> · <code>mjolkfri</code></> },
  { name: 'sasong',         type: 'string[]',   req: false, desc: <>Tillåtna värden: <code>var</code> · <code>sommar</code> · <code>host</code> · <code>vinter</code>. Tom = hela året.</> },
  { name: 'svarighet',      type: 'string',     req: false, desc: <><code>enkel</code> · <code>medel</code> · <code>avancerad</code></> },
  { name: 'barnvanlig',     type: 'string',     req: false, desc: <><code>ja</code> · <code>delvis</code> · <code>nej</code></> },
  { name: 'taggar',         type: 'string[]',   req: false, desc: 'Fria taggar: gryta, comfort-food, helgmys, billig, snabb, matlåda…' },
  { name: 'kalla',          type: 'string',     req: false, desc: 'Receptkälla, t.ex. "Stora Veckans Vego" eller URL.' },
  { name: 'dagkedja',       type: 'string|null',req: false, desc: 'Batch-kok-kedja A–E. null om receptet inte ingår i en kedja.' },
  { name: 'bildUrl',        type: 'string',     req: false, desc: 'URL till representativ bild. Unsplash, Wikimedia o.dyl.' },
  { name: 'ingredienser',   type: 'Ingredient[]',req:true,  desc: 'Sorterad lista med ingredienser. Se Ingredienser-fliken.' },
  { name: 'varianter',      type: 'object',     req: false, desc: 'Kostumvarianter som swap-map. Se Varianter-fliken.' },
  { name: 'instruktioner',  type: 'string[]',   req: true,  desc: 'Numrerade tillagningssteg som plain-text strängar.' },
  { name: 'servering',      type: 'string[]',   req: false, desc: 'Serveringsförslag som kort lista, t.ex. ["ris", "koriander"].' },
  { name: 'tips',           type: 'string|null',req: false, desc: 'Valfritt fritext-tips. null om inget tips finns.' },
  { name: 'komplett',       type: 'boolean',    req: true,  desc: 'false = receptfilen är en platshållare utan fullständiga instruktioner.' },
]

const EXAMPLE_RECIPE = {
  schema_version: '1.0',
  slug: 'het-kikärtsgryta',
  nummer: 1,
  namn: 'Het kikärtsgryta med saffran',
  tid_min: 20,
  portioner: 4,
  kategorier: ['vegansk'],
  sasong: [],
  svarighet: 'enkel',
  barnvanlig: 'delvis',
  taggar: ['gryta', 'billig', 'saffran', 'snabb'],
  kalla: 'Stora Veckans Vego',
  dagkedja: null,
  bildUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&fit=crop',
  ingredienser: [
    { vara: 'olivolja', mangd: 1, enhet: 'msk', grupp: null },
    { vara: 'potatis', mangd: 300, enhet: 'g', grupp: null },
    { vara: 'kikärter', mangd: 400, enhet: 'g', grupp: null },
    { vara: 'aioli', mangd: 1, enhet: 'dl', grupp: 'servering' },
  ],
  varianter: {},
  instruktioner: [
    'Hetta upp oljan. Stek potatis och lök med saffran.',
    'Häll i vatten och buljong. Sjud 15 min.',
    'Vänd ner kikärter och värm igenom.',
  ],
  servering: ['aioli', 'bröd'],
  tips: 'Variera potatisen med sötpotatis eller rotselleri!',
  komplett: true,
}

function JsonLine({ children, indent = 0 }: { children: React.ReactNode; indent?: number }) {
  const cls = ['', 'ind1', 'ind2', 'ind3'][indent] ?? 'ind3'
  return <span className={cls}>{children}</span>
}

function JsonStr({ v }: { v: string }) {
  return <><span className="cp">"</span><span className="cs">{v}</span><span className="cp">"</span></>
}

function ExampleJson() {
  const r = EXAMPLE_RECIPE
  return (
    <div className="code-block">
      <span className="cb-label">recept.json</span>
      <JsonLine><span className="cp">{'{'}</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"schema_version"</span><span className="cp">: </span><JsonStr v={r.schema_version} /><span className="cp">,</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"slug"</span><span className="cp">: </span><JsonStr v={r.slug} /><span className="cp">,</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"nummer"</span><span className="cp">: </span><span className="cn">{r.nummer}</span><span className="cp">,</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"namn"</span><span className="cp">: </span><JsonStr v={r.namn} /><span className="cp">,</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"tid_min"</span><span className="cp">: </span><span className="cn">{r.tid_min}</span><span className="cp">,</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"portioner"</span><span className="cp">: </span><span className="cn">{r.portioner}</span><span className="cp">,</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"kategorier"</span><span className="cp">: [</span><JsonStr v={r.kategorier[0]} /><span className="cp">],</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"svarighet"</span><span className="cp">: </span><JsonStr v={r.svarighet} /><span className="cp">,</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"barnvanlig"</span><span className="cp">: </span><JsonStr v={r.barnvanlig} /><span className="cp">,</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"taggar"</span><span className="cp">: [</span>{r.taggar.map((t, i) => <span key={t}><JsonStr v={t} />{i < r.taggar.length - 1 ? <span className="cp">, </span> : null}</span>)}<span className="cp">],</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"dagkedja"</span><span className="cp">: </span><span className="cnl">null</span><span className="cp">,</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"bildUrl"</span><span className="cp">: </span><span className="cp">"</span><span className="cs">https://images.unsplash.com/…</span><span className="cp">",</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"ingredienser"</span><span className="cp">: [</span><span className="cc"> …se ingredienser-flik… </span><span className="cp">],</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"instruktioner"</span><span className="cp">: [</span></JsonLine>
      {r.instruktioner.map((s, i) => (
        <JsonLine key={i} indent={2}><JsonStr v={s} />{i < r.instruktioner.length - 1 ? <span className="cp">,</span> : null}</JsonLine>
      ))}
      <JsonLine indent={1}><span className="cp">],</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"servering"</span><span className="cp">: [</span>{r.servering.map((s, i) => <span key={s}><JsonStr v={s} />{i < r.servering.length - 1 ? <span className="cp">, </span> : null}</span>)}<span className="cp">],</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"tips"</span><span className="cp">: </span><JsonStr v={r.tips!} /><span className="cp">,</span></JsonLine>
      <JsonLine indent={1}><span className="ck">"komplett"</span><span className="cp">: </span><span className="cn">true</span></JsonLine>
      <JsonLine><span className="cp">{'}'}</span></JsonLine>
    </div>
  )
}

function LivePreview() {
  const r = EXAMPLE_RECIPE
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
      <div>
        <h3>Renderas som →</h3>
        <div className="preview-card">
          <img className="preview-card-img" src={r.bildUrl} alt={r.namn} />
          <div className="preview-card-body">
            <div className="preview-card-title">{r.namn}</div>
            <div className="preview-card-meta">
              <span>⏱ {r.tid_min} min</span>
              <span>·</span>
              <span>{r.portioner} port.</span>
              <span className="tag vegan">🌱 Vegansk</span>
            </div>
            <div className="preview-ing">
              {r.ingredienser.filter(i => !i.grupp).map((ing, i) => (
                <div key={i} className="preview-ing-row">
                  <span className="preview-ing-amt">{ing.mangd} {ing.enhet}</span>
                  <span>{ing.vara}</span>
                </div>
              ))}
              <div className="preview-ing-row" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                <span className="preview-ing-amt">…</span>
                <span>och fler ingredienser</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <h3>Tips</h3>
        <div className="callout tip">
          <span className="callout-icon">💡</span>
          <div className="callout-body">{r.tips}</div>
        </div>
        <h3 style={{ marginTop: '16px' }}>Taggar</h3>
        <div>
          {r.taggar.map(t => <span key={t} className="tag neutral">{t}</span>)}
        </div>
      </div>
    </div>
  )
}

function IngredientsDoc() {
  return (
    <>
      <div className="callout info">
        <span className="callout-icon">ℹ️</span>
        <div className="callout-body">
          <strong>Ingrediensformatet</strong>
          Varje ingrediens är ett objekt med fyra fält. Fältet <code>grupp</code> är valfritt och används för att separera t.ex. "dressing" och "servering" från huvudingredienserna.
        </div>
      </div>
      <div className="code-block">
        <span className="cb-label">Ingredient</span>
        <JsonLine><span className="cp">{'{'}</span></JsonLine>
        <JsonLine indent={1}><span className="ck">"vara"</span><span className="cp">: </span><JsonStr v="olivolja" /><span className="cp">,</span><span className="cc">  // normaliserat namn i gemener</span></JsonLine>
        <JsonLine indent={1}><span className="ck">"mangd"</span><span className="cp">: </span><span className="cn">2</span><span className="cp">,</span><span className="cc">              // antal för standard-portionen</span></JsonLine>
        <JsonLine indent={1}><span className="ck">"enhet"</span><span className="cp">: </span><JsonStr v="msk" /><span className="cp">,</span><span className="cc">           // se enhetslista nedan</span></JsonLine>
        <JsonLine indent={1}><span className="ck">"grupp"</span><span className="cp">: </span><span className="cnl">null</span><span className="cc">             // eller "dressing", "servering", "sas"…</span></JsonLine>
        <JsonLine><span className="cp">{'}'}</span></JsonLine>
      </div>
      <h3>Tillåtna enheter</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '10px 0' }}>
        {['g', 'kg', 'dl', 'l', 'msk', 'tsk', 'krm', 'st', 'pkt', 'burk', 'klyftor', 'stjälkar', 'skivor', 'dl', 'cm', 'ml'].filter((v,i,a)=>a.indexOf(v)===i).map(u => (
          <span key={u} className="tag neutral">{u}</span>
        ))}
      </div>
      <h3>Grupp-konvention</h3>
      <ul className="convention-list">
        <li><span className="conv-key">null</span><span>Huvudingrediens — visas i primär ingredienslista</span></li>
        <li><span className="conv-key">"servering"</span><span>Tillbehör som inte behövs för tillagningen</span></li>
        <li><span className="conv-key">"dressing"</span><span>Ingredienser till separat dressing/sås</span></li>
        <li><span className="conv-key">"sas"</span><span>Ingredienser till en underkomponent (t.ex. marinad)</span></li>
        <li><span className="conv-key">valfri text</span><span>Grupperas under en underrubrik i detaljvyn — välj namn som är meningsfullt</span></li>
      </ul>
      <h3 style={{ marginTop: '20px' }}>Fullt exempel</h3>
      <div className="code-block">
        <span className="cb-label">ingredienser</span>
        <JsonLine><span className="cp">[</span></JsonLine>
        <JsonLine indent={1}><span className="cc">// Huvudingredienser — grupp null</span></JsonLine>
        <JsonLine indent={1}><span className="cp">{'{'} </span><span className="ck">"vara"</span><span className="cp">: </span><JsonStr v="olivolja" /><span className="cp">, </span><span className="ck">"mangd"</span><span className="cp">: </span><span className="cn">2</span><span className="cp">, </span><span className="ck">"enhet"</span><span className="cp">: </span><JsonStr v="msk" /><span className="cp">, </span><span className="ck">"grupp"</span><span className="cp">: </span><span className="cnl">null</span> <span className="cp">{'}'}</span><span className="cp">,</span></JsonLine>
        <JsonLine indent={1}><span className="cp">{'{'} </span><span className="ck">"vara"</span><span className="cp">: </span><JsonStr v="potatis" /><span className="cp">, </span><span className="ck">"mangd"</span><span className="cp">: </span><span className="cn">300</span><span className="cp">, </span><span className="ck">"enhet"</span><span className="cp">: </span><JsonStr v="g" /><span className="cp">, </span><span className="ck">"grupp"</span><span className="cp">: </span><span className="cnl">null</span> <span className="cp">{'}'}</span><span className="cp">,</span></JsonLine>
        <JsonLine indent={1}><span className="cc">// Serveringstillbehör — grupperas separat</span></JsonLine>
        <JsonLine indent={1}><span className="cp">{'{'} </span><span className="ck">"vara"</span><span className="cp">: </span><JsonStr v="aioli" /><span className="cp">, </span><span className="ck">"mangd"</span><span className="cp">: </span><span className="cn">1</span><span className="cp">, </span><span className="ck">"enhet"</span><span className="cp">: </span><JsonStr v="dl" /><span className="cp">, </span><span className="ck">"grupp"</span><span className="cp">: </span><JsonStr v="servering" /> <span className="cp">{'}'}</span></JsonLine>
        <JsonLine><span className="cp">]</span></JsonLine>
      </div>
    </>
  )
}

function VariantsDoc() {
  return (
    <>
      <div className="callout tip">
        <span className="callout-icon">🌱</span>
        <div className="callout-body">
          <strong>Variantformatet</strong>
          Varianter används för att beskriva hur ett recept anpassas för en annan kost, t.ex. veganskt eller glutenfritt — utan att duplicera hela receptet.
        </div>
      </div>
      <div className="code-block">
        <span className="cb-label">varianter</span>
        <JsonLine><span className="cp">{'{'}</span></JsonLine>
        <JsonLine indent={1}><span className="ck">"vegansk"</span><span className="cp">: {'{'}</span></JsonLine>
        <JsonLine indent={2}><span className="ck">"byt"</span><span className="cp">: {'{'}</span></JsonLine>
        <JsonLine indent={3}><span className="ck">"smör"</span><span className="cp">: </span><JsonStr v="olivolja" /><span className="cp">,</span><span className="cc">      // byt ut smör mot olivolja</span></JsonLine>
        <JsonLine indent={3}><span className="ck">"grädde"</span><span className="cp">: </span><JsonStr v="havregrädde" /></JsonLine>
        <JsonLine indent={2}><span className="cp">{'}'}</span></JsonLine>
        <JsonLine indent={1}><span className="cp">{'}'}</span><span className="cp">,</span></JsonLine>
        <JsonLine indent={1}><span className="ck">"glutenfri"</span><span className="cp">: {'{'}</span></JsonLine>
        <JsonLine indent={2}><span className="ck">"byt"</span><span className="cp">: {'{'} </span><span className="ck">"pasta"</span><span className="cp">: </span><JsonStr v="glutenfri pasta" /> <span className="cp">{'}'}</span></JsonLine>
        <JsonLine indent={1}><span className="cp">{'}'}</span></JsonLine>
        <JsonLine><span className="cp">{'}'}</span></JsonLine>
      </div>
      <h3>Varianta-nycklar</h3>
      <ul className="convention-list">
        <li><span className="conv-key">vegansk</span><span>Byt mejerier och ägg mot växtbaserade alternativ</span></li>
        <li><span className="conv-key">mjolkfri</span><span>Byt mjölkprodukter mot mjölkfria alternativ (ägg tillåtet)</span></li>
        <li><span className="conv-key">glutenfri</span><span>Byt glutenhaltiga ingredienser</span></li>
        <li><span className="conv-key">valfri text</span><span>Fritt — t.ex. "barnvänlig" eller en persons namn</span></li>
      </ul>
      <div className="callout warn">
        <span className="callout-icon">⚠️</span>
        <div className="callout-body">
          Strukturen <code>byt</code> är ett enkelt <em>från → till</em>-map. Varianthanteringen är ännu inte implementerad i inköpslistan — det är en V2-funktion.
        </div>
      </div>
    </>
  )
}

export default function RecipeSchemaSection() {
  const [tab, setTab] = useState<Tab>('schema')

  return (
    <div className="doc-section">
      <h2>Recept-schema</h2>
      <p className="section-sub">
        Varje recept lagras som en enskild JSON-fil på <code>public/data/recipes/&#123;slug&#125;/recept.json</code>.
        Schema-versionen i varje fil möjliggör framtida migrering utan att bryta gamla filer.
      </p>

      <div className="doc-tabs">
        {(['schema', 'exempel', 'ingredienser', 'varianter'] as Tab[]).map(t => (
          <button
            key={t}
            className={`doc-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'schema' && (
        <>
          <div className="file-tree">
            <span className="ft-dir">public/data/recipes/</span>
            <span className="ft-i1"><span className="ft-file">_index.json</span><span className="ft-note">— lätt metadata för listvy (slug, namn, tid_min, bildUrl)</span></span>
            <span className="ft-i1"><span className="ft-dir">het-kikärtsgryta/</span></span>
            <span className="ft-i2"><span className="ft-file">recept.json</span><span className="ft-note">— fullständigt recept</span></span>
            <span className="ft-i2"><span className="ft-file">bild.jpg</span><span className="ft-note">— lokal bild (valfri, annars bildUrl)</span></span>
            <span className="ft-i1"><span className="ft-dir">svamprisotto/</span></span>
            <span className="ft-i2"><span className="ft-file">recept.json</span></span>
            <span className="ft-i1"><span className="ft-dim">… (ett recept per mapp, mappnamn = slug)</span></span>
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
        </>
      )}

      {tab === 'exempel' && (
        <>
          <ExampleJson />
          <h3>Live-förhandsvisning</h3>
          <LivePreview />
        </>
      )}

      {tab === 'ingredienser' && <IngredientsDoc />}
      {tab === 'varianter'    && <VariantsDoc />}
    </div>
  )
}
