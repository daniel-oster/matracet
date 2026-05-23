export default function MealsSection() {
  return (
    <div className="doc-section">
      <h2>Matplan &amp; Preferenser — Side B</h2>
      <p className="section-sub">
        Meal Slots, Cooking Events &amp; Preference Checks · implementerat vecka 21, 2026
      </p>

      <div className="callout info" style={{ marginBottom: 16 }}>
        <span className="callout-icon">⚡</span>
        <div className="callout-body">
          <strong>Envägs-beroende:</strong> Side B läser Side A (DayPlan, Person) och påverkar
          den aldrig. Middagsplanen behandlar varje days facts — vem som är hemma, hur många
          portioner, matfönstret — som oföränderliga indata.
        </div>
      </div>

      {/* ── Filosofi ────────────────────────────────────────────────────── */}
      <h3>Filosofi — manuell intelligens, SHOW inte PLAN</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>
        Matracets grundprincip: <strong style={{ color: 'var(--text)' }}>manuell intelligens</strong> —
        människan bestämmer menyn och den committas som JSON. Appen{' '}
        <strong style={{ color: 'var(--text)' }}>visar</strong> varje slots fakta och{' '}
        <strong style={{ color: 'var(--text)' }}>varnar</strong> (kvantitet, avstånd, kost) men
        auto-fyller aldrig. Modellen är formad så att ett framtida{' '}
        <strong style={{ color: 'var(--text)' }}>SUGGEST</strong>-steg (föreslå 2–3 passar­ande
        rätt per slot) och ett <strong style={{ color: 'var(--text)' }}>PLAN</strong>-steg
        (fylla en fjortondagarscykel automatiskt) kan läggas till utan att bygga om.
      </p>

      {/* ── MealSlot ────────────────────────────────────────────────────── */}
      <h3>MealSlot</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 8 }}>
        Atomisk planeringsenhett — en slot per dag = middag. Fältet <code>occasion</code> finns
        för framtida lunch/frukost men enbart <code>DINNER</code> används nu.
      </p>
      <table className="field-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>Fält</th><th>Typ</th><th>Beskrivning</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">date</span></td><td>ISO-datum</td><td>Datum</td></tr>
          <tr><td><span className="field-name">occasion</span></td><td>DINNER</td><td>Måltidstillfälle (enbart DINNER nu)</td></tr>
          <tr><td><span className="field-name">dayPlan</span></td><td>DayPlan</td><td>Oföränderliga Side-A-fakta (grupp, portioner, matfönster)</td></tr>
          <tr><td><span className="field-name">assignment</span></td><td>MealAssignment | null</td><td>Beslutet för denna slot</td></tr>
        </tbody>
      </table>

      {/* ── Recept ──────────────────────────────────────────────────────── */}
      <h3>Recept — återanvänd befintlig JSON</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 8 }}>
        Appen har redan 60+ recept i <code>public/data/recipes/</code>. Side B återanvänder
        dem utan en parallell receptsamling. Vegansk/vegetarisk-status deriveras från det
        befintliga <code>kategorier</code>-fältet:
      </p>
      <table className="field-table" style={{ marginBottom: 16 }}>
        <thead><tr><th>kategorier innehåller</th><th>Vegansk?</th></tr></thead>
        <tbody>
          <tr><td><code>"vegansk"</code></td><td>Ja</td></tr>
          <tr><td><code>"vegetarisk"</code> / <code>"kott"</code> / <code>"fisk"</code></td><td>Nej</td></tr>
          <tr><td>(inget av ovanstående)</td><td>Okänd — varnar mjukt</td></tr>
        </tbody>
      </table>

      {/* ── CookingEvent ────────────────────────────────────────────────── */}
      <h3>CookingEvent</h3>
      <div className="callout tip" style={{ marginBottom: 12 }}>
        <span className="callout-icon">📐</span>
        <div className="callout-body">
          <strong>Ingen hållbarhet — överhuvudtaget.</strong>{' '}
          CookingEvent har inget <code>lastsDays</code>- eller <code>keepsDays</code>-fält.
          Hur länge en tillagning räcker är aldrig ett lagrat beslut — det framgår av att
          person-meals-poolen töms slot för slot. Receptet har heller inget hållbarhets­fält.
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 8 }}>
        En tillagning refererar alltid ett <em>riktigt recept</em> (aldrig fritext). Kvantiteten
        anges enbart i <strong>person-meals</strong> — totalt antal person-ätanden den ger.
      </p>
      <table className="field-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>Fält</th><th>Typ</th><th>Beskrivning</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">id</span></td><td>string</td><td>Unikt id</td></tr>
          <tr><td><span className="field-name">date</span></td><td>ISO-datum</td><td>Lagningsdatum</td></tr>
          <tr><td><span className="field-name">recipeId</span></td><td>string (slug)</td><td>Alltid ett riktigt recept — ingen fritext</td></tr>
          <tr><td><span className="field-name">personMeals</span></td><td>int</td><td>Totalt antal person-ätanden som basen ger</td></tr>
        </tbody>
      </table>

      {/* ── MealAssignment ──────────────────────────────────────────────── */}
      <h3>MealAssignment</h3>
      <table className="field-table" style={{ marginBottom: 8 }}>
        <thead><tr><th>kind</th><th>Innebör</th><th>cookingEventId</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">FRESH_COOK</span></td><td>Lagas denna dag</td><td>Denna days CookingEvent</td></tr>
          <tr><td><span className="field-name">LEFTOVER</span></td><td>Rester från en tidigare tillagning</td><td>Det tidigare CookingEvent-id:t</td></tr>
          <tr><td><span className="field-name">EAT_OUT</span></td><td>Äter ute</td><td>null</td></tr>
          <tr><td><span className="field-name">NO_MEAL</span></td><td>Ingen middag planerad</td><td>null</td></tr>
          <tr><td><span className="field-name">OTHER</span></td><td>Annat (fritext i label)</td><td>null</td></tr>
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.7 }}>
        "Äter ute" och "ingen middag" är förstaklassiga tillstånd — inte tomma slots. Person-meals
        är valutan: ett CookingEvent producerar <code>personMeals</code> ätanden; varje slot som
        drar från det (FRESH_COOK + LEFTOVER) konsumerar <code>portions</code> person-meals
        (från DayPlan). Poolen töms slot för slot.
      </p>

      {/* ── De två kontrollerna ─────────────────────────────────────────── */}
      <h3>De två kontrollerna — varna, aldrig blockera</h3>
      <div className="callout warn" style={{ marginBottom: 16 }}>
        <span className="callout-icon">⚠️</span>
        <div className="callout-body">
          Kontrollerna <strong>varnar</strong> men <strong>blockerar aldrig</strong>. Appen
          råder, människan beslutar — i linje med "manuell intelligens"-filosofin.
        </div>
      </div>
      <table className="field-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>Kontroll</th><th>Trigger</th><th>Svårighetsgrad</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>Kvantitet (person-meal pool)</strong></td>
            <td>Totalt planerade portioner &gt; <code>personMeals</code> på tillagningen</td>
            <td>SOFT</td>
          </tr>
          <tr>
            <td><strong>Avstånd / repeat-gap (persons-derived)</strong></td>
            <td>Samma recept serveras inom <code>maxMinRepeatGapDays</code> dagar (tas från den som är känsligast)</td>
            <td>SOFT</td>
          </tr>
        </tbody>
      </table>

      {/* ── Preferenser ─────────────────────────────────────────────────── */}
      <h3>MealPreference — extensibel lista</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 8 }}>
        Preferenser är en utökningsbar lista med <strong>styrka</strong> (HARD/SOFT) och{' '}
        <strong>ursprung</strong> (PERSON/PLAN). Nya regler läggs till som data, inte som ny
        kod. Person-härledda preferenser är presence-gatade: de gäller bara de dagar den
        personen är i aktiv grupp.
      </p>
      <table className="field-table" style={{ marginBottom: 12 }}>
        <thead><tr><th>Fält</th><th>Typ</th><th>Beskrivning</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">strength</span></td><td>HARD | SOFT</td><td>HARD = bör inte brytas; SOFT = rådgivande</td></tr>
          <tr><td><span className="field-name">origin</span></td><td>PERSON | PLAN</td><td>PERSON = presence-gatad; PLAN = alltid aktiv</td></tr>
          <tr><td><span className="field-name">personId</span></td><td>string | null</td><td>Vems preferens (PERSON-ursprung)</td></tr>
          <tr><td><span className="field-name">rule</span></td><td>PreferenceRuleSpec</td><td>Strukturerat predikat som kontrollanten utvärderar</td></tr>
        </tbody>
      </table>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Seed-preferenser:</p>
      <table className="field-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>id</th><th>Beskrivning</th><th>Styrka</th><th>Ursprung</th></tr></thead>
        <tbody>
          <tr>
            <td><span className="field-name">annabelle-vegan</span></td>
            <td>Annabelle äter veganskt — recept med <code>kategorier: ["vegetarisk"]</code> eller kött/fisk ger HARD-varning</td>
            <td>HARD</td>
            <td>PERSON (Annabelle)</td>
          </tr>
          <tr>
            <td><span className="field-name">daniel-low-sodium</span></td>
            <td>Lågt natrium / högt blodtryck — rådgivande, blockerar inte</td>
            <td>SOFT</td>
            <td>PERSON (Daniel)</td>
          </tr>
          <tr>
            <td><span className="field-name">plan-light-saturday-lunch</span></td>
            <td>Lätt lördagslunch rekommenderas — <em>dormant</em> tills lunch-slots implementeras</td>
            <td>SOFT</td>
            <td>PLAN</td>
          </tr>
        </tbody>
      </table>

      {/* ── minRepeatGapDays ────────────────────────────────────────────── */}
      <h3>minRepeatGapDays — person-attribut, presence-gatat</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 8 }}>
        Om det spelar roll att äta samma rätt för tätt ihop beror på <em>vem som äter</em>, inte
        på planen. Därför är repeat-gapet ett attribut på <code>Person</code> — hur många dagar
        som måste hoppas över mellan två serveringar av samma rätt.
      </p>
      <table className="field-table" style={{ marginBottom: 8 }}>
        <thead><tr><th>Person</th><th>minRepeatGapDays</th><th>Innebörd</th></tr></thead>
        <tbody>
          <tr><td>Daniel</td><td>0</td><td>Ingen paus krävs — äter samma rätt på rad utan problem</td></tr>
          <tr><td>Sarah</td><td>1</td><td>Minst 1 dag måste hoppas över (inte i följd)</td></tr>
          <tr><td>Annabelle</td><td>1</td><td>Minst 1 dag måste hoppas över</td></tr>
          <tr><td>Erika</td><td>0</td><td>Ingen paus krävs</td></tr>
        </tbody>
      </table>
      <div className="callout tip" style={{ marginBottom: 20 }}>
        <span className="callout-icon">📐</span>
        <div className="callout-body">
          Kontrollen tar <code>max(minRepeatGapDays)</code> bland de närvarande och varnar om
          samma recept serveras med <code>daysApart ≤ maxGap</code>. Daniel-only/Daniel+Erika
          (maxGap=0) varnar aldrig. Barn-grupper (maxGap=1) varnar på konsekutiva dagar men inte
          varannan dag. Lördagstillagad → onsdag-rester: 4 dagar isär {'>'} 1 → rent.
        </div>
      </div>

      {/* ── evaluateSlot ────────────────────────────────────────────────── */}
      <h3>evaluateSlot — ren funktion, shape för SUGGEST</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>
        <code>evaluateSlot(slot, assignment, ctx) → Warning[]</code> — kör alla tillämpliga
        kontroller och preferenser, returnerar varningar taggade HARD/SOFT. Muterar aldrig
        Side A-data. Signaturen är utformad så att ett framtida SUGGEST-steg kan anropa samma
        funktion med kandidatrecept för att ranka dem utan ändringar.
      </p>

      {/* ── Roadmap ─────────────────────────────────────────────────────── */}
      <h3>Roadmap — vad återstår</h3>
      <div className="callout warn">
        <span className="callout-icon">🚧</span>
        <div className="callout-body">
          <strong>Avsiktligt uppskjutet (bevarar "manuell intelligens"):</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            <li><strong>SUGGEST</strong> — föreslå 2–3 passande recept per slot baserat på preferenser, avstånd och grupp</li>
            <li><strong>PLAN</strong> — automatisk auto-fyllning av en fjortondagarscykel</li>
            <li><strong>Kylskåpslager</strong> — spårning av enskilda ingrediensmängder; explicitly out of scope</li>
            <li><strong>Lunch/frukost-slots</strong> — <code>occasion</code>-fältet finns; enbart DINNER nu</li>
            <li><strong>Erikas alternerande ons→fre-rytm</strong> — Side A, nästa version</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
