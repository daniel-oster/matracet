import { PageSide, Offer, StoreOffers } from '../../types'
import { useOffers } from '../../hooks/useOffers'

interface StoreMeta {
  namn: string
  klass: string
}
const STORES: Record<string, StoreMeta> = {
  willys: { namn: 'Willys', klass: 'willys' },
  ica: { namn: 'ICA', klass: 'ica' },
  hemkop: { namn: 'Hemköp', klass: 'hemkop' },
}

interface CatMeta {
  id: string
  label: string
  emoji: string
}
const CATS: CatMeta[] = [
  { id: 'kott_fagel', label: 'Kött & fågel', emoji: '🥩' },
  { id: 'fisk_skaldjur', label: 'Fisk & skaldjur', emoji: '🐟' },
  { id: 'frukt_gront', label: 'Frukt & grönt', emoji: '🥦' },
  { id: 'mejeri', label: 'Mejeri', emoji: '🧀' },
  { id: 'brod_bakverk', label: 'Bröd & bak', emoji: '🍞' },
  { id: 'torrvaror', label: 'Skafferi', emoji: '🥫' },
  { id: 'frys', label: 'Frys', emoji: '🧊' },
  { id: 'dryck', label: 'Dryck', emoji: '🧃' },
  { id: 'snacks_godis', label: 'Snacks & godis', emoji: '🍫' },
  { id: 'hygien_hushall', label: 'Hygien & hushåll', emoji: '🧻' },
  { id: 'ovrigt', label: 'Övrigt', emoji: '📦' },
]
const LEFT_CATS = ['kott_fagel', 'fisk_skaldjur', 'frukt_gront', 'mejeri']
const RIGHT_CATS = ['brod_bakverk', 'torrvaror', 'frys', 'dryck', 'snacks_godis', 'hygien_hushall', 'ovrigt']

const FLAGS: Record<string, string> = {
  Sverige: '🇸🇪',
  Irland: '🇮🇪',
  'Irland/UK': '🇮🇪',
  'Nya Zeeland': '🇳🇿',
}

/** An offer tagged with which store it came from. */
interface TaggedOffer extends Offer {
  store: string
}

/** Parse a jämförpris string ("159.90-177.67/kg", "44.00/l") to a comparable value+unit. */
function parseJmf(s: string | null): { val: number; unit: string } | null {
  if (!s) return null
  const m = s.match(/(\d+(?:\.\d+)?)(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:kr)?\/(kg|liter|l|st|hg)/i)
  if (!m) return null
  let unit = m[2].toLowerCase()
  if (unit === 'liter') unit = 'l'
  return { val: parseFloat(m[1]), unit }
}

function sortKey(o: TaggedOffer): number {
  if (o.pris != null) return o.pris
  const j = parseJmf(o.jamforpris)
  return j ? j.val : Number.POSITIVE_INFINITY
}

function isSwedish(o: Offer): boolean {
  if (o.ursprung && /sverige/i.test(o.ursprung)) return true
  return o.markeringar.some(m => ['svensk', 'kott_sverige', 'fagel_sverige'].includes(m))
}

interface Props {
  side: PageSide
  storeFilter: Record<string, boolean>
  onToggleStore: (store: string) => void
  swedishOnly: boolean
  onToggleSwedish: () => void
}

export default function FyndView({ side, storeFilter, onToggleStore, swedishOnly, onToggleSwedish }: Props) {
  const stores = useOffers()

  if (!stores) {
    return (
      <>
        <div className="page-head">
          <div className="title">Fynd</div>
        </div>
        <div className="fynd-empty">Laddar erbjudanden…</div>
      </>
    )
  }

  const week = stores[0]?.vecka.split('-W')[1] ?? ''
  const range = stores[0] ? `${dm(stores[0].giltigt_fran)}–${dm(stores[0].giltigt_till)}` : ''

  // Flatten all offers, tagged with store key.
  const all: TaggedOffer[] = stores.flatMap((s: StoreOffers) =>
    s.erbjudanden.map(o => ({ ...o, store: s.kalla })),
  )

  const catIds = side === 'left' ? LEFT_CATS : RIGHT_CATS

  function visible(o: TaggedOffer): boolean {
    if (!storeFilter[o.store]) return false
    if (swedishOnly && !isSwedish(o)) return false
    return true
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="title">Fynd {side === 'left' ? '' : '· forts.'}</div>
          <div className="sub">{`v.${week} · ${range} · ${stores.length} butiker`}</div>
        </div>
      </div>

      <div className="fynd-filters">
        {Object.keys(STORES).map(key => (
          <button
            key={key}
            type="button"
            className={`fynd-chip ${STORES[key].klass}${storeFilter[key] ? ' on' : ''}`}
            onClick={() => onToggleStore(key)}
          >
            {STORES[key].namn}
          </button>
        ))}
        <button
          type="button"
          className={`fynd-chip flag${swedishOnly ? ' on' : ''}`}
          onClick={onToggleSwedish}
          title="Visa bara varor med svenskt ursprung"
        >
          🇸🇪 Svenskt
        </button>
      </div>

      <div className="fynd-scroll">
        {catIds.map(catId => {
          const meta = CATS.find(c => c.id === catId)!
          const offers = all.filter(o => o.kategori === catId && visible(o)).sort((a, b) => sortKey(a) - sortKey(b))
          if (offers.length === 0) return null

          // Mark the cheapest per jämförpris-unit (only when ≥2 offers share a unit) → real comparison.
          const minByUnit: Record<string, number> = {}
          const unitCount: Record<string, number> = {}
          for (const o of offers) {
            const j = parseJmf(o.jamforpris)
            if (!j) continue
            unitCount[j.unit] = (unitCount[j.unit] ?? 0) + 1
            minByUnit[j.unit] = minByUnit[j.unit] == null ? j.val : Math.min(minByUnit[j.unit], j.val)
          }

          return (
            <div className="fynd-cat" key={catId}>
              <h3 className="fynd-cat-title">
                <span>{meta.emoji} {meta.label}</span>
                <span className="fynd-cat-count">{offers.length}</span>
              </h3>
              {offers.map((o, i) => {
                const j = parseJmf(o.jamforpris)
                const best = j != null && unitCount[j.unit] >= 2 && j.val === minByUnit[j.unit]
                const flag = o.ursprung ? FLAGS[o.ursprung] ?? '🌍' : isSwedish(o) ? '🇸🇪' : ''
                return (
                  <div className={`fynd-row${best ? ' best' : ''}`} key={`${o.store}-${o.namn}-${i}`}>
                    <span className={`fynd-store ${STORES[o.store]?.klass}`}>{STORES[o.store]?.namn}</span>
                    <div className="fynd-info">
                      <div className="fynd-name">
                        {o.namn}
                        {flag && <span className="fynd-flag" title={o.ursprung ?? 'Svenskt'}>{flag}</span>}
                      </div>
                      <div className="fynd-meta">
                        {[o.marke, o.storlek].filter(Boolean).join(' · ')}
                        {o.jamforpris && <span className="fynd-jmf">{o.jamforpris}</span>}
                        {best && <span className="fynd-best">lägst</span>}
                        {o.klubbpris && <span className="fynd-tag club">klubb</span>}
                        {o.max_kop != null && <span className="fynd-tag">max {o.max_kop}</span>}
                      </div>
                    </div>
                    <div className="fynd-price">
                      <span className="fynd-pris">{o.pris_text}</span>
                      {o.besparing ? (
                        <span className="fynd-save">−{o.besparing}</span>
                      ) : o.ord_pris && !o.ord_pris.includes('-') ? (
                        <span className="fynd-ord">ord {o.ord_pris}</span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
        {catIds.every(catId => all.filter(o => o.kategori === catId && visible(o)).length === 0) && (
          <div className="fynd-empty">Inga erbjudanden matchar filtret.</div>
        )}
      </div>
    </>
  )
}

/** "2026-06-15" → "15/6" */
function dm(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}
