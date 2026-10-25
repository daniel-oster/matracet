import { useState } from 'react'
import { useFeedback } from '../../hooks/useFeedback'
import { useWeekPlan } from '../../hooks/useWeekPlan'
import { useCategoryFeedback } from '../../hooks/useCategoryFeedback'
import { downloadLocalData, downloadCategoryFeedback } from '../../lib/exportData'
import { getToken, setToken, clearToken } from '../../lib/githubSync'
import { pushNow, seedKnownSha } from '../../lib/syncPusher'
import { hydrateFromSync } from '../../lib/syncHydration'
import { useSyncStatus } from '../../lib/syncStatus'
import { hardRefresh } from '../../lib/hardRefresh'
import NotisSettings from '../NotisSettings'
import TopBar from '../TopBar'

interface Props {
  onBack: () => void
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'aldrig'
  return new Date(iso).toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** "Hantera appen": everything about the app itself rather than about food — sync, push
 * notifications, fetching the latest version, and the manual export fallback. Syncing is
 * automatic (syncPusher.ts + the foreground hydration in App.tsx), so this screen is for
 * setting it up and checking on it, not something to visit after every edit. */
export default function HanteraView({ onBack }: Props) {
  const { data: feedback } = useFeedback()
  const { data: weekplan } = useWeekPlan()
  const { entries: categoryCorrections } = useCategoryFeedback()
  const [downloaded, setDownloaded] = useState(false)
  const [categoryDownloaded, setCategoryDownloaded] = useState(false)

  const [tokenInput, setTokenInput] = useState(() => getToken() ?? '')
  const [hasToken, setHasToken] = useState(() => getToken() !== null)
  const [showToken, setShowToken] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const status = useSyncStatus()

  const ratedRecipes = Object.keys(feedback).length
  const changedDays = Object.keys(weekplan).length

  function handleSaveToken() {
    const trimmed = tokenInput.trim()
    if (!trimmed) return
    setToken(trimmed)
    setHasToken(true)
    void handleSyncNow()
  }

  function handleClearToken() {
    clearToken()
    setTokenInput('')
    setHasToken(false)
  }

  async function handleSyncNow() {
    setSyncing(true)
    try {
      // Hydrate-then-push, not the other way round (PR #83 review fix): pushState replaces
      // sync/state.json wholesale, so pushing first can overwrite another device's newer
      // push before this device has ever looked at it.
      const outcome = await hydrateFromSync(false)
      if (outcome.sha !== undefined) seedKnownSha(outcome.sha, outcome.storesKey)
      await pushNow()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="screen">
      <TopBar onBack={onBack} eyebrow="Inställningar" title="Hantera appen" />
      <div className="screen-body hantera-body">
        <section className="hantera-card">
          <div className="hantera-card-title">🔄 Synk mellan enheter</div>
          {hasToken ? (
            <>
              <p className="nytt-hint">
                {status.lastError ? '⚠ Synken fungerar inte just nu – allt är sparat på den här enheten och skickas när det går igen.' : '✓ Påslagen.'}{' '}
                Ändringar sparas automatiskt några sekunder efter att du gjort dem, och hämtas från andra
                enheter när du öppnar appen. Du behöver inte trycka på något.
              </p>
              <div className="synka-stats synka-status">
                <div className="synka-stat">Senast skickat: <strong>{formatTimestamp(status.lastPushAt)}</strong></div>
                <div className="synka-stat">Senast hämtat: <strong>{formatTimestamp(status.lastHydrationAt)}</strong></div>
                {status.lastError && <div className="synka-stat synka-stat--error">Fel: {status.lastError}</div>}
              </div>
              <button type="button" className="hantera-secondary-btn" onClick={() => void handleSyncNow()} disabled={syncing}>
                {syncing ? 'Synkar…' : '↻ Synka nu ändå'}
              </button>
            </>
          ) : (
            <p className="nytt-hint">
              Av – allt sparas bara på den här enheten. Spara en GitHub-token nedan så delas betyg, matsedel,
              inköpslista och annat automatiskt mellan telefonerna.
            </p>
          )}

          <details className="hantera-details" open={!hasToken}>
            <summary>{hasToken ? 'Byt eller ta bort token' : 'Lägg in token'}</summary>
            <div className="synka-token-field">
              <label htmlFor="synka-token">Fine-grained personal access token (bara detta repo, Contents read/write)</label>
              <div className="synka-token-input-row">
                <input
                  id="synka-token"
                  type={showToken ? 'text' : 'password'}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  placeholder="github_pat_…"
                />
                <button
                  type="button"
                  className="synka-token-eye"
                  onClick={() => setShowToken(v => !v)}
                  aria-label={showToken ? 'Dölj token' : 'Visa token'}
                  aria-pressed={showToken}
                  title={showToken ? 'Dölj token' : 'Visa token'}
                >
                  {showToken ? '🙈' : '👁'}
                </button>
              </div>
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
            </div>
          </details>
        </section>

        <section className="hantera-card">
          <div className="hantera-card-title">🔔 Notiser</div>
          <NotisSettings />
        </section>

        <section className="hantera-card">
          <div className="hantera-card-title">⟳ Appen</div>
          <p className="nytt-hint">
            Hämtar senaste versionen av appen och dess data (nya recept, veckans erbjudanden). Dina egna val
            på den här enheten rörs inte.
          </p>
          <button type="button" className="hantera-secondary-btn" onClick={hardRefresh}>
            ⟳ Hämta senaste versionen
          </button>
        </section>

        <details className="synka-manual-export">
          <summary>Manuell export (reserv om synken inte fungerar)</summary>

          <div className="synka-stats">
            <div className="synka-stat"><strong>{ratedRecipes}</strong> måltider med betyg på den här enheten</div>
            <div className="synka-stat"><strong>{changedDays}</strong> dagar med ändrad matsedel på den här enheten</div>
            <div className="synka-stat"><strong>{categoryCorrections.length}</strong> flaggade Fynd-kategorier på den här enheten</div>
          </div>

          <button type="button" className="export-btn synka-download-btn" onClick={() => { downloadLocalData(); setDownloaded(true) }}>
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
              <button type="button" className="export-btn synka-download-btn" onClick={() => { downloadCategoryFeedback(); setCategoryDownloaded(true) }}>
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
