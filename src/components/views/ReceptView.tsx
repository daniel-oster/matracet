import { useState, useEffect } from 'react'
import { PageSide, RecipeIndexEntry, Recipe } from '../../types'

interface Props {
  side: PageSide
  recipeIndex: RecipeIndexEntry[]
  selectedSlug: string | null
  onSelect: (slug: string) => void
}

function categoryEmoji(kategorier: string[]): string {
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

// ─── Left page: recipe list ────────────────────────────────────────────────────

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
              <img className="recipe-thumb" src={r.bildUrl} alt={r.namn} loading="lazy" />
            )}
            <div className="recipe-card-info">
              <div className="recipe-card-name">{r.namn}</div>
              <div className="recipe-card-meta">
                <span>{r.tid_min} min</span>
                <span className="recipe-card-dot">·</span>
                <span>{categoryEmoji(r.kategorier)} {categoryText(r.kategorier)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

// ─── Right page: recipe detail ─────────────────────────────────────────────────

function RecipeDetail({ slug }: { slug: string }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setRecipe(null)
    fetch(`/matracet/data/recipes/${slug}/recept.json`)
      .then(r => r.json())
      .then((data: Recipe) => { setRecipe(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  if (loading) return <div className="recipe-detail-empty">Laddar…</div>
  if (!recipe)  return <div className="recipe-detail-empty">Recept kunde inte laddas.</div>

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
            {categoryEmoji(recipe.kategorier)} {categoryText(recipe.kategorier)}
          </span>
          {recipe.dagkedja && <span className="badge kedja">Kedja {recipe.dagkedja}</span>}
          {!recipe.komplett && <span className="badge inkomplett">Ej komplett</span>}
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

      {recipe.tips && <div className="recipe-tips">💡 {recipe.tips}</div>}

      {recipe.kalla && (
        <div className="recipe-source">
          Källa:{' '}
          {recipe.kallaUrl
            ? <a href={recipe.kallaUrl} target="_blank" rel="noreferrer noopener">{recipe.kalla}</a>
            : recipe.kalla}
        </div>
      )}
    </div>
  )
}

// ─── Right page: empty state ───────────────────────────────────────────────────

function RecipeEmpty() {
  return (
    <div className="recipe-detail-empty">
      <div>← Välj ett recept</div>
      <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.6 }}>
        <a href="/matracet/sysdoc/" style={{ color: 'inherit' }}>Datamodell & schema →</a>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function ReceptView({ side, recipeIndex, selectedSlug, onSelect }: Props) {
  if (side === 'left') {
    return <RecipeList recipes={recipeIndex} selectedSlug={selectedSlug} onSelect={onSelect} />
  }
  if (!selectedSlug) return <RecipeEmpty />
  return <RecipeDetail slug={selectedSlug} />
}
