import { PageSide, Offer, StoreOffers, BevakningItem } from '../../types'
import { useOffers } from '../../hooks/useOffers'
import { useBevakningslista } from '../../hooks/useBevakningslista'

interface StoreMeta {
  namn: string
  klass: string
}
const STORES: Record<string, StoreMeta> = {
  willys: { namn: 'Willys', klass: 'willys' },
  ica: { namn: 'ICA', klass: 'ica' },
  hemkop: { namn: 'Hemköp', klass: 'hemkop' },
}

const CATEGORY_EMOJI: Record<string, string> = {
  kott_fagel: '🥩',
  fisk_skaldjur: '🐟',
  frukt_gront: '🥦',
  mejeri: '🧀',
  brod_bakverk: '🍞',
  torrvaror: '🥫',
  frys: '🧊',
  dryck: '🧃',
  snacks_godis: '🍫',
  hygien_hushall: '🧻',
  ovrigt: '📦',
}

interface TaggedOffer extends Offer {
  store: string
}

interface Hit {
  item: BevakningItem
  offers: TaggedOffer[]
}

function matches(item: BevakningItem, o: TaggedOffer): boolean {
  const hay = `${o.namn} ${o.marke ?? ''}`.toLowerCase()
  if (!item.sok.some(k => hay.includes(k.toLowerCase()))) return false
  if (item.undvik_marken.some(b => hay.includes(b.toLowerCase()))) return false
  return true
}

function findHits(items: BevakningItem[], all: TaggedOffer[]): Hit[] {
  return items
    .map(item => ({ item, offers: all.filter(o => matches(item, o)) }))
    .filter(h => h.offers.length > 0)
}

interface Props {
  side: PageSide
}

export default function BevakaView({ side }: Props) {
  const items = useBevakningslista()
  const { stores } = useOffers()

  if (!items || !stores) {
    return (
      <>
        <div className="page-head">
          <div className="title">Bevaka</div>
        </div>
        <div className="fynd-empty">Laddar…</div>
      </>
    )
  }

  const all: TaggedOffer[] = stores.flatMap((s: StoreOffers) =>
    s.erbjudanden.map(o => ({ ...o, store: s.kalla })),
  )
  const hits = findHits(items, all)
  const hitIds = new Set(hits.map(h => h.item.id))

  return side === 'left' ? (
    <>
      <div className="page-head">
        <div>
          <div className="title">Bevakning</div>
          <div className="sub">Stående lista – dyker upp till höger vid extrapris</div>
        </div>
      </div>
      <div className="fynd-scroll">
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
    </>
  ) : (
    <>
      <div className="page-head">
        <div>
          <div className="title">Bevaka · Fynd nu</div>
          <div className="sub">{hits.length > 0 ? `${hits.length} träff${hits.length > 1 ? 'ar' : ''} den här veckan` : 'Inga träffar just nu'}</div>
        </div>
      </div>
      <div className="fynd-scroll">
        {hits.length === 0 && (
          <div className="fynd-empty">Inget på bevakningslistan är på extrapris just nu.</div>
        )}
        {hits.map(({ item, offers }) => (
          <div className="match-group" key={item.id}>
            <div className="match-label">
              <span className="match-cat-emoji">{CATEGORY_EMOJI[item.kategori] ?? '📦'}</span>
              {item.vara}
            </div>
            {offers.map((o, i) => (
              <div className="match-row" key={`${o.store}-${i}`}>
                <span className={`fynd-store ${STORES[o.store]?.klass}`}>{STORES[o.store]?.namn}</span>
                <div className="match-info">
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
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
