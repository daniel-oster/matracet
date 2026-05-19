export default function ConventionsSection() {
  return (
    <div className="doc-section">
      <h2>Konventioner</h2>
      <p className="section-sub">
        Principer och regler som styr hur data organiseras och namnges i Matracet.
      </p>

      <h3>Dataprinciper</h3>
      <ul className="convention-list">
        <li>
          <span className="conv-key">Människa</span>
          <span>Recept skrivs av en människa (eller Claude) → lagras som JSON för läsbarhet</span>
        </li>
        <li>
          <span className="conv-key">Maskin</span>
          <span>Veckomenyer, pantry och index genereras av Claude → JSON, commitas i git</span>
        </li>
        <li>
          <span className="conv-key">Konvention</span>
          <span>Mappnamn = slug. Bildfilnamn alltid <code>bild.jpg</code> eller <code>bild.webp</code>. Inga konfigurerbara filnamn.</span>
        </li>
        <li>
          <span className="conv-key">Git = källa</span>
          <span>All data versionshanteras i git. Ingen databas. Ingen backend.</span>
        </li>
      </ul>

      <h3 style={{ marginTop: '24px' }}>Slug-format</h3>
      <div className="callout info">
        <span className="callout-icon">🔗</span>
        <div className="callout-body">
          <strong>Regler för slug</strong>
          Gemener · bindestreck mellan ord · inga svenska tecken (ö→o, ä→a, å→a) · kort och beskrivande.
        </div>
      </div>
      <table className="field-table">
        <thead><tr><th>Recept</th><th>Slug</th></tr></thead>
        <tbody>
          {[
            ['Het kikärtsgryta med saffran', 'het-kikärtsgryta'],
            ['Karljohansvamp-risotto med grönkålschips', 'karljohansvamp-risotto'],
            ['Frittata med paprika- och olivsallad', 'frittata-paprika-oliver'],
            ['Bönbullar i pitabröd med yoghurtsås', 'bönbullar-pitabröd'],
            ['Lindströmare (kidneybönsbiffar)', 'lindströmare-kidneybönor'],
          ].map(([namn, slug]) => (
            <tr key={slug}>
              <td><span className="field-desc">{namn}</span></td>
              <td><span className="field-name">{slug}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: '24px' }}>Familjerutiner</h3>
      <ul className="convention-list">
        <li><span className="conv-key">❌ Aldrig</span><span>Lax, pannkakor, rucola</span></li>
        <li><span className="conv-key">✅ Veganska</span><span>Minst 2–3 veganska/mjölkfria middagar per barnvecka</span></li>
        <li><span className="conv-key">🔴 Måndag</span><span>Alltid söndagsöver — ingen ny tillagning</span></li>
        <li><span className="conv-key">⚡ Onsdag</span><span>Under 40 min aktiv tillagningstid</span></li>
        <li><span className="conv-key">🍲 Söndag</span><span>Batchkok planerat med måndag i åtanke</span></li>
        <li><span className="conv-key">🔄 Repetition</span><span>Undvik samma rätt inom 2-veckors fönster</span></li>
      </ul>

      <h3 style={{ marginTop: '24px' }}>Dagkedjor (batch-kok)</h3>
      <div className="callout tip">
        <span className="callout-icon">🔗</span>
        <div className="callout-body">
          <strong>Vad är en dagkedja?</strong>
          Dag 1 lagas en dubbel sats. Resterna omvandlas till dag 2 — ofta med 15 minuters tillagningstid.
        </div>
      </div>
      <table className="field-table">
        <thead><tr><th>Kedja</th><th>Dag 1</th><th>Dag 2</th></tr></thead>
        <tbody>
          {[
            ['A', 'Svarta bönbiffar med tomatsalsa', 'Spaghetti med tomatbiffsås (~15 min)'],
            ['B', 'Belugabolognese', 'Cannelloni med belugafyllning'],
            ['C', 'Bönpastasallad', 'Tomatsoppa (~15 min)'],
            ['D', 'Rotfruktspytt', 'Rotfruktssoppa (~15 min)'],
            ['E', 'Vita bönbullar med brynt smör', 'Potatisplattar med lingon'],
          ].map(([k, d1, d2]) => (
            <tr key={k}>
              <td><span className="field-name">{k}</span></td>
              <td><span className="field-desc">{d1}</span></td>
              <td><span className="field-desc" style={{ color: 'var(--muted)' }}>{d2}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: '24px' }}>Schema-versionshantering</h3>
      <ul className="convention-list">
        <li>
          <span className="conv-key">Additivt</span>
          <span>Nya valfria fält kan läggas till utan att ändra schema_version</span>
        </li>
        <li>
          <span className="conv-key">Brytande</span>
          <span>Om ett obligatoriskt fält ändras eller tas bort → öka schema_version</span>
        </li>
        <li>
          <span className="conv-key">Migration</span>
          <span>Gamla filer behålls som-är; nyare filer kan ha högre version</span>
        </li>
      </ul>
    </div>
  )
}
