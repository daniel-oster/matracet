export default function PresenceSection() {
  return (
    <div className="doc-section">
      <h2>Närvaro &amp; Vårdnad — Side A</h2>
      <p className="section-sub">
        Presence &amp; Custody Resolver + Activity/Window Resolver · implementerat vecka 21, 2026
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

      {/* ── Entiteter (Närvaro) ─────────────────────────────────────────── */}
      <h3>Entiteter — Närvaro &amp; Vårdnad</h3>

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
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Påhittat exempel (de riktiga reglerna ligger i det privata datarepot):</p>
      <table className="field-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>Regel-id</th><th>Cadence</th><th>Veckodagar</th><th>handoverByWeekday</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">barn-varannan</span></td><td>BIWEEKLY</td><td>Mån–Sön (varannan vecka)</td><td>{'{'} 5: "16:00" {'}'}</td></tr>
          <tr><td><span className="field-name">vuxna-baslinje</span></td><td>WEEKLY</td><td>Alla dagar (baslinje, lägst prioritet)</td><td>—</td></tr>
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
        Prioritet: barn-reglerna (2) slår Vuxen B-veckoregeln (1) som slår{' '}
        <code>solo-baseline</code>-baslinjen (0). Varje dag landar därför i en bestämd
        grupp — inga "okända" dagar.
      </p>

      <h4 style={{ marginTop: 16, marginBottom: 4 }}>Override</h4>
      <table className="field-table" style={{ marginBottom: 24 }}>
        <thead><tr><th>Typ</th><th>Effekt</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">SET_GROUP</span></td><td>Tvinga en specifik grupp aktiv denna dag</td></tr>
          <tr><td><span className="field-name">CLEAR</span></td><td>Ingen grupp aktiv denna dag</td></tr>
          <tr><td><span className="field-name">PHASE_FLIP</span></td><td>Byt paritet på en BIWEEKLY-regel fr.o.m. detta datum</td></tr>
        </tbody>
      </table>

      {/* ── Aktiviteter & Matfönster ─────────────────────────────────────── */}
      <h3>Aktiviteter &amp; Matfönster</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>
        Matfönstret — det tidsspann då middagen realistiskt kan ätas tillsammans — begränsas
        av <strong style={{ color: 'var(--text)' }}>två oberoende källors</strong> hårda villkor.
        Fönstret är snittet av alla villkor som gäller den dagen.
      </p>

      <table className="field-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>Källa</th><th>Ursprung</th><th>Modellering</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>A — Överlämning</strong></td>
            <td>Strukturell, från vårdnadsarrangemanget</td>
            <td><code>handoverByWeekday</code> på <code>PresenceRule</code></td>
          </tr>
          <tr>
            <td><strong>B — Aktiviteter</strong></td>
            <td>Person-ägd, gated av närvaro</td>
            <td><code>Activity</code>-entitet med <code>affectsWindow</code></td>
          </tr>
        </tbody>
      </table>

      <h4 style={{ marginTop: 16, marginBottom: 4 }}>Activity</h4>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 8 }}>
        Återkommande aktivitet kopplad till en person. Ger bara ett villkor den dagen personen
        är <em>närvarande</em> (kontrolleras av närvaro­lösaren). Termsbunden via{' '}
        <code>validFrom/validUntil</code>.
      </p>
      <table className="field-table" style={{ marginBottom: 12 }}>
        <thead><tr><th>Fält</th><th>Typ</th><th>Beskrivning</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">personId</span></td><td>string</td><td>Ägare — styr närvaro-gating</td></tr>
          <tr><td><span className="field-name">label</span></td><td>string</td><td>Namn, t.ex. "Aktivitet E", "Aktivitet G"</td></tr>
          <tr><td><span className="field-name">weekday</span></td><td>1–7</td><td>Veckodag</td></tr>
          <tr><td><span className="field-name">startTime</span></td><td>HH:MM | null</td><td>När aktiviteten börjar. <strong>Enda obligatoriska tidsangivelse.</strong> null = tidlös.</td></tr>
          <tr><td><span className="field-name">arriveBy</span></td><td>HH:MM | null</td><td>Frivillig: när man ska vara där (smalnar cutoff)</td></tr>
          <tr><td><span className="field-name">leaveBy</span></td><td>HH:MM | null</td><td>Frivillig: när man måste hemifrån (smalnar cutoff ytterligare)</td></tr>
          <tr><td><span className="field-name">endTime</span></td><td>HH:MM | null</td><td>Frivillig: när man är hemma igen (för framtida "ät sent"-logik)</td></tr>
          <tr><td><span className="field-name">affectsWindow</span></td><td>boolean</td><td>false = tidlös/dagtids­post; visas men påverkar inte matfönstret</td></tr>
          <tr><td><span className="field-name">validFrom / validUntil</span></td><td>ISO | null</td><td>Termens giltighetsfönster</td></tr>
        </tbody>
      </table>

      <div className="callout tip" style={{ marginBottom: 20 }}>
        <span className="callout-icon">📐</span>
        <div className="callout-body">
          <strong>Fallback-kedja för effektiv avgångstid:</strong>{' '}
          <code>leaveBy → arriveBy → startTime</code>.{' '}
          En aktivitet med bara <code>startTime: "18:00"</code> ger cutoff 18:00.
          Lägger man till <code>arriveBy: "17:45"</code> sjunker cutoff till 17:45.
          Lägger man också till <code>leaveBy: "17:30"</code> sjunker den till 17:30.
          Varje valfritt fält, om det finns, smalnar bara fönstret — aldrig vidgar det.
        </div>
      </div>

      <h4 style={{ marginTop: 16, marginBottom: 4 }}>Dinnertröskel — vilka aktiviteter binder fönstret</h4>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 12 }}>
        Aktiviteter med <code>affectsWindow: true</code> men med effektiv avgångstid{' '}
        <strong>före 15:00</strong> räknas som dagtids­utflykter och binder <em>inte</em> middagsfönstret
        — de visas i <code>activitiesToday</code> för kontext men ingår inte i fönsterberäkningen.
        Aktiviteter med effektiv avgångstid <strong>≥ 15:00</strong> kan binda fönstret.
      </p>
      <table className="field-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>Aktivitet</th><th>Eff. avgång</th><th>Binder middag?</th><th>Motivering</th></tr></thead>
        <tbody>
          <tr><td>Exempel: förmiddagsaktivitet (start 10:00)</td><td>09:45</td><td>Nej</td><td>Klart långt innan middag</td></tr>
          <tr><td>Exempel: eftermiddagsaktivitet (start 16:00)</td><td>15:30</td><td>Ja</td><td>≥ 15:00, binder fönstret</td></tr>
          <tr><td>Exempel: kvällsaktivitet (start 18:00)</td><td>18:00</td><td>Ja</td><td>Kvällstid, kan skapa CONFLICT</td></tr>
        </tbody>
      </table>

      <h4 style={{ marginTop: 16, marginBottom: 4 }}>WindowStatus</h4>
      <table className="field-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>Status</th><th>Innebörd</th><th>Fält som sätts</th></tr></thead>
        <tbody>
          <tr>
            <td><span className="field-name">OPEN</span></td>
            <td>Inga villkor — öppen kväll</td>
            <td>—</td>
          </tr>
          <tr>
            <td><span className="field-name">BOUNDED</span></td>
            <td>Normalt fönster finns, t.ex. "middag senast 19:00"</td>
            <td><code>windowEndsBy</code></td>
          </tr>
          <tr>
            <td><span className="field-name">CONFLICT</span></td>
            <td>Ingen normal sittmiddag möjlig; aktivitet pågår under överlämning</td>
            <td><code>eatEarlyBy</code> (förslag)</td>
          </tr>
        </tbody>
      </table>

      <div className="callout warn" style={{ marginBottom: 20 }}>
        <span className="callout-icon">⚠️</span>
        <div className="callout-body">
          <strong>CONFLICT-kriteriet:</strong> minst en fönster­bindande aktivitet uppfyller{' '}
          <em>både</em> <code>effectiveLeaveBy &lt; handoverBy</code> (personen lämnar hem
          innan överlämning) <em>och</em> <code>endTime &gt; handoverBy</code> (personen
          är fortfarande borta när överlämningen sker). Utan överlämnings­villkor på dagen
          kan ingen CONFLICT uppstå — bara BOUNDED.
        </div>
      </div>

      {/* ── DayPlan ─────────────────────────────────────────────────────── */}
      <h3>DayPlan (härlett — sparas ej)</h3>
      <table className="field-table" style={{ marginBottom: 24 }}>
        <thead><tr><th>Fält</th><th>Typ</th><th>Beskrivning</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">date</span></td><td>ISO-datum</td><td>Datum</td></tr>
          <tr><td><span className="field-name">activeGroup</span></td><td>Group | null</td><td>Aktiv grupp</td></tr>
          <tr><td><span className="field-name">presentPersons</span></td><td>Person[]</td><td>Gruppens medlemmar</td></tr>
          <tr><td><span className="field-name">portions</span></td><td>number</td><td>Antal portioner</td></tr>
          <tr><td><span className="field-name">activitiesToday</span></td><td>Activity[]</td><td>Alla aktiviteter för närvarande personer (inkl. tidlösa, för display)</td></tr>
          <tr><td><span className="field-name">windowStatus</span></td><td>OPEN | BOUNDED | CONFLICT</td><td>Middagsfönstrets status</td></tr>
          <tr><td><span className="field-name">windowEndsBy</span></td><td>HH:MM | null</td><td>Bindande cutoff för BOUNDED-dag</td></tr>
          <tr><td><span className="field-name">eatEarlyBy</span></td><td>HH:MM | null</td><td>Förslag för CONFLICT-dag</td></tr>
          <tr><td><span className="field-name">windowNotes</span></td><td>string[]</td><td>Mänskligt läsbar förklaring av varje villkor</td></tr>
        </tbody>
      </table>

      {/* ── Resolver-algoritm ───────────────────────────────────────────── */}
      <h3>Resolver-algoritm</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 12 }}>
        <code>resolvePresence(date, store)</code> → <code>DayPlan</code>
      </p>
      <ol style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 2, paddingLeft: 20, marginBottom: 24 }}>
        <li>Närvaro-del (Prompt 1): hitta utlösta regler, välj vinnare, tillämpa overrides → <code>activeGroup</code>, <code>presentPersons</code>.</li>
        <li>Hämta överlämnings­tid från <code>handoverByWeekday</code> på utlösta regler för den aktuella veckodagen.</li>
        <li>Samla aktiviteter för närvarande personers veckodagen inom giltighetsfönstret → <code>activitiesToday</code>.</li>
        <li>Filtrera ut fönster­bindande aktiviteter: <code>affectsWindow=true</code> + eff. avgångstid ≥ 15:00.</li>
        <li>Beräkna bindande cutoff = min(överlämning, alla eff. avgångstider).</li>
        <li>
          Om inga cutoffs → <code>OPEN</code>. Annars: kontrollera CONFLICT-kriteriet
          (person kvar under överlämning). Om CONFLICT → <code>eatEarlyBy</code> = min(alla aktivitets-cutoffs).
          Annars → <code>BOUNDED</code>, <code>windowEndsBy</code> = bindande cutoff.
        </li>
      </ol>

      {/* ── Kör acceptance-testet ────────────────────────────────────────── */}
      <h3>Kör acceptance-testet</h3>
      <div className="callout info" style={{ marginBottom: 24 }}>
        <span className="callout-icon">▶</span>
        <div className="callout-body">
          <strong>28-dagarstabell:</strong>{' '}
          <code>npx tsx scripts/presence-check.ts</code>
          <br />
          <strong>Enhetstester:</strong>{' '}
          <code>node_modules/.bin/vitest run</code>
          <br />
          <strong>Anpassat startdatum:</strong>{' '}
          <code>npx tsx scripts/presence-check.ts 2026-06-01 14</code>
        </div>
      </div>

      {/* ── Ej implementerat ────────────────────────────────────────────── */}
      <h3>Ej implementerat ännu</h3>
      <div className="callout warn">
        <span className="callout-icon">🚧</span>
        <div className="callout-body">
          <strong>Planeras i Prompt 3 (Side B — Måltider):</strong>{' '}
          måltidslogik, koklogik, rester, preferenser (inkl. ett barns vegankost som funktionell
          regel), och "ät sent"-alternativet baserat på aktiviteternas <code>endTime</code>.
        </div>
      </div>
    </div>
  )
}
