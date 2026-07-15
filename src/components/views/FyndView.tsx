import { useState } from 'react'
import { Offer, StoreOffers } from '../../types'
import { useOffers } from '../../hooks/useOffers'
import { useShoppingList } from '../../hooks/useShoppingList'
import { useIrrelevantOffers } from '../../hooks/useIrrelevantOffers'
import SwipeRow from '../SwipeRow'
import TopBar from '../TopBar'

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
  groupId: string
  label: string
  sub?: string
  emoji: string
}
/** Grouped by "what do I cook with" rather than store-shelf placement — protein and
 * vegetables each split into a fresh/frozen sub-section within one group heading. */
const CATS: CatMeta[] = [
  { id: 'protein_farsk', groupId: 'protein', label: 'Protein', sub: 'Färskt', emoji: '🥩' },
  { id: 'protein_fryst', groupId: 'protein', label: 'Protein', sub: 'Fryst', emoji: '🥩' },
  { id: 'gront_farsk', groupId: 'gront', label: 'Grönt', sub: 'Färskt', emoji: '🥦' },
  { id: 'gront_fryst', groupId: 'gront', label: 'Grönt', sub: 'Fryst', emoji: '🥦' },
  { id: 'frukt', groupId: 'frukt', label: 'Frukt', emoji: '🍎' },
  { id: 'snacks_godis', groupId: 'snacks_godis', label: 'Snacks & godis', emoji: '🍫' },
  { id: 'ovrigt', groupId: 'ovrigt', label: 'Övrigt', emoji: '📦' },
]
const GROUP_ORDER = ['protein', 'gront', 'frukt', 'snacks_godis', 'ovrigt']

const FLAGS: Record<string, string> = {
  Sverige: '🇸🇪',
  Irland: '🇮🇪',
  'Irland/UK': '🇮🇪',
  'Nya Zeeland': '🇳🇿',
}

interface TaggedOffer extends Offer {
  store: string
}

interface MatchGroup {
  key: string
  label: string
  kategori: string
  catEmoji: string
  entries: TaggedOffer[]
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
  const j = parseJmf(o.jamforpris)
  if (j) return j.val
  if (o.pris != null) return o.pris
  return Number.POSITIVE_INFINITY
}

function isSwedish(o: Offer): boolean {
  if (o.ursprung && /sverige/i.test(o.ursprung)) return true
  return o.markeringar.some(m => ['svensk', 'kott_sverige', 'fagel_sverige'].includes(m))
}

function normalizeKey(s: string): string {
  let k = s.toLowerCase()
  k = k.replace(/[åä]/g, 'a').replace(/ö/g, 'o')
  k = k.replace(/\b\d+\s*(g|kg|ml|l|cl|st|pack|förp|pkt)\b/gi, '')
  k = k.replace(/[^a-z ]/g, '')
  k = k.replace(/\s+/g, ' ').trim()
  return k
}

function buildMatchGroups(all: TaggedOffer[]): MatchGroup[] {
  const byKey = new Map<string, TaggedOffer[]>()
  for (const o of all) {
    const key = normalizeKey(o.namn)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(o)
  }

  const groups: MatchGroup[] = []
  for (const [key, entries] of byKey.entries()) {
    const storeSet = new Set(entries.map(e => e.store))
    if (storeSet.size < 2) continue

    const bestByStore: TaggedOffer[] = []
    for (const store of storeSet) {
      const storeEntries = entries.filter(e => e.store === store).sort((a, b) => sortKey(a) - sortKey(b))
      bestByStore.push(storeEntries[0])
    }

    const catId = entries[0].kategori
    const catMeta = CATS.find(c => c.id === catId)
    groups.push({
      key,
      label: entries[0].namn,
      kategori: catId,
      catEmoji: catMeta?.emoji ?? '📦',
      entries: bestByStore,
    })
  }

  return groups.sort((a, b) => a.label.localeCompare(b.label, 'sv'))
}

interface Props {
  onBack: () => void
}

export default function FyndView({ onBack }: Props) {
  const [storeFilter, setStoreFilter] = useState<Record<string, boolean>>({ willys: true, ica: true, hemkop: true })
  const [swedishOnly, setSwedishOnly] = useState(false)
  const [mode, setMode] = useState<'alla' | 'jamfor'>('alla')
  const [week, setWeek] = useState<string | null>(null)
  const { stores, availableWeeks, latestWeek } = useOffers(week)
  const { isActiveByName, addOrRestoreByName, removeOrMarkByName } = useShoppingList()
  const { isIrrelevant, markIrrelevant, restore: restoreIrrelevant } = useIrrelevantOffers()

  function toggleShoppingList(o: TaggedOffer) {
    if (isActiveByName(o.namn)) removeOrMarkByName(o.namn)
    else addOrRestoreByName(o.namn, { storeKey: o.store })
  }

  const toggleStore = (store: string) => setStoreFilter(prev => ({ ...prev, [store]: !prev[store] }))

  if (!stores) {
    return (
      <div className="screen">
        <TopBar onBack={onBack} title="Fynd" />
        <div className="screen-body"><div className="fynd-empty">Laddar erbjudanden…</div></div>
      </div>
    )
  }

  const shownWeek = stores[0]?.vecka.split('-W')[1] ?? ''
  const range = stores[0] ? `${dm(stores[0].giltigt_fran)}–${dm(stores[0].giltigt_till)}` : ''
  const otherWeeks = availableWeeks.filter(w => w !== latestWeek).slice().reverse()

  const all: TaggedOffer[] = stores.flatMap((s: StoreOffers) =>
    s.erbjudanden.map(o => ({ ...o, store: s.kalla })),
  )

  function visible(o: TaggedOffer): boolean {
    if (!storeFilter[o.store]) return false
    if (swedishOnly && !isSwedish(o)) return false
    return true
  }

  return (
    <div className="screen">
      <TopBar
        onBack={onBack}
        eyebrow={`v.${shownWeek} · ${range} · ${stores.length} butiker`}
        title={mode === 'jamfor' ? 'Jämför' : 'Fynd'}
        right={
          <div className="fynd-mode-bar">
            <button
              type="button"
              className={`fynd-mode-btn${mode === 'alla' ? ' active' : ''}`}
              onClick={() => setMode('alla')}
            >
              Alla
            </button>
            <button
              type="button"
              className={`fynd-mode-btn${mode === 'jamfor' ? ' active' : ''}`}
              onClick={() => setMode('jamfor')}
            >
              Jämför
            </button>
          </div>
        }
      />

      <div className="screen-body">
        <div className="fynd-filters">
          {(otherWeeks.length > 0 || week) && (
            <select
              className="fynd-week-select"
              value={week ?? ''}
              onChange={e => setWeek(e.target.value || null)}
              title="Välj vecka"
            >
              {latestWeek && <option value="">Senaste · v.{latestWeek.split('-W')[1]}</option>}
              {otherWeeks.map(w => (
                <option key={w} value={w}>{weekLabel(w)}</option>
              ))}
            </select>
          )}
          {Object.keys(STORES).map(key => (
            <button
              key={key}
              type="button"
              className={`fynd-chip ${STORES[key].klass}${storeFilter[key] ? ' on' : ''}`}
              onClick={() => toggleStore(key)}
            >
              {STORES[key].namn}
            </button>
          ))}
          <button
            type="button"
            className={`fynd-chip flag${swedishOnly ? ' on' : ''}`}
            onClick={() => setSwedishOnly(v => !v)}
            title="Visa bara varor med svenskt ursprung"
          >
            🇸🇪 Svenskt
          </button>
        </div>
        <p className="fynd-hint">🛒 Dubbelklicka en vara för att lägga den i inköpslistan. ← Svep vänster för att markera som irrelevant.</p>

        {mode === 'alla' ? (
          <AllView
            all={all}
            visible={visible}
            isActiveByName={isActiveByName}
            onToggleShoppingList={toggleShoppingList}
            isIrrelevant={isIrrelevant}
            onMarkIrrelevant={markIrrelevant}
            onRestoreIrrelevant={restoreIrrelevant}
          />
        ) : (
          <JamforView all={all} visible={visible} isActiveByName={isActiveByName} onToggleShoppingList={toggleShoppingList} />
        )}
      </div>
    </div>
  )
}

interface RowProps {
  isActiveByName: (namn: string) => boolean
  onToggleShoppingList: (o: TaggedOffer) => void
}

function OfferRow({ o, best, isActiveByName, onToggleShoppingList }: RowProps & { o: TaggedOffer; best: boolean }) {
  const flag = o.ursprung ? FLAGS[o.ursprung] ?? '🌍' : isSwedish(o) ? '🇸🇪' : ''
  const inList = isActiveByName(o.namn)
  return (
    <div
      className={`fynd-row${best ? ' best' : ''}${inList ? ' in-list' : ''}`}
      onDoubleClick={() => onToggleShoppingList(o)}
      title={inList ? 'I inköpslistan — dubbelklicka för att ta bort' : 'Dubbelklicka för att lägga i inköpslistan'}
    >
      <span className={`fynd-store ${STORES[o.store]?.klass}`}>{STORES[o.store]?.namn}</span>
      <div className="fynd-info">
        <div className="fynd-name">
          {inList && <span className="fynd-cart" title="I inköpslistan">🛒</span>}
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
}

function OfferRows({ offers, isActiveByName, onToggleShoppingList, onMarkIrrelevant }: RowProps & {
  offers: TaggedOffer[]
  onMarkIrrelevant: (namn: string) => void
}) {
  const sorted = [...offers].sort((a, b) => sortKey(a) - sortKey(b))
  const minByUnit: Record<string, number> = {}
  const unitCount: Record<string, number> = {}
  for (const o of sorted) {
    const j = parseJmf(o.jamforpris)
    if (!j) continue
    unitCount[j.unit] = (unitCount[j.unit] ?? 0) + 1
    minByUnit[j.unit] = minByUnit[j.unit] == null ? j.val : Math.min(minByUnit[j.unit], j.val)
  }

  return (
    <>
      {sorted.map((o, i) => {
        const j = parseJmf(o.jamforpris)
        const best = j != null && unitCount[j.unit] >= 2 && j.val === minByUnit[j.unit]
        return (
          <SwipeRow key={`${o.store}-${o.namn}-${i}`} onSwipeLeft={() => onMarkIrrelevant(o.namn)}>
            <OfferRow o={o} best={best} isActiveByName={isActiveByName} onToggleShoppingList={onToggleShoppingList} />
          </SwipeRow>
        )
      })}
    </>
  )
}

function AllView({ all, visible, isActiveByName, onToggleShoppingList, isIrrelevant, onMarkIrrelevant, onRestoreIrrelevant }: RowProps & {
  all: TaggedOffer[]
  visible: (o: TaggedOffer) => boolean
  isIrrelevant: (namn: string) => boolean
  onMarkIrrelevant: (namn: string) => void
  onRestoreIrrelevant: (namn: string) => void
}) {
  const relevant = (o: TaggedOffer) => visible(o) && !isIrrelevant(o.namn)
  const anyVisible = all.some(relevant)
  const irrelevantOffers = all.filter(o => visible(o) && isIrrelevant(o.namn))

  return (
    <div className="fynd-scroll fynd-scroll--wide">
      {GROUP_ORDER.map(groupId => {
        const members = CATS.filter(c => c.groupId === groupId)
        const groupOffers = all.filter(o => relevant(o) && members.some(m => m.id === o.kategori))
        if (groupOffers.length === 0) return null
        const first = members[0]

        return (
          <div className="fynd-cat" key={groupId}>
            <h3 className="fynd-cat-title">
              <span>{first.emoji} {first.label}</span>
              <span className="fynd-cat-count">{groupOffers.length}</span>
            </h3>
            {members.length > 1
              ? members.map(m => {
                  const offers = groupOffers.filter(o => o.kategori === m.id)
                  if (offers.length === 0) return null
                  return (
                    <div key={m.id}>
                      <h4 className="fynd-subcat-title">{m.sub}</h4>
                      <OfferRows offers={offers} isActiveByName={isActiveByName} onToggleShoppingList={onToggleShoppingList} onMarkIrrelevant={onMarkIrrelevant} />
                    </div>
                  )
                })
              : <OfferRows offers={groupOffers} isActiveByName={isActiveByName} onToggleShoppingList={onToggleShoppingList} onMarkIrrelevant={onMarkIrrelevant} />}
          </div>
        )
      })}
      {!anyVisible && (
        <div className="fynd-empty">Inga erbjudanden matchar filtret.</div>
      )}
      {irrelevantOffers.length > 0 && (
        <div className="fynd-cat">
          <h3 className="fynd-cat-title fynd-irrelevant-title">
            <span>🙈 Irrelevant</span>
            <span className="fynd-cat-count">{irrelevantOffers.length}</span>
          </h3>
          {irrelevantOffers.map((o, i) => (
            <div
              className="fynd-row done"
              key={`irr-${o.store}-${o.namn}-${i}`}
              onClick={() => onRestoreIrrelevant(o.namn)}
              title="Återställ"
            >
              <span className={`fynd-store ${STORES[o.store]?.klass}`}>{STORES[o.store]?.namn}</span>
              <div className="fynd-info">
                <div className="fynd-name">{o.namn}</div>
                <div className="fynd-meta">{[o.marke, o.storlek].filter(Boolean).join(' · ')}</div>
              </div>
              <span className="fynd-ord">↺ återställ</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function JamforView({ all, visible, isActiveByName, onToggleShoppingList }: RowProps & {
  all: TaggedOffer[]
  visible: (o: TaggedOffer) => boolean
}) {
  const filtered = all.filter(visible)
  const groups = buildMatchGroups(filtered)

  if (groups.length === 0) {
    return (
      <div className="fynd-scroll fynd-scroll--wide">
        <div className="fynd-empty">Inga jämförbara produkter med aktuellt filter.</div>
      </div>
    )
  }

  return (
    <div className="fynd-scroll fynd-scroll--wide">
      {groups.map(group => {
        const jmfEntries = group.entries.map(e => parseJmf(e.jamforpris)).filter((j): j is NonNullable<typeof j> => j != null)
        const unitCount: Record<string, number> = {}
        const minJmf: Record<string, number> = {}
        for (const j of jmfEntries) {
          unitCount[j.unit] = (unitCount[j.unit] ?? 0) + 1
          minJmf[j.unit] = minJmf[j.unit] == null ? j.val : Math.min(minJmf[j.unit], j.val)
        }

        const sorted = [...group.entries].sort((a, b) => {
          const ja = parseJmf(a.jamforpris)
          const jb = parseJmf(b.jamforpris)
          if (ja && jb && ja.unit === jb.unit) return ja.val - jb.val
          const pa = a.pris ?? Infinity
          const pb = b.pris ?? Infinity
          return pa - pb
        })

        return (
          <div className="match-group" key={group.key}>
            <div className="match-label">
              <span className="match-cat-emoji">{group.catEmoji}</span>
              {group.label}
            </div>
            {sorted.map(e => {
              const j = parseJmf(e.jamforpris)
              const best = j != null && unitCount[j.unit] >= 2 && j.val === minJmf[j.unit]
              const flag = e.ursprung ? FLAGS[e.ursprung] ?? '🌍' : isSwedish(e) ? '🇸🇪' : ''
              const inList = isActiveByName(e.namn)
              return (
                <div
                  className={`match-row${best ? ' best' : ''}${inList ? ' in-list' : ''}`}
                  key={e.store}
                  onDoubleClick={() => onToggleShoppingList(e)}
                  title={inList ? 'I inköpslistan — dubbelklicka för att ta bort' : 'Dubbelklicka för att lägga i inköpslistan'}
                >
                  <span className={`fynd-store ${STORES[e.store]?.klass}`}>{STORES[e.store]?.namn}</span>
                  <div className="match-info">
                    {inList && <span className="fynd-cart" title="I inköpslistan">🛒</span>}
                    {e.storlek && <span className="match-size">{e.storlek}</span>}
                    {e.jamforpris && <span className="fynd-jmf">{e.jamforpris}</span>}
                    {best && <span className="fynd-best">lägst</span>}
                    {e.klubbpris && <span className="fynd-tag club">klubb</span>}
                  </div>
                  <div className="match-price">
                    <span className="fynd-pris">{e.pris_text}</span>
                    {flag && <span className="fynd-flag">{flag}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** "2026-06-15" → "15/6" */
function dm(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}

/** "2026-W25" → "v.25 · 2026" */
function weekLabel(vecka: string): string {
  const [year, wk] = vecka.split('-W')
  return `v.${wk} · ${year}`
}
