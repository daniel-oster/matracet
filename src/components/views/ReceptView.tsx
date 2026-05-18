import { PageSide } from '../../types'

interface RecipeEntry {
  namn: string
  meta: string
}

const RECIPES_LEFT: RecipeEntry[] = [
  { namn: 'Bönchili',          meta: '30 min · vegansk · billig' },
  { namn: 'Coq au vin',        meta: '2 tim · helgmys · gryta' },
  { namn: 'Halloumibowl',      meta: '25 min · vegetarisk' },
  { namn: 'Köttbullar & mos',  meta: '35 min · klassiker' },
  { namn: 'Krämig svamprisotto', meta: '35 min · vegetarisk · höst' },
]

const RECIPES_RIGHT: RecipeEntry[] = [
  { namn: 'Linsgryta, snabb',   meta: '25 min · vegansk · billig' },
  { namn: 'Pasta med pesto',    meta: '20 min · vegetarisk · snabb' },
  { namn: 'Quiche med spenat',  meta: '55 min · vegetarisk · matlåda' },
  { namn: 'Stekt fläsk & rödbetor', meta: '40 min · klassiker · höst' },
  { namn: 'Ugnsbakad lax',      meta: '45 min · fisk · lågt natrium' },
]

interface Props {
  side: PageSide
}

export default function ReceptView({ side }: Props) {
  const recipes = side === 'left' ? RECIPES_LEFT : RECIPES_RIGHT

  return (
    <>
      <div className="page-head">
        <div className="title">Receptbiblioteket</div>
        <div className="sub">{side === 'left' ? 'a — k' : 'l — ö'}</div>
      </div>

      <div className="recipe-list">
        {recipes.map(r => (
          <div className="recipe-row" key={r.namn}>
            <div className="recipe-name">{r.namn}</div>
            <div className="recipe-meta">{r.meta}</div>
          </div>
        ))}
      </div>
    </>
  )
}
