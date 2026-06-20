import { TabName } from '../types'

const TABS: { id: TabName; label: string }[] = [
  { id: 'veckan',       label: 'Veckan'  },
  { id: 'fynd',         label: 'Fynd'    },
  { id: 'handla',       label: 'Handla'  },
  { id: 'recept',       label: 'Recept'  },
  { id: 'familj',       label: 'Familj'  },
  { id: 'anteckningar', label: 'Anteckn.' },
]

interface Props {
  active: TabName
  onChange: (tab: TabName) => void
}

export default function Tabs({ active, onChange }: Props) {
  return (
    <div className="tabs-right">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          className={`tab${active === id ? ' active' : ''}`}
          data-tab={id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
