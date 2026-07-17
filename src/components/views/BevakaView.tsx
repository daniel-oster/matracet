import { StoreOffers } from '../../types'
import { useOffers } from '../../hooks/useOffers'
import { useBevakningslista } from '../../hooks/useBevakningslista'
import { useShoppingList } from '../../hooks/useShoppingList'
import { STORES, CATEGORY_EMOJI, TaggedOffer, findBevakaHits, toOfferRef } from '../../lib/bevaka'
import TopBar from '../TopBar'

interface Props {
  onBack: () => void
}

export default function BevakaView({ onBack }: Props) {
  const items = useBevakningslista()
  const { stores } = useOffers()
  const { isActiveForOffer, addOrRestoreByName, removeOrMarkForOffer } = useShoppingList()

  if (!items || !stores) {
    return (
      <div className="screen">
        <TopBar onBack={onBack} title="Bevaka" />
        <div className="screen-body"><div className="fynd-empty">Laddar…</div></div>
      </div>
    )
  }

  const all: TaggedOffer[] = stores.flatMap((s: StoreOffers) =>
    s.erbjudanden.map(o => ({ ...o, store: s.kalla, week: s.vecka })),
  )
  const hits = findBevakaHits(items, all)
  const hitIds = new Set(hits.map(h => h.item.id))

  return (
    <div className="screen">
      <TopBar
        onBack={onBack}
        eyebrow="Stående lista – dyker upp här vid extrapris"
        title="Bevakning"
        right={hits.length > 0 ? `${hits.length} träff${hits.length > 1 ? 'ar' : ''}` : undefined}
      />
      <div className="screen-body bevaka-grid">
        <div className="bevaka-col">
          <h3 className="shop-group-title">Bevakningslista</h3>
          <div className="bevaka-list">
            {items.map(item => (
              <div className={`bevaka-item${hitIds.has(item.id) ? ' hit' : ''}`} key={item.id}>
                <span className="bevaka-item-emoji">{CATEGORY_EMOJI[item.kategori] ?? '📦'}</span>
                <div className="bevaka-item-body">
                  <div className="bevaka-item-name">{item.vara}</div>
                  {(item.storlek_hint || item.onskat_marke || item.undvik_marken.length > 0 || item.anteckning) && (
                    <div className="bevaka-item-note">
                      {item.onskat_marke && <span>Vill ha: {item.onskat_marke}. </span>}
                      {item.undvik_marken.length > 0 && <span>Inte: {item.undvik_marken.join(', ')}. </span>}
                      {item.storlek_hint && <span>{item.storlek_hint}. </span>}
                      {item.anteckning && <span>{item.anteckning}</span>}
                    </div>
                  )}
                </div>
                {hitIds.has(item.id) && <span className="bevaka-bell" title="Extrapris just nu">🔔</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="bevaka-col">
          <h3 className="shop-group-title">Fynd nu</h3>
          {hits.length === 0 && (
            <div className="fynd-empty">Inget på bevakningslistan är på extrapris just nu.</div>
          )}
          {hits.map(({ item, offers }) => (
            <div className="match-group" key={item.id}>
              <div className="match-label">
                <span className="match-cat-emoji">{CATEGORY_EMOJI[item.kategori] ?? '📦'}</span>
                {item.vara}
              </div>
              {offers.map((o, i) => {
                const inList = isActiveForOffer(o.namn, o.store)
                return (
                  <div
                    className={`match-row${inList ? ' in-list' : ''}`}
                    key={`${o.store}-${i}`}
                    onClick={() => (inList ? removeOrMarkForOffer(o.namn, o.store) : addOrRestoreByName(o.namn, { offerRef: toOfferRef(o) }))}
                    title={inList ? 'I inköpslistan — klicka för att ta bort' : 'Klicka för att lägga i inköpslistan'}
                  >
                    <span className={`fynd-store ${STORES[o.store]?.klass}`}>{STORES[o.store]?.namn}</span>
                    <div className="match-info">
                      {inList && <span className="fynd-cart" title="I inköpslistan">🛒</span>}
                      {[o.marke, o.storlek].filter(Boolean).join(' · ') && (
                        <span className="match-size">{[o.marke, o.storlek].filter(Boolean).join(' · ')}</span>
                      )}
                      {o.jamforpris && <span className="fynd-jmf">{o.jamforpris}</span>}
                      {o.klubbpris && <span className="fynd-tag club">klubb</span>}
                    </div>
                    <div className="match-price">
                      <span className="fynd-pris">{o.pris_text}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
