import { useOffersValidDuring } from '../hooks/useOffers'
import { useBevakningslista } from '../hooks/useBevakningslista'
import { STORES, findBevakaHits, tagOffers, dealLabel } from '../lib/bevaka'
import { todayISO } from '../lib/offerValidity'

/** Start-page card: what on the watch-list is on a good deal right now. */
export default function BevakaGlance({ onOpen }: { onOpen: () => void }) {
  const items = useBevakningslista()
  const today = todayISO()
  const { stores } = useOffersValidDuring(today, today)
  if (!items || !stores) return null

  const hits = findBevakaHits(items, tagOffers(stores))
  const good = hits.filter(h => h.goodCount > 0)
  const keyword = good.filter(h => h.item.sok.length > 0)
  const category = good.filter(h => h.item.sok.length === 0)
  const shown = keyword.slice(0, 3)

  return (
    <button className="bevaka-glance" onClick={onOpen}>
      <div className="bevaka-glance-head">
        <span>🔔 Bevakat</span>
        <span className="bevaka-glance-count">
          {keyword.length > 0 ? `${keyword.length} på bra rea nu` : 'inget på bra rea just nu'}
        </span>
        <span className="hub-primary-arrow">→</span>
      </div>
      {shown.map(h => {
        const o = h.offers[0]
        const deal = dealLabel(o)
        return (
          <div className="bevaka-glance-row" key={h.item.id}>
            <b>{h.item.vara}</b> · {[o.marke, STORES[o.store]?.namn].filter(Boolean).join(', ')} · {o.pris_text}
            {deal && <span className="match-deal good">{deal}</span>}
          </div>
        )
      })}
      {(keyword.length > shown.length || category.length > 0) && (
        <div className="bevaka-glance-more">
          {[
            keyword.length > shown.length ? `+${keyword.length - shown.length} till` : '',
            category.length > 0 ? `storrea i ${category.map(h => h.item.vara.toLowerCase()).join(', ')}` : '',
          ].filter(Boolean).join(' · ')}
        </div>
      )}
    </button>
  )
}
