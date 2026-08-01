import type { ReactNode } from 'react'
import { usePlannerCollapse } from '../../hooks/usePlannerCollapse'

interface Props {
  id: string
  title: string
  count?: number
  hint?: string
  defaultCollapsed: boolean
  children: ReactNode
}

/** One of Planera's inspiration-first supply-column sections (2026-08 redesign, issue #93) —
 *  a header that toggles its own body, collapse state persisted per section id via
 *  usePlannerCollapse (same pattern as FyndView's category headers). */
export default function CollapsibleSection({ id, title, count, hint, defaultCollapsed, children }: Props) {
  const { isCollapsed, toggle } = usePlannerCollapse()
  const collapsed = isCollapsed(id, defaultCollapsed)
  return (
    <section className="plan-section">
      <button type="button" className="plan-section-head" onClick={() => toggle(id)} aria-expanded={!collapsed}>
        <span className="plan-section-title">{title}</span>
        {count != null && <span className="plan-section-count">· {count}</span>}
        <span className="plan-section-spacer" />
        {collapsed && hint && <span className="plan-section-hint">{hint}</span>}
        <span className="plan-section-chevron">{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && <div className="plan-section-body">{children}</div>}
    </section>
  )
}
