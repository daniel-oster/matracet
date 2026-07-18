import { useState } from 'react'
import { useFeedback } from '../../hooks/useFeedback'
import { useWeekPlan } from '../../hooks/useWeekPlan'
import { useCategoryFeedback } from '../../hooks/useCategoryFeedback'
import { downloadLocalData, downloadCategoryFeedback } from '../../lib/exportData'
import { getToken, setToken, clearToken } from '../../lib/githubSync'
import { pushNow, seedKnownSha } from '../../lib/syncPusher'
import { hydrateFromSync } from '../../lib/syncHydration'
import { useSyncStatus } from '../../lib/syncStatus'
import TopBar from '../TopBar'

interface Props {
  onBack: () => void
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'aldrig'
  return new Date(iso).toLocaleString('sv-SE')
}

export default function SynkaView({ onBack }: Props) {
  const { data: feedback } = useFeedback()
  const { data: weekplan } = useWeekPlan()
  const { entries: categoryCorrections } = useCategoryFeedback()
  const [downloaded, setDownloaded] = useState(false)
  const [categoryDownloaded, setCategoryDownloaded] = useState(false)

  const [tokenInput, setTokenInput] = useState(() => getToken() ?? '')
  const [tokenSaved, setTokenSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const status = useSyncStatus()
  const hasToken = getToken() !== null

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

  function handleSaveToken() {
    const trimmed = tokenInput.trim()
    if (!trimmed) return
    setToken(trimmed)
    setTokenSaved(true)
    void handleSyncNow()
  }

  function handleClearToken() {
    clearToken()
    setTokenInput('')
    setTokenSaved(false)
  }

  async function handleSyncNow() {
    setSyncing(true)
    try {
      // Hydrate-then-push, not the other way round (PR #83 review fix): pushState replaces
      // sync/state.json wholesale, so pushing first can overwrite another device's newer
      // push before this device has ever looked at it. Hydrating first means this device's
      // own snapshot already reflects the latest remote state before it writes anything —
      // pushNow's own merge-on-discovery (see syncPusher.ts) is the same fix for the
      // automatic debounced path; this covers the manual button even when pushNow's cached
      // sha is already warm from earlier in the session.
      const outcome = await hydrateFromSync(false)
      if (outcome.sha !== undefined) seedKnownSha(outcome.sha, outcome.storesKey)
      await pushNow()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="screen">
      <TopBar onBack={onBack} eyebrow="Enheter → GitHub" title="Synka" />
      <div className="screen-body">
        <div className="hint">
          Betyg, matsedel, inköpslista och annat sparas på den här enheten och synkas
          automatiskt till GitHub när en token är sparad nedan — andra enheter ser samma data
          efter nästa hämtning. Utan token fungerar appen precis som förut, helt lokalt.
        </div>

        <div className="synka-token-field">
          <label htmlFor="synka-token">Fine-grained personal access token (bara detta repo, Contents read/write)</label>
          <input
            id="synka-token"
            type="password"
            autoComplete="off"
            value={tokenInput}
            onChange={e => { setTokenInput(e.target.value); setTokenSaved(false) }}
            placeholder="github_pat_…"
          />
          <div className="synka-token-actions">
            <button type="button" className="export-btn synka-download-btn" onClick={handleSaveToken}>
              Spara token
            </button>
            {hasToken && (
              <button type="button" className="synka-token-clear" onClick={handleClearToken}>
                Ta bort token
              </button>
            )}
          </div>
          {tokenSaved && <div className="synka-downloaded">✓ Token sparad — synkar nu…</div>}
        </div>

        <div className="synka-stats synka-status">
          <div className="synka-stat">Senaste push: <strong>{formatTimestamp(status.lastPushAt)}</strong></div>
          <div className="synka-stat">Senaste hämtning: <strong>{formatTimestamp(status.lastHydrationAt)}</strong></div>
          {status.lastError && <div className="synka-stat synka-stat--error">Senaste fel: {status.lastError}</div>}
        </div>

        <button
          type="button"
          className="export-btn synka-download-btn"
          onClick={() => void handleSyncNow()}
          disabled={syncing || !hasToken}
        >
          {syncing ? 'Synkar…' : '↻ Synka nu'}
        </button>

        <details className="synka-manual-export">
          <summary>Manuell export (reserv om token saknas eller GitHub inte svarar)</summary>

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
        </details>
      </div>
    </div>
  )
}
