import { useState } from 'react'
import { useFeedback } from '../../hooks/useFeedback'
import { useWeekPlan } from '../../hooks/useWeekPlan'
import { useCategoryFeedback } from '../../hooks/useCategoryFeedback'
import { downloadLocalData, downloadCategoryFeedback } from '../../lib/exportData'
import TopBar from '../TopBar'

interface Props {
  onBack: () => void
}

export default function SynkaView({ onBack }: Props) {
  const { data: feedback } = useFeedback()
  const { data: weekplan } = useWeekPlan()
  const { entries: categoryCorrections } = useCategoryFeedback()
  const [downloaded, setDownloaded] = useState(false)
  const [categoryDownloaded, setCategoryDownloaded] = useState(false)

  const ratedRecipes = Object.keys(feedback).length
  const changedDays = Object.keys(weekplan).length

  function handleDownload() {
    downloadLocalData()
    setDownloaded(true)
  }

  function handleCategoryDownload() {
    downloadCategoryFeedback()
    setCategoryDownloaded(true)
  }

  return (
    <div className="screen">
      <TopBar onBack={onBack} eyebrow="Betyg & ändringar → backend" title="Synka" />
      <div className="screen-body">
        <div className="hint">
          Betyg (gillar/ogillar/vägrar) sparas bara i den här telefonens webbläsare — de syns
          inte på andras telefoner förrän de synkas. Ladda ner en export här, klistra sedan in
          filens innehåll i en Claude Code-chatt och be den synka den — då uppdateras{' '}
          <code>public/data/feedback.json</code> så alla enheter kan se samma betyg.
        </div>

        <div className="synka-stats">
          <div className="synka-stat"><strong>{ratedRecipes}</strong> recept med betyg på den här enheten</div>
          <div className="synka-stat"><strong>{changedDays}</strong> dagar med ändrad matsedel på den här enheten</div>
          <div className="synka-stat"><strong>{categoryCorrections.length}</strong> flaggade Fynd-kategorier på den här enheten</div>
        </div>

        <button type="button" className="export-btn synka-download-btn" onClick={handleDownload}>
          ⬇ Exportera data
        </button>
        {downloaded && <div className="synka-downloaded">✓ Nedladdad — klistra in i en Claude Code-chatt för att synka.</div>}

        {categoryCorrections.length > 0 && (
          <>
            <div className="hint synka-category-hint">
              Har du flaggat fel kategori på erbjudanden i Fynd (håll in en vara)? Den fulla
              exporten ovan innehåller redan de flaggningarna, men du kan också exportera bara
              dem — klistra in i en Claude Code-chatt för att rätta kategoriseringen.
            </div>
            <button type="button" className="export-btn synka-download-btn" onClick={handleCategoryDownload}>
              ⬇ Exportera kategori-flaggningar
            </button>
            {categoryDownloaded && <div className="synka-downloaded">✓ Nedladdad — klistra in i en Claude Code-chatt för att synka.</div>}
          </>
        )}
      </div>
    </div>
  )
}
