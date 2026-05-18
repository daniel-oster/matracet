import { TabName, PageSide, WeekMenu, Eater } from '../types'
import VeckanView from './views/VeckanView'
import HandlaView from './views/HandlaView'
import ReceptView from './views/ReceptView'
import FamiljView from './views/FamiljView'
import AnteckningarView from './views/AnteckningarView'

interface Props {
  side: PageSide
  activeTab: TabName
  week: WeekMenu
  eaters: Eater[]
  flippedOut?: boolean
  flippedIn?: boolean
}

export default function Page({ side, activeTab, week, eaters, flippedOut, flippedIn }: Props) {
  const classes = [
    'page',
    side,
    flippedOut ? 'flipped-out' : '',
    flippedIn  ? 'flipped-in'  : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className="page-view" key={`${activeTab}-${side}`}>
        {activeTab === 'veckan'       && <VeckanView       side={side} week={week} />}
        {activeTab === 'handla'       && <HandlaView        side={side} />}
        {activeTab === 'recept'       && <ReceptView        side={side} />}
        {activeTab === 'familj'       && <FamiljView        side={side} eaters={eaters} />}
        {activeTab === 'anteckningar' && <AnteckningarView  side={side} />}
      </div>
    </div>
  )
}
