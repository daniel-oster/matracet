import { useState, useEffect } from 'react'
import { PageSide, RecipeIndexEntry, Recipe } from '../../types'

interface Props {
  side: PageSide
  recipeIndex: RecipeIndexEntry[]
  selectedSlug: string | null
  onSelect: (slug: string) => void
}

function categoryLabel(kategorier: string[]): string {
  if (kategorier.includes('vegansk')) return '🌱'
  if (kategorier.includes('vegetarisk')) return '🥚'
  if (kategorier.includes('fisk')) return '🐟'
  return '🍽️'
}

function categoryBadgeClass(kategorier: string[]): string {
  if (kategorier.includes('vegansk')) return 'badge vegan'
  if (kategorier.includes('vegetarisk')) return 'badge vegetarisk'
  return 'badge'
}

function categoryText(kategorier: string[]): string {
  if (kategorier.includes('vegansk')) return 'Vegansk'
  if (kategorier.includes('vegetarisk')) return 'Vegetarisk'
  if (kategorier.includes('fisk')) return 'Fisk'
  return kategorier[0] ?? ''
}

// ─── Left page: recipe list ───────────────────────────────────────────────────

function RecipeList({ recipes, selectedSlug, onSelect }: {
  recipes: RecipeIndexEntry[]
  selectedSlug: string | null
  onSelect: (slug: string) => void
}) {
  return (
    <>
      <div className="page-head">
        <div className="title">Receptbiblioteket</div>
        <div className="sub">{recipes.length} recept</div>
      </div>
      <div className="recipe-scroll-list">
        {recipes.map(r => (
          <button
            key={r.slug}
            className={`recipe-card-btn ${selectedSlug === r.slug ? 'active' : ''}`}
            onClick={() => onSelect(r.slug)}
          >
            {r.bildUrl && (
              <img
                className="recipe-thumb"
                src={r.bildUrl}
                alt={r.namn}
                loading="lazy"
              />
            )}
            <div className="recipe-card-info">
              <div className="recipe-card-name">{r.namn}</div>
              <div className="recipe-card-meta">
                <span>{r.tid_min} min</span>
                <span className="recipe-card-dot">·</span>
                <span>{categoryLabel(r.kategorier)} {categoryText(r.kategorier)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

// ─── Right page: recipe detail ────────────────────────────────────────────────

function RecipeDetail({ slug }: { slug: string }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setRecipe(null)
    fetch(`/matracet/data/recipes/${slug}/recept.json`)
      .then(r => r.json())
      .then((data: Recipe) => {
        setRecipe(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug])

  if (loading) return <div className="recipe-detail-empty">Laddar…</div>
  if (!recipe) return <div className="recipe-detail-empty">Recept kunde inte laddas.</div>

  const groups: Record<string, typeof recipe.ingredienser> = {}
  const main: typeof recipe.ingredienser = []
  recipe.ingredienser.forEach(i => {
    if (i.grupp) {
      if (!groups[i.grupp]) groups[i.grupp] = []
      groups[i.grupp].push(i)
    } else {
      main.push(i)
    }
  })

  return (
    <div className="recipe-detail">
      {recipe.bildUrl && (
        <img className="recipe-detail-img" src={recipe.bildUrl} alt={recipe.namn} />
      )}

      <div className="recipe-detail-header">
        <div className="recipe-detail-title">{recipe.namn}</div>
        <div className="recipe-detail-meta-row">
          <span className="recipe-detail-time">⏱ {recipe.tid_min} min</span>
          <span className="recipe-detail-portions">· {recipe.portioner} port.</span>
          <span className={categoryBadgeClass(recipe.kategorier)}>
            {categoryLabel(recipe.kategorier)} {categoryText(recipe.kategorier)}
          </span>
          {recipe.dagkedja && (
            <span className="badge kedja">Kedja {recipe.dagkedja}</span>
          )}
          {!recipe.komplett && (
            <span className="badge inkomplett">Ej komplett</span>
          )}
        </div>
      </div>

      {recipe.ingredienser.length > 0 && (
        <div className="recipe-section">
          <div className="recipe-section-label">Ingredienser</div>
          <ul className="ingredient-list">
            {main.map((ing, i) => (
              <li key={i} className="ingredient-item">
                <span className="ingredient-amount">{ing.mangd} {ing.enhet}</span>
                <span className="ingredient-name">{ing.vara}</span>
              </li>
            ))}
            {Object.entries(groups).map(([grupp, items]) => (
              <li key={grupp} className="ingredient-group">
                <div className="ingredient-group-label">{grupp}</div>
                {items.map((ing, i) => (
                  <div key={i} className="ingredient-item">
                    <span className="ingredient-amount">{ing.mangd} {ing.enhet}</span>
                    <span className="ingredient-name">{ing.vara}</span>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recipe.instruktioner.length > 0 && (
        <div className="recipe-section">
          <div className="recipe-section-label">Tillagning</div>
          <ol className="instruction-list">
            {recipe.instruktioner.map((step, i) => (
              <li key={i} className="instruction-step">{step}</li>
            ))}
          </ol>
        </div>
      )}

      {recipe.servering && recipe.servering.length > 0 && (
        <div className="recipe-section">
          <div className="recipe-section-label">Servering</div>
          <div className="recipe-serving">{recipe.servering.join(', ')}</div>
        </div>
      )}

      {recipe.tips && (
        <div className="recipe-tips">💡 {recipe.tips}</div>
      )}
    </div>
  )
}

// ─── Right page: schema docs (shown when nothing selected) ────────────────────

const SCHEMA_FIELDS = [
  { falt: 'schema_version', typ: 'string', krav: '✓', beskrivning: 'Schemaversion, t.ex. "1.0"' },
  { falt: 'slug', typ: 'string', krav: '✓', beskrivning: 'URL-säker identifierare, matchar mappnamn' },
  { falt: 'nummer', typ: 'number', krav: '✓', beskrivning: 'Receptnummer 1–55' },
  { falt: 'namn', typ: 'string', krav: '✓', beskrivning: 'Visningsnamn' },
  { falt: 'tid_min', typ: 'number', krav: '✓', beskrivning: 'Total tid i minuter' },
  { falt: 'portioner', typ: 'number', krav: '✓', beskrivning: 'Standardportioner' },
  { falt: 'kategorier', typ: 'string[]', krav: '✓', beskrivning: 'vegansk · vegetarisk · fisk · kott' },
  { falt: 'sasong', typ: 'string[]', krav: '–', beskrivning: 'var · sommar · host · vinter' },
  { falt: 'svarighet', typ: 'string', krav: '–', beskrivning: 'enkel · medel · avancerad' },
  { falt: 'barnvanlig', typ: 'string', krav: '–', beskrivning: 'ja · delvis · nej' },
  { falt: 'taggar', typ: 'string[]', krav: '–', beskrivning: 'Fria taggar: gryta, comfort-food…' },
  { falt: 'kalla', typ: 'string', krav: '–', beskrivning: 'Källa (bok, webbplats)' },
  { falt: 'dagkedja', typ: 'string|null', krav: '–', beskrivning: 'Kedja A–E för batchkok' },
  { falt: 'bildUrl', typ: 'string', krav: '–', beskrivning: 'URL till bild (Unsplash o.dyl.)' },
  { falt: 'ingredienser', typ: 'Ingredient[]', krav: '✓', beskrivning: 'vara · mangd · enhet · grupp?' },
  { falt: 'varianter', typ: 'object', krav: '–', beskrivning: '{ variantnamn: { byt: {från: till} } }' },
  { falt: 'instruktioner', typ: 'string[]', krav: '✓', beskrivning: 'Numrerade steg som plain text' },
  { falt: 'servering', typ: 'string[]', krav: '–', beskrivning: 'Serveringsförslag' },
  { falt: 'tips', typ: 'string|null', krav: '–', beskrivning: 'Fritext-tips' },
  { falt: 'komplett', typ: 'boolean', krav: '✓', beskrivning: 'false = metadata finns men recept saknas' },
]

function SchemaDoc() {
  const [activeSection, setActiveSection] = useState<'fil' | 'falt' | 'ingrediens'>('fil')

  return (
    <div className="schema-doc">
      <div className="page-head">
        <div className="title">Datamodell</div>
        <div className="sub">recept.json — schema v1.0</div>
      </div>

      <div className="schema-tabs">
        <button
          className={`schema-tab ${activeSection === 'fil' ? 'active' : ''}`}
          onClick={() => setActiveSection('fil')}
        >Filstruktur</button>
        <button
          className={`schema-tab ${activeSection === 'falt' ? 'active' : ''}`}
          onClick={() => setActiveSection('falt')}
        >Fältlista</button>
        <button
          className={`schema-tab ${activeSection === 'ingrediens' ? 'active' : ''}`}
          onClick={() => setActiveSection('ingrediens')}
        >Ingrediens</button>
      </div>

      {activeSection === 'fil' && (
        <div className="schema-section">
          <div className="schema-tree">
            <div className="tree-line"><span className="tree-dir">public/data/recipes/</span></div>
            <div className="tree-line indent"><span className="tree-file">_index.json</span> <span className="tree-note">— lista för menyn</span></div>
            <div className="tree-line indent"><span className="tree-dir">het-kikärtsgryta/</span></div>
            <div className="tree-line indent2"><span className="tree-file">recept.json</span> <span className="tree-note">— fullständigt recept</span></div>
            <div className="tree-line indent2"><span className="tree-file">bild.jpg</span> <span className="tree-note">— lokal bild (valfri)</span></div>
            <div className="tree-line indent"><span className="tree-dir">svamprisotto/</span></div>
            <div className="tree-line indent2"><span className="tree-file">recept.json</span></div>
            <div className="tree-line indent"><span className="tree-dim">… (ett recept per mapp)</span></div>
          </div>
          <div className="schema-rule">
            <span className="rule-label">Konvention</span>
            <span className="rule-text">Mappnamn = slug. Bildfilsnamn alltid <code>bild.jpg</code> eller <code>bild.webp</code>.</span>
          </div>
          <div className="schema-rule">
            <span className="rule-label">Slug-format</span>
            <span className="rule-text">Gemener, bindestreck, inga svenska tecken (ö→o, ä→a, å→a)</span>
          </div>
          <div className="schema-rule">
            <span className="rule-label">Iterera</span>
            <span className="rule-text">Ny version → öka schema_version. Gamla fält bakåtkompatibla.</span>
          </div>
        </div>
      )}

      {activeSection === 'falt' && (
        <div className="schema-section schema-table-wrap">
          <table className="schema-table">
            <thead>
              <tr>
                <th>Fält</th>
                <th>Typ</th>
                <th>Krav</th>
                <th>Beskrivning</th>
              </tr>
            </thead>
            <tbody>
              {SCHEMA_FIELDS.map(f => (
                <tr key={f.falt}>
                  <td><code>{f.falt}</code></td>
                  <td className="schema-type">{f.typ}</td>
                  <td className={`schema-req ${f.krav === '✓' ? 'required' : ''}`}>{f.krav}</td>
                  <td className="schema-desc">{f.beskrivning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeSection === 'ingrediens' && (
        <div className="schema-section">
          <div className="schema-code">
            <div className="code-line"><span className="code-key">"ingredienser"</span><span className="code-punct">: [</span></div>
            <div className="code-line indent"><span className="code-punct">{"{"}</span></div>
            <div className="code-line indent2"><span className="code-key">"vara"</span><span className="code-punct">: </span><span className="code-str">"olivolja"</span><span className="code-punct">,</span></div>
            <div className="code-line indent2"><span className="code-key">"mangd"</span><span className="code-punct">: </span><span className="code-num">2</span><span className="code-punct">,</span></div>
            <div className="code-line indent2"><span className="code-key">"enhet"</span><span className="code-punct">: </span><span className="code-str">"msk"</span><span className="code-punct">,</span></div>
            <div className="code-line indent2"><span className="code-key">"grupp"</span><span className="code-punct">: </span><span className="code-null">null</span></div>
            <div className="code-line indent"><span className="code-punct">{"}"}</span></div>
            <div className="code-line"><span className="code-punct">]</span></div>
          </div>
          <div className="schema-rule">
            <span className="rule-label">vara</span>
            <span className="rule-text">Normaliserat namn i gemener — används vid aggregering till inköpslista</span>
          </div>
          <div className="schema-rule">
            <span className="rule-label">enhet</span>
            <span className="rule-text">g · kg · dl · l · msk · tsk · st · krm · pkt · burk</span>
          </div>
          <div className="schema-rule">
            <span className="rule-label">grupp</span>
            <span className="rule-text">Grupperar ingredienser: "sas", "servering", "dressing" o.s.v. — visas som underrubrik</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReceptView({ side, recipeIndex, selectedSlug, onSelect }: Props) {
  if (side === 'left') {
    return <RecipeList recipes={recipeIndex} selectedSlug={selectedSlug} onSelect={onSelect} />
  }

  if (!selectedSlug) {
    return <SchemaDoc />
  }

  return <RecipeDetail slug={selectedSlug} />
}
