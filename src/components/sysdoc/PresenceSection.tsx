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
        Deklarerar att en grupp är aktiv på ett återkommande schema. Fältet{' '}
        <code>handoverByWeekday</code> bär strukturella överlämnings­tider (t.ex. barnen
        överlämnas kl 19:00 på måndag och onsdag) — dessa är fakta om vardagen, inte aktiviteter.
      </p>
      <table className="field-table" style={{ marginBottom: 8 }}>
        <thead><tr><th>Fält</th><th>Typ</th><th>Beskrivning</th></tr></thead>
        <tbody>
          <tr><td><span className="field-name">id</span></td><td>string</td><td>Unikt id</td></tr>
          <tr><td><span className="field-name">groupId</span></td><td>string</td><td>Grupp som aktiveras</td></tr>
          <tr><td><span className="field-name">cadence</span></td><td>WEEKLY | BIWEEKLY</td><td>Upprepningstakt</td></tr>
          <tr><td><span className="field-name">weekdays</span></td><td>Weekday[]</td><td>1=Mån … 7=Sön</td></tr>
          <tr><td><span className="field-name">anchorDate</span></td><td>ISO | null</td><td>Referensdatum för BIWEEKLY-paritet</td></tr>
          <tr><td><span className="field-name">validFrom / validUntil</span></td><td>ISO | null</td><td>Giltighetsfönster</td></tr>
          <tr><td><span className="field-name">priority</span></td><td>number</td><td>Högst vinner vid konflikt</td></tr>
          <tr><td><span className="field-name">handoverByWeekday</span></td><td>Record&lt;Weekday, HH:MM&gt; | undefined</td><td>Strukturell överlämnings­tid per veckodag</td></tr>
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Seed-data:</p>
      <table className="field-table" style={{ marginBottom: 20 }}>
        <thead><tr><th>Regel-id</th><th>Cadence</th><th>Veckodagar</th><th>handoverByWeekday</th></tr></thead>
        <tbody>
          <tr>
            <td><span className="field-name">mon-wed-weekly</span></td>
            <td>WEEKLY</td>
            <td>Mån, Ons</td>
            <td>{'{'} 1: "19:00", 3: "19:00" {'}'}</td>
          </tr>
          <tr>
            <td><span className="field-name">weekend-biweekly</span></td>
            <td>BIWEEKLY</td>
            <td>Fre, Lör, Sön</td>
            <td>— (fredag­byte varierar; använd Override)</td>
          </tr>
        </tbody>
      </table>

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
          <tr><td><span className="field-name">label</span></td><td>string</td><td>Namn, t.ex. "Teater", "Ridning"</td></tr>
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
          <tr><td>Sarah: Feminine vibe (Sön 12:00)</td><td>11:45</td><td>Nej</td><td>Klart långt innan middag</td></tr>
          <tr><td>Annabelle: Trav (Sön 14:15)</td><td>14:15</td><td>Nej</td><td>Tillbaka 16:15, hinner middagen</td></tr>
          <tr><td>Annabelle: Ridning (Fre 16:00)</td><td>15:30</td><td>Ja</td><td>≥ 15:00, binder fönstret</td></tr>
          <tr><td>Sarah: Hiphop (Fre 17:30)</td><td>17:15</td><td>Ja</td><td>Kvällstid</td></tr>
          <tr><td>Sarah: Teater (Mån 18:00)</td><td>18:00</td><td>Ja</td><td>Kvällstid, skapar CONFLICT</td></tr>
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

      {/* ── Schemat denna termin ────────────────────────────────────────── */}
      <h3>Schemat denna termin</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 8 }}>
        Alla aktiviteter i <code>src/presence/activities.ts</code> med{' '}
        <code>validFrom: '2026-01-01'</code>. Tiderna är i 24h-format HH:MM.
        Kolumnen <em>Binder middag</em> visar om aktiviteten ingår i fönsterberäkningen.
      </p>

      <h5 style={{ marginTop: 12, marginBottom: 4 }}>Sarah</h5>
      <table className="field-table" style={{ marginBottom: 12 }}>
        <thead><tr><th>Dag</th><th>Aktivitet</th><th>Start</th><th>arriveBy</th><th>end</th><th>Binder middag</th></tr></thead>
        <tbody>
          <tr><td>Fre</td><td>Skola: Idrott</td><td>—</td><td>—</td><td>—</td><td>Nej (tidlös)</td></tr>
          <tr><td>Fre</td><td>Hiphop t/v nivå 1</td><td>17:30</td><td>17:15</td><td>18:45</td><td>Ja → cutoff 17:15</td></tr>
          <tr><td>Sön</td><td>Feminine vibe t/v nivå 2</td><td>12:00</td><td>11:45</td><td>13:30</td><td>Nej (dagtid)</td></tr>
          <tr><td>Sön</td><td>Jazz t/v nivå 2</td><td>17:45</td><td>17:30</td><td>19:15</td><td>Ja → cutoff 17:30</td></tr>
          <tr><td>Mån</td><td>Skola: Idrott</td><td>—</td><td>—</td><td>—</td><td>Nej (tidlös)</td></tr>
          <tr><td>Mån</td><td>Teater</td><td>18:00</td><td>—</td><td>20:00</td><td>Ja → cutoff 18:00 → CONFLICT</td></tr>
          <tr><td>Ons</td><td>Girly Twerk/Dancehall</td><td>18:45</td><td>18:30</td><td>20:15</td><td>Ja → cutoff 18:30 → CONFLICT</td></tr>
        </tbody>
      </table>

      <h5 style={{ marginTop: 12, marginBottom: 4 }}>Annabelle</h5>
      <table className="field-table" style={{ marginBottom: 24 }}>
        <thead><tr><th>Dag</th><th>Aktivitet</th><th>Start</th><th>arriveBy</th><th>end</th><th>Binder middag</th></tr></thead>
        <tbody>
          <tr><td>Fre</td><td>Skola: Idrott</td><td>—</td><td>—</td><td>—</td><td>Nej (tidlös)</td></tr>
          <tr><td>Fre</td><td>Ridning</td><td>16:00</td><td>15:30</td><td>17:00</td><td>Ja → cutoff 15:30</td></tr>
          <tr><td>Sön</td><td>Trav</td><td>14:15</td><td>—</td><td>16:15</td><td>Nej (dagtid, eff. 14:15 &lt; 15:00)</td></tr>
          <tr><td>Mån</td><td>Skola: Klarinett</td><td>—</td><td>—</td><td>—</td><td>Nej (tidlös)</td></tr>
          <tr><td>Mån</td><td>Skola: Idrott</td><td>—</td><td>—</td><td>—</td><td>Nej (tidlös)</td></tr>
          <tr><td>Mån</td><td>Modern 10–12</td><td>17:30</td><td>17:15</td><td>18:30</td><td>Ja → cutoff 17:15</td></tr>
        </tbody>
      </table>

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

      {/* ── Verkligt mönster ────────────────────────────────────────────── */}
      <h3>Verkligt mönster — kanonisk 14-dagarscykel</h3>
      <table className="field-table" style={{ marginBottom: 24 }}>
        <thead>
          <tr><th>Dag</th><th>Daniels vecka</th><th>Frisvecka</th><th>Matfönster (Daniels v.)</th></tr>
        </thead>
        <tbody>
          {([
            ['Mån', 'Daniel + barn', 'Daniel + barn', 'CONFLICT — ät senast 17:15 (Modern + Teater + överlämn. 19:00)'],
            ['Tis', '(mamman)', '(mamman)', '—'],
            ['Ons', 'Daniel + barn', 'Daniel + barn', 'CONFLICT — ät senast 18:30 (Twerk + överlämn. 19:00)'],
            ['Tor', '(mamman)', '(mamman)', '—'],
            ['Fre', 'Daniel + barn', '(mamman)', 'BOUNDED — senast 15:30 (Ridning)'],
            ['Lör', 'Daniel + barn', '(mamman)', 'OPEN'],
            ['Sön', 'Daniel + barn', '(mamman)', 'BOUNDED — senast 17:30 (Jazz)'],
          ] as [string, string, string, string][]).map(([day, danielWeek, offWeek, window]) => (
            <tr key={day}>
              <td><strong>{day}</strong></td>
              <td>{danielWeek}</td>
              <td style={{ color: offWeek.startsWith('(') ? 'var(--muted)' : undefined }}>{offWeek}</td>
              <td style={{ fontSize: 12, color: 'var(--muted)' }}>{window}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
          måltidslogik, koklogik, rester, preferenser (inkl. Annabelles vegankost som funktionell
          regel), Erikas alternerande ons→fre-rytm, och "ät sent"-alternativet baserat på
          aktiviteternas <code>endTime</code>.
        </div>
      </div>
    </div>
  )
}
