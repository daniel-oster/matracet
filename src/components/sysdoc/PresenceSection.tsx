export default function PresenceSection() {
  return (
    <div className="doc-section">
      <h2>Närvaro &amp; Vårdnad — Side A</h2>
      <p className="section-sub">
        Presence &amp; Custody Resolver · implementerad vecka 21, 2026
      </p>

      {/* ── Arkitekturbeslut ────────────────────────────────────────────── */}
      <h3>Arkitekturbeslut: Side A vs Side B</h3>
      <div className="callout info" style={{ marginBottom: 16 }}>
        <span className="callout-icon">⚡</span>
        <div className="callout-body">
          <strong>Envägs-beroende:</strong> Side B (Måltider) läser Side A (Närvaro) —
          Side A skriver <em>aldrig</em> till Side B.
        </div>
      </div>
      <table className="field-table" style={{ marginBottom: 24 }}>
        <thead>
          <tr><th>Sida</th><th>Domän</th><th>Karaktär</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Side A — Livet / Närvaro</strong></td>
            <td>Vem är hemma, när, vilka hårda villkor finns</td>
            <td>Fakta · stabil · ändras sällan</td>
          </tr>
          <tr>
            <td><strong>Side B — Måltider</strong></td>
            <td>Vad ska lagas, rester, preferenser</td>
            <td>Beslut · läser Side A · ej implementerad ännu</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 24 }}>
        Grundprincipen: <strong style={{ color: 'var(--text)' }}>allt är en versionerad återkommande regel med glesa undantag.</strong>{' '}
        Ingen speciallogik för "varannan vecka" — vårdnaden är bara ytterligare en återkommande regel.
        Det gör att lösaren hanterar överlappande perioder (t.ex. vardagsregel + helgregel) utan
        specialfall.
      </p>

      {/* ── Entiteter ───────────────────────────────────────────────────── */}
      <h3>Entiteter</h3>

      <h4 style={{ marginTop: 16, marginBottom: 4 }}>Person</h4>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 8 }}>
        Verklig människa — enbart identitet. All närvaro-logik bor i regler, inte i Person.
      </p>
      <table className="field-table" style={{ marginBottom: 16 }}>
        <thead><tr><th>Fält</th><th>Typ</th><th>Beskrivning</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">id</span></td><td>string</td><td>Unikt id</td></tr>
          <tr><td><span className="field-name">name</span></td><td>string</td><td>Visningsnamn</td></tr>
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Seed-data:</p>
      <table className="field-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>id</th><th>Namn</th><th>Roll</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">daniel</span></td><td>Daniel</td><td>Förälder</td></tr>
          <tr><td><span className="field-name">sarah</span></td><td>Sarah</td><td>Dotter, 15 år</td></tr>
          <tr><td><span className="field-name">annabelle</span></td><td>Annabelle</td><td>Dotter, 11 år</td></tr>
          <tr><td><span className="field-name">erika</span></td><td>Erika</td><td>Daniels flickvän</td></tr>
        </tbody>
      </table>

      <h4 style={{ marginTop: 16, marginBottom: 4 }}>Group</h4>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 8 }}>
        Namngiven uppsättning personer som äter tillsammans. En måltid planeras för en grupp,
        inte en individ. Portioner = antal aktiva gruppmedlemmar.
      </p>
      <table className="field-table" style={{ marginBottom: 16 }}>
        <thead><tr><th>Fält</th><th>Typ</th><th>Beskrivning</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">id</span></td><td>string</td><td>Unikt id</td></tr>
          <tr><td><span className="field-name">name</span></td><td>string</td><td>Visningsnamn</td></tr>
          <tr><td><span className="field-name">memberPersonIds</span></td><td>string[]</td><td>Person-ids som ingår</td></tr>
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Seed-data:</p>
      <table className="field-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>id</th><th>Namn</th><th>Medlemmar</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">daniel-barn</span></td><td>Daniel + barn</td><td>Daniel, Sarah, Annabelle</td></tr>
          <tr><td><span className="field-name">daniel-erika</span></td><td>Daniel + Erika</td><td>Daniel, Erika</td></tr>
          <tr><td><span className="field-name">daniel</span></td><td>Daniel</td><td>Daniel (solo)</td></tr>
        </tbody>
      </table>

      <h4 style={{ marginTop: 16, marginBottom: 4 }}>PresenceRule</h4>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 8 }}>
        Deklarerar att en grupp är aktiv på ett återkommande schema inom ett giltighetsfönster.
        Cadence <code>BIWEEKLY</code> kräver ett <code>anchorDate</code> som definierar
        veckoparitet (jämn = ankarvecka).
      </p>
      <table className="field-table" style={{ marginBottom: 8 }}>
        <thead><tr><th>Fält</th><th>Typ</th><th>Beskrivning</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">id</span></td><td>string</td><td>Unikt id</td></tr>
          <tr><td><span className="field-name">groupId</span></td><td>string</td><td>Grupp som aktiveras när regeln gäller</td></tr>
          <tr><td><span className="field-name">cadence</span></td><td>WEEKLY | BIWEEKLY</td><td>Upprepningstakt</td></tr>
          <tr><td><span className="field-name">weekdays</span></td><td>Weekday[]</td><td>Veckodagar regeln gäller (1=Mån … 7=Sön)</td></tr>
          <tr><td><span className="field-name">anchorDate</span></td><td>ISO-datum | null</td><td>Referensdatum för BIWEEKLY-paritet</td></tr>
          <tr><td><span className="field-name">validFrom</span></td><td>ISO-datum</td><td>Startdatum (inklusivt)</td></tr>
          <tr><td><span className="field-name">validUntil</span></td><td>ISO-datum | null</td><td>Slutdatum (inklusivt); null = öppet</td></tr>
          <tr><td><span className="field-name">priority</span></td><td>number</td><td>Högst vinner vid konflikt; default 0</td></tr>
        </tbody>
      </table>
      <div className="callout tip" style={{ marginBottom: 20 }}>
        <span className="callout-icon">📐</span>
        <div className="callout-body">
          <strong>BIWEEKLY-paritet:</strong> räknas på ISO-veckostart (måndag), inte rå dagskillnad.
          Antal hela veckor mellan <code>anchorDate</code>:s måndag och målveckans måndag — jämnt tal = regeln gäller.
          PHASE_FLIP-overrides adderar 1 per stycken (mod 2) för att flytta paritet framåt.
        </div>
      </div>

      <h4 style={{ marginTop: 16, marginBottom: 4 }}>Override</h4>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 8 }}>
        Glest per-datum-undantag. Lagras bara när verkligheten avviker från reglerna.
        Overrides vinner alltid över regler.
      </p>
      <table className="field-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>Typ</th><th>Effekt</th><th>Extra fält</th></tr></thead>
        <tbody>
          <tr>
            <td><span className="field-name">SET_GROUP</span></td>
            <td>Tvinga en specifik grupp aktiv denna dag</td>
            <td><code>groupId</code></td>
          </tr>
          <tr>
            <td><span className="field-name">CLEAR</span></td>
            <td>Ingen grupp aktiv denna dag (t.ex. Daniel bortrest)</td>
            <td>—</td>
          </tr>
          <tr>
            <td><span className="field-name">PHASE_FLIP</span></td>
            <td>Byt paritet på en BIWEEKLY-regel fr.o.m. detta datum</td>
            <td><code>appliesToRuleId</code></td>
          </tr>
        </tbody>
      </table>

      <h4 style={{ marginTop: 16, marginBottom: 4 }}>DayPlan (härlett — sparas ej)</h4>
      <table className="field-table" style={{ marginBottom: 24 }}>
        <thead><tr><th>Fält</th><th>Typ</th><th>Beskrivning</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">date</span></td><td>ISO-datum</td><td>Datum</td></tr>
          <tr><td><span className="field-name">activeGroup</span></td><td>Group | null</td><td>Aktiv grupp (null = ingen hemma)</td></tr>
          <tr><td><span className="field-name">presentPersons</span></td><td>Person[]</td><td>Gruppens medlemmar</td></tr>
          <tr><td><span className="field-name">portions</span></td><td>number</td><td>Antal portioner (= antal personer)</td></tr>
        </tbody>
      </table>

      {/* ── Resolver-algoritm ───────────────────────────────────────────── */}
      <h3>Resolver-algoritm</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 12 }}>
        <code>resolvePresence(date)</code> → <code>DayPlan</code> &nbsp;·&nbsp;
        <code>resolvePresenceRange(start, end)</code> → <code>DayPlan[]</code>
      </p>
      <ol style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 2, paddingLeft: 20, marginBottom: 24 }}>
        <li>Hitta alla <code>PresenceRule</code> där <code>validFrom ≤ datum ≤ (validUntil ?? +∞)</code>.</li>
        <li>Testa om varje regel <em>utlöses</em>: WEEKLY = rätt veckodag; BIWEEKLY = rätt veckodag OCH jämn veckoparitet (efter PHASE_FLIP).</li>
        <li>Samla utlösta regler och välj högst <code>priority</code> (lika = lägst <code>id</code> lexikografiskt).</li>
        <li>Tillämpa overrides sist — de vinner alltid (SET_GROUP eller CLEAR).</li>
        <li>Returnera <code>DayPlan</code> med aktiv grupp och härledda fält.</li>
      </ol>

      {/* ── Vårdnadsmönster (§3-tabell) ─────────────────────────────────── */}
      <h3>Verkligt vårdnadsmönster — kanoniskt exempel</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 12 }}>
        Barnen bor hos Daniel varannan fredag→fredag (<em>barnvecka hos pappa</em>).
        Varje vecka — oavsett vars vecka det är — gäller dessutom:
        måndag och onsdag hämtar Daniel barnen från skolan och ger dem middag.
        Tisdag och torsdag har mamman dem. Det leder till två stackade regler:
      </p>
      <table className="field-table" style={{ marginBottom: 16 }}>
        <thead><tr><th>Regel-id</th><th>Cadence</th><th>Veckodagar</th><th>Anchor</th></tr></thead>
        <tbody>
          <tr>
            <td><span className="field-name">mon-wed-weekly</span></td>
            <td>WEEKLY</td>
            <td>Mån, Ons</td>
            <td>—</td>
          </tr>
          <tr>
            <td><span className="field-name">weekend-biweekly</span></td>
            <td>BIWEEKLY</td>
            <td>Fre, Lör, Sön</td>
            <td>2026-05-22</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
        Resulterande middagsansvar per dag i ett 14-dagarscykel:
      </p>
      <table className="field-table" style={{ marginBottom: 24 }}>
        <thead>
          <tr><th>Dag</th><th>Daniels vecka</th><th>Frisvecka</th></tr>
        </thead>
        <tbody>
          {([
            ['Mån', 'Daniel + barn', 'Daniel + barn'],
            ['Tis', '(mamman)', '(mamman)'],
            ['Ons', 'Daniel + barn', 'Daniel + barn'],
            ['Tor', '(mamman)', '(mamman)'],
            ['Fre', 'Daniel + barn', '(mamman)'],
            ['Lör', 'Daniel + barn', '(mamman)'],
            ['Sön', 'Daniel + barn', '(mamman)'],
          ] as [string, string, string][]).map(([day, danielWeek, offWeek]) => (
            <tr key={day}>
              <td><strong>{day}</strong></td>
              <td>{danielWeek}</td>
              <td style={{ color: offWeek.startsWith('(') ? 'var(--muted)' : undefined }}>{offWeek}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Ej implementerat ────────────────────────────────────────────── */}
      <h3>Ej implementerat ännu</h3>
      <div className="callout warn">
        <span className="callout-icon">🚧</span>
        <div className="callout-body">
          <strong>Planeras i Prompt 2 &amp; 3:</strong>
          aktiviteter (Sarahs dans/teater/ridning), tidsfönster, lämning-tid-konflikter,
          Erikas alternerande ons→fre-rytm, måltidslogik, rester och preferenser.
          Schemastrukturen stöder redan ytterligare <code>PresenceRule</code>-poster — ingen
          schemaändring krävs.
        </div>
      </div>
    </div>
  )
}
