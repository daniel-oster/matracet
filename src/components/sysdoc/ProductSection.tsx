export default function ProductSection() {
  return (
    <div className="doc-section">
      <h2>Produktbeskrivning</h2>
      <p className="section-sub">
        Matracet · En del av <em>Life - as it should be</em> · Sammanställd vecka 21, 2026
      </p>

      {/* ── Bakgrund ─────────────────────────────────────────────────────── */}
      <h3>Bakgrund</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>
        Daniel vill bygga <strong style={{ color: 'var(--text)' }}>Life - as it should be</strong> — en app
        som hjälper med det praktiska i livet. Matplanering valdes som första domän eftersom det är där han
        sliter mest. Hushållet har tre ätare med olika kostbehov som måste hanteras varje dag:
      </p>

      <table className="field-table" style={{ marginBottom: 24 }}>
        <thead>
          <tr><th>Vem</th><th>Roll</th><th>Kostbehov</th><th>Gillar</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Daniel</strong></td>
            <td><span style={{ color: 'var(--muted)', fontSize: 12 }}>Förälder</span></td>
            <td>Lågt natrium, högt blodtryck</td>
            <td>Svamp, fisk, starka smaker</td>
          </tr>
          <tr>
            <td><strong>Sarah</strong></td>
            <td><span style={{ color: 'var(--muted)', fontSize: 12 }}>Dotter · 15 år</span></td>
            <td>—</td>
            <td>Pasta, curry, avokado</td>
          </tr>
          <tr>
            <td><strong>Annabelle</strong></td>
            <td><span style={{ color: 'var(--muted)', fontSize: 12 }}>Dotter · 11 år</span></td>
            <td>Vegan</td>
            <td>Vegansk mat, pasta</td>
          </tr>
          <tr>
            <td><strong>Erika</strong></td>
            <td><span style={{ color: 'var(--muted)', fontSize: 12 }}>Daniels flickvän</span></td>
            <td>—</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>

      {/* ── Filosofi ─────────────────────────────────────────────────────── */}
      <h3>Filosofi — Personal MVP</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 12 }}>
        Detta är <strong style={{ color: 'var(--text)' }}>inte en kommersiell produkt</strong> — i alla fall
        inte än. Appen byggs för Daniels familj först, och bli kommersiell produkt enbart om värdet bevisas
        i hans eget liv.
      </p>

      <table className="field-table" style={{ marginBottom: 12 }}>
        <thead>
          <tr><th>Princip</th><th>Konsekvens</th></tr>
        </thead>
        <tbody>
          <tr><td>Ingen backend</td><td>Statisk React-app, hostad gratis på GitHub Pages</td></tr>
          <tr><td>All data i Git</td><td>Recept och veckomenyer som filer — versionshistorik gratis</td></tr>
          <tr><td>Manuell intelligens</td><td>Veckomeny pratas fram med Claude, commitas som JSON</td></tr>
          <tr><td>Ingen auth</td><td>Personlig app — ingen inloggning, inga GDPR-flöden</td></tr>
          <tr><td>localStorage</td><td>Avbockning i butiken — försvinner det är det inget drama</td></tr>
        </tbody>
      </table>

      <div className="callout warn" style={{ marginBottom: 24 }}>
        <span className="callout-icon">🚫</span>
        <div className="callout-body">
          <strong>MVP gör inte:</strong>
          automatisk menygenerering · Alexa-integration · redigerbara recept i UI ·
          näringskalkyl · prisjakt · kalenderhantering
        </div>
      </div>

      {/* ── MVP-scope ────────────────────────────────────────────────────── */}
      <h3>MVP-scope</h3>
      <table className="field-table" style={{ marginBottom: 24 }}>
        <thead>
          <tr><th>Funktion</th><th>Typ</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>10–15 recept</td>
            <td><span style={{ color: 'var(--muted)', fontSize: 12 }}>Manuellt innehåll</span></td>
            <td><span className="tag vegan">✓ 60+ recept</span></td>
          </tr>
          <tr>
            <td>Filofax-vy i React (5 flikar)</td>
            <td><span style={{ color: 'var(--muted)', fontSize: 12 }}>Automatisk rendering</span></td>
            <td><span className="tag vegan">✓ Klart</span></td>
          </tr>
          <tr>
            <td>Veckomeny som JSON</td>
            <td><span style={{ color: 'var(--muted)', fontSize: 12 }}>Manuell, genererad med Claude</span></td>
            <td><span className="tag vegan">✓ Klart</span></td>
          </tr>
          <tr>
            <td>Inköpslista (aggregerad från recept)</td>
            <td><span style={{ color: 'var(--muted)', fontSize: 12 }}>Automatisk</span></td>
            <td><span className="tag neutral">⚠ Platshållare</span></td>
          </tr>
          <tr>
            <td>"Har hemma"-bockning från skafferi</td>
            <td><span style={{ color: 'var(--muted)', fontSize: 12 }}>localStorage + pantry.json</span></td>
            <td><span className="tag neutral">⚠ Ej kopplat</span></td>
          </tr>
          <tr>
            <td>Avbockning i butiken</td>
            <td><span style={{ color: 'var(--muted)', fontSize: 12 }}>localStorage</span></td>
            <td><span className="tag vegan">✓ Klart</span></td>
          </tr>
          <tr>
            <td>Deploy till GitHub Pages</td>
            <td><span style={{ color: 'var(--muted)', fontSize: 12 }}>Automatisk vid push</span></td>
            <td><span className="tag vegan">✓ Klart</span></td>
          </tr>
        </tbody>
      </table>

      {/* ── Roadmap ──────────────────────────────────────────────────────── */}
      <h3>Roadmap efter MVP</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: 6 }}>V2 — "Min app, inte en app"</div>
          <ul className="convention-list" style={{ margin: 0 }}>
            <li><span className="conv-key">UI</span><span>Lägg till egna recept (fritext &amp; URL-import)</span></li>
            <li><span className="conv-key">Frukost</span><span>Frukostmodul med 3–5 default-rutiner</span></li>
            <li><span className="conv-key">Kalender</span><span>Tidsbegränsade middagar — <em>delvis implementerat:</em> aktivitets- och matfönster­resolvern (Side A) hanterar hårda tidskonflikter; måltidslogiken (Side B) återstår</span></li>
            <li><span className="conv-key">Pris</span><span>Reklamblad &amp; prisjämförelse för 2–3 svenska kedjor</span></li>
          </ul>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent2)', marginBottom: 6 }}>V3 — "Appen som sparar pengar"</div>
          <ul className="convention-list" style={{ margin: 0 }}>
            <li><span className="conv-key">Meny</span><span>Optimera meny baserat på veckans rea-priser</span></li>
            <li><span className="conv-key">Butiker</span><span>Dela inköpslista på flera butiker</span></li>
            <li><span className="conv-key">Budget</span><span>Budget-skjutreglage ("hur stramt denna vecka?")</span></li>
          </ul>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: 6 }}>V4+ — "Appen som tar hand om hela måltidsekonomin"</div>
          <ul className="convention-list" style={{ margin: 0 }}>
            <li><span className="conv-key">Näring</span><span>Näringsöversikt över tid</span></li>
            <li><span className="conv-key">Lunch</span><span>Matlådor &amp; restanvändning</span></li>
            <li><span className="conv-key">OCR</span><span>Foto-recept (skanna receptkort)</span></li>
            <li><span className="conv-key">Röst</span><span>Alexa / Google Home / Siri Shortcuts</span></li>
            <li><span className="conv-key">Familj</span><span>Familjedelning med flera konton</span></li>
          </ul>
        </div>
      </div>

      {/* ── Risker ───────────────────────────────────────────────────────── */}
      <h3>Risker att hålla koll på</h3>
      <ul className="convention-list">
        <li>
          <span className="conv-key" style={{ minWidth: 120 }}>Innehåll</span>
          <span>Receptbiblioteket är inte trivialt. 50+ korrekt taggade recept = hundratals timmars arbete. Plan: LLM-genererade utkast som redigeras.</span>
        </li>
        <li>
          <span className="conv-key" style={{ minWidth: 120 }}>Tröghet</span>
          <span>"Förslag jag inte gillar"-spiralen: om första veckan är okej och andra träig riskerar appen att överges. Lärningsslingan måste kännas snabb.</span>
        </li>
        <li>
          <span className="conv-key" style={{ minWidth: 120 }}>Socialt</span>
          <span>Mat handlar om humör, vana, kultur. Algoritmen ska föreslå, aldrig diktera.</span>
        </li>
        <li>
          <span className="conv-key" style={{ minWidth: 120 }}>Hälsopåstå...</span>
          <span>"Sänker blodtryck" är ett medicinskt påstående i Sverige. Var försiktig med språket (gäller marknadsversion).</span>
        </li>
        <li>
          <span className="conv-key" style={{ minWidth: 120 }}>GDPR</span>
          <span>Hälsouppgifter är känsliga personuppgifter. Barns data har extra skydd. Lokal lagring i MVP undviker hela frågan.</span>
        </li>
      </ul>

      {/* ── Konkurrenter ─────────────────────────────────────────────────── */}
      <h3 style={{ marginTop: 28 }}>Konkurrenter</h3>
      <div className="callout info" style={{ marginBottom: 16 }}>
        <span className="callout-icon">🎯</span>
        <div className="callout-body">
          <strong>Matracets unika position</strong>
          Svensk familjeplanerare som tar hänsyn till olika ätare, hälsobehov och pris över flera butiker — och lär sig vad just denna familj gillar.
        </div>
      </div>
      <table className="field-table">
        <thead>
          <tr><th>Produkt</th><th>Vad saknas</th></tr>
        </thead>
        <tbody>
          <tr><td>Mealime</td><td>Engelska, ingen prisjakt, hanterar inte olika ätare elegant</td></tr>
          <tr><td>Paprika Recipe Manager</td><td>Bibliotek men ingen planeringsintelligens</td></tr>
          <tr><td>Whisk / Samsung Food</td><td>AI-menyer men ingen svensk kontext</td></tr>
          <tr><td>Tasteline / Köket.se</td><td>Receptsidor utan familjelogik</td></tr>
          <tr><td>Matspar / Matpriskollen</td><td>Prisverktyg utan veckomeny</td></tr>
          <tr><td>ICA / Coop-appar</td><td>Bundna till en kedja</td></tr>
        </tbody>
      </table>
    </div>
  )
}
