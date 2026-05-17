import { useState } from 'react'
import { PageSide } from '../../types'

interface ShopItem {
  label: string
  atHome?: boolean
}

interface ShopGroup {
  title: string
  items: ShopItem[]
}

const GROUPS_LEFT: ShopGroup[] = [
  {
    title: 'Frukt & grönt',
    items: [
      { label: 'Skogssvamp 400g' },
      { label: 'Gul lök 3 st' },
      { label: 'Vitlök', atHome: true },
      { label: 'Rödbetor 500g' },
      { label: 'Basilika 1 kruka' },
    ],
  },
  {
    title: 'Mejeri & kyl',
    items: [
      { label: 'Halloumi 250g' },
      { label: 'Parmesan', atHome: true },
      { label: 'Tofu 2 pkt' },
    ],
  },
  {
    title: 'Kött & fisk',
    items: [
      { label: 'Laxfilé 400g' },
      { label: 'Fläskkarré 600g' },
    ],
  },
]

const GROUPS_RIGHT: ShopGroup[] = [
  {
    title: 'Skafferi',
    items: [
      { label: 'Arborioris 500g' },
      { label: 'Pasta 500g' },
      { label: 'Röda linser 500g' },
      { label: 'Pesto 1 burk' },
      { label: 'Grönsaksbuljong', atHome: true },
      { label: 'Olivolja', atHome: true },
      { label: 'Rött vin' },
    ],
  },
  {
    title: 'Lidl (rea denna vecka)',
    items: [
      { label: 'Rotfrukter 1 kg' },
      { label: 'Kycklinglår 1 kg' },
    ],
  },
  {
    title: 'Övrigt',
    items: [
      { label: 'Toalettpapper' },
      { label: 'Tvättmedel' },
    ],
  },
]

interface Props {
  side: PageSide
}

export default function HandlaView({ side }: Props) {
  const groups = side === 'left' ? GROUPS_LEFT : GROUPS_RIGHT
  const storageKey = `handla-checked-${side}`
  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return new Set(saved ? JSON.parse(saved) : [])
    } catch {
      return new Set()
    }
  })

  function toggle(label: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      localStorage.setItem(storageKey, JSON.stringify([...next]))
      return next
    })
  }

  return (
    <>
      <div className="page-head">
        <div className="title">{side === 'left' ? 'Inköpslista' : 'Inköpslista (forts.)'}</div>
        <div className="sub">{side === 'left' ? 'v.21 · ICA Maxi' : 'v.21'}</div>
      </div>

      {groups.map(group => (
        <div className="shop-group" key={group.title}>
          <h3 className="shop-group-title">{group.title}</h3>
          {group.items.map(item => (
            <div
              key={item.label}
              className={`shop-row${item.atHome ? ' home' : checked.has(item.label) ? ' done' : ''}`}
              onClick={() => !item.atHome && toggle(item.label)}
            >
              <span className="box" />
              {item.label}
              {item.atHome && (
                <em style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.7 }}>har hemma</em>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
