import { useRef, useState } from 'react'

interface Props {
  onSwipeLeft: () => void
  children: React.ReactNode
  /** 'row' for full-width list rows (reveals a background label), 'chip' for small inline elements (e.g. offer-cloud chips — no room for a label, just fades/slides). */
  variant?: 'row' | 'chip'
  label?: string
  className?: string
}

const THRESHOLD = -72
const TAP_TOLERANCE = 8

/** Wraps its children with a swipe-left gesture (pointer-events, so it works for touch and mouse
 * alike) that fires `onSwipeLeft` past a distance threshold. A drag beyond tap tolerance suppresses
 * the child's own click, so e.g. a chip's onClick toggle doesn't also fire when the user meant to swipe. */
export default function SwipeRow({ onSwipeLeft, children, variant = 'row', label = 'Irrelevant', className }: Props) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const axisLocked = useRef<'x' | 'y' | null>(null)
  const wasDrag = useRef(false)

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    startY.current = e.clientY
    axisLocked.current = null
    wasDrag.current = false
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    const deltaX = e.clientX - startX.current
    const deltaY = e.clientY - startY.current
    if (axisLocked.current === null) {
      if (Math.abs(deltaX) < TAP_TOLERANCE && Math.abs(deltaY) < TAP_TOLERANCE) return
      axisLocked.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
    }
    if (axisLocked.current !== 'x') return
    wasDrag.current = true
    setDx(Math.min(0, deltaX))
  }

  function endDrag() {
    if (!dragging) return
    setDragging(false)
    if (dx < THRESHOLD) onSwipeLeft()
    setDx(0)
    axisLocked.current = null
  }

  function onClickCapture(e: React.MouseEvent) {
    if (wasDrag.current) {
      e.preventDefault()
      e.stopPropagation()
      wasDrag.current = false
    }
  }

  return (
    <div
      className={`swipe-row swipe-row--${variant}${className ? ` ${className}` : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
    >
      {variant === 'row' && (
        <div className="swipe-row-bg"><span>{label} ›</span></div>
      )}
      <div
        className="swipe-row-fg"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dragging ? 'none' : 'transform 0.2s ease' }}
      >
        {children}
      </div>
    </div>
  )
}
