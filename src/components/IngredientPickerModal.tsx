import { useEffect, useRef, useState } from 'react'
import { Recipe } from '../types'
import { usePantry } from '../hooks/usePantry'
import { useShoppingList } from '../hooks/useShoppingList'
import { formatAmount } from '../lib/shoppingList'

interface Props {
  recipe: Recipe
  onClose: () => void
}

/** Checklist popover for "Lägg till i inköpslistan" — nothing is ever pulled onto the
 * shopping list without the user reviewing and confirming exactly which ingredients they
 * want, per this app's manual-only shopping list philosophy (see CLAUDE.md). Items already
 * covered by pantry.json start unchecked as a helpful default, not a hidden skip. */
export default function IngredientPickerModal({ recipe, onClose }: Props) {
  const pantry = usePantry()
  const { addOrRestoreByName } = useShoppingList()

  const pantrySkip = new Set(
    [...(pantry?.always_have ?? []), ...(pantry?.current_stock.map(p => p.vara) ?? [])].map(s =>
      s.toLowerCase(),
    ),
  )

  // pantry.json loads asynchronously (usePantry fetches on mount), so the initial render
  // always sees an empty pantrySkip — everything starts checked. Once pantry data actually
  // arrives, uncheck the staples exactly once (a ref guard, not a pantrySkip-size check,
  // since a household with zero pantry staples would otherwise re-run this every render).
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(recipe.ingredienser.map((_, i) => i)),
  )
  const appliedPantrySkip = useRef(false)
  useEffect(() => {
    if (appliedPantrySkip.current || !pantry) return
    appliedPantrySkip.current = true
    setChecked(prev => {
      const next = new Set(prev)
      recipe.ingredienser.forEach((ing, i) => {
        if (pantrySkip.has(ing.vara.trim().toLowerCase())) next.delete(i)
      })
      return next
    })
  }, [pantry])

  function toggle(i: number) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function confirm() {
    recipe.ingredienser.forEach((ing, i) => {
      if (!checked.has(i)) return
      addOrRestoreByName(ing.vara, { amount: formatAmount(ing.mangd, ing.enhet), source: recipe.namn })
    })
    onClose()
  }

  return (
    <div className="ingpick-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ingpick-panel">
        <div className="ingpick-title">Lägg till i inköpslistan</div>
        <div className="ingpick-sub">{recipe.namn} — bocka ur det du inte behöver</div>
        <div className="ingpick-list">
          {recipe.ingredienser.map((ing, i) => {
            const isSkip = pantrySkip.has(ing.vara.trim().toLowerCase())
            return (
              <label className="ingpick-row" key={i}>
                <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} />
                <span className="ingpick-row-name">{formatAmount(ing.mangd, ing.enhet)} {ing.vara}</span>
                {isSkip && <span className="ingpick-row-note">redan hemma</span>}
              </label>
            )
          })}
        </div>
        <div className="ingpick-actions">
          <button type="button" className="export-btn" onClick={onClose}>Avbryt</button>
          <button type="button" className="shop-add-btn" onClick={confirm} disabled={checked.size === 0}>
            Lägg till{checked.size > 0 ? ` (${checked.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
