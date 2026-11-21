import { useOffersValidDuring } from '../../hooks/useOffers'
import { useBevakningslista } from '../../hooks/useBevakningslista'
import { useShoppingList } from '../../hooks/useShoppingList'
import { STORES, CATEGORY_EMOJI, TaggedOffer, findBevakaHits, tagOffers, toOfferRef, dealLabel } from '../../lib/bevaka'
import { todayISO } from '../../lib/offerValidity'
import TopBar from '../TopBar'

interface Props {
  onBack: () => void
}

export default function BevakaView({ onBack }: Props) {
  const items = useBevakningslista()
  // "Fynd nu" has to mean now: an expired flyer must not keep ringing the 🔔 bell.
  const today = todayISO()
  const { stores, staleNote } = useOffersValidDuring(today, today)
  const { isActiveForOffer, addOrRestoreByName, removeOrMarkForOffer } = useShoppingList()

  if (!items || !stores) {
    return (
      <div className="screen">
        <TopBar onBack={onBack} title="Bevaka" />
        <div className="screen-body"><div className="fynd-empty">Laddar…</div></div>
      </div>
    )
  }

  const all: TaggedOffer[] = tagOffers(stores)
  const hits = findBevakaHits(items, all)
  const hitIds = new Set(hits.filter(h => h.goodCount > 0).map(h => h.item.id))
  const goodItems = hits.filter(h => h.goodCount > 0).length

  return (
    <div className="screen">
      <TopBar
        onBack={onBack}
        eyebrow="Stående lista – dyker upp här vid bra rabatt"
        title="Bevakning"
        right={goodItems > 0 ? `${goodItems} bra pris` : undefined}
      />
      <div className="screen-body bevaka-grid">
        <div className="bevaka-col">
          <h3 className="shop-group-title">Fynd nu</h3>
          {hits.length === 0 && (
            <div className="fynd-empty">
              {staleNote
                ? `Inga aktuella erbjudanden – ${staleNote}.`
                : 'Inget på bevakningslistan är på rea just nu.'}
            </div>
          )}
          {hits.map(h => { const { item, offers } = h; return (
            <div className="match-group" key={item.id}>
              <div className="match-label">
                <span className="match-cat-emoji">{CATEGORY_EMOJI[item.kategori] ?? '📦'}</span>
                {item.vara}
                <span className="match-count">
                  {h.goodCount > 0 ? `🔥 ${h.goodCount} bra pris` : 'bara liten rabatt'}
                </span>
              </div>
              {offers.map((o, i) => {
                const inList = isActiveForOffer(o.namn, o.store)
                const deal = dealLabel(o)
                const origin = o.ursprung && !(o.marke ?? '').toLowerCase().includes(o.ursprung.toLowerCase()) ? o.ursprung : null
                const meta = [o.marke, o.storlek, origin].filter(Boolean).join(' · ')
                return (
                  <div
                    className={`match-row${inList ? ' in-list' : ''}${o.good ? ' good' : ' weak'}`}
                    key={`${o.store}-${i}`}
                    onClick={() => (inList ? removeOrMarkForOffer(o.namn, o.store) : addOrRestoreByName(o.namn, { offerRef: toOfferRef(o) }))}
                    title={inList ? 'I inköpslistan — klicka för att ta bort' : 'Klicka för att lägga i inköpslistan'}
                  >
                    <span className={`fynd-store ${STORES[o.store]?.klass}`}>{STORES[o.store]?.namn}</span>
                    <div className="match-info">
                      <div className="fynd-name">
                        {inList && <span className="fynd-cart" title="I inköpslistan">🛒</span>}
                        {o.namn}
                      </div>
                      <div className="match-size">
                        {meta && <span>{meta}</span>}
                        {o.jamforpris && <span className="fynd-jmf">{o.jamforpris}</span>}
                        {o.preferred && <span className="fynd-tag pref" title="Önskat märke">⭐ {item.onskat_marke}</span>}
                        {o.klubbpris && <span className="fynd-tag club">klubb</span>}
                      </div>
                    </div>
                    <div className="match-price">
                      <span className="fynd-pris">{o.pris_text}</span>
                      {deal && <span className={`match-deal${o.good ? ' good' : ''}`}>{deal}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) })}
        </div>
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

      </div>
    </div>
  )
}
