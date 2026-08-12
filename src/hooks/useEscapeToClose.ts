import { useEffect } from 'react'

/** Dismiss-on-Escape for a modal/overlay — extracted from RecipeOverlay (the only place this
 *  existed before) so IngredientPickerModal/CategoryFeedbackModal/MealEditorModal get the same
 *  behaviour instead of only supporting outside-click/backdrop-tap to dismiss. The app is also
 *  used from a desktop browser (not just the phone-first mobile case), where Escape is the
 *  expected way to back out of a modal. */
export function useEscapeToClose(onClose: () => void): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}
