#!/usr/bin/env node
// The whole weekly store-offer import in one deterministic step — no upload, no LLM.
// Run by .github/workflows/erbjudanden-weekly.yml every morning; safe to run by hand.
// A day where no store's offers changed writes nothing (only `hamtad` would differ).
//
//   1. Fetch: Willys + Hemköp via erbjudanden-fetch-axfood.mjs, ICA's store page via
//      erbjudanden-parse-ica-html.mjs (state-blob path).
//   2. Classify: lexicon first, the rule engine only for a product never seen before —
//      the same lexicon-first rule as erbjudanden-recategorize.mjs. New products land in
//      the lexicon as kalla:'regel' / confidence:'lag', i.e. visibly unreviewed.
//   3. Drop what the household never shops for in a grocery run:
//      - any store: blöjor/babyvård and djurmat/djurtillbehör (the `barn`/`djur` groups'
//        non-food leaves), and candles/lanterns/socks/batteries (DROP_NAME_RE);
//      - ICA: everything in ICA's own "Hem & fritid" / "Hälsa & skönhet" department
//        unless it classifies as a consumable (KEEP_FROM_ICA_HOME). Matched the manual
//        2026-W43 review on 136 of 143 items, the misses being gränsfall.
//   4. Write <store>/<vecka>.json, add the week to _index.json, point _latest.json at it,
//      then run erbjudanden-verify.mjs.
//   5. Log what changed to public/data/nyheter.json (the app's "Nytt" screen) and, when it's
//      worth a push notification (a new week, or a bevakad vara newly on offer), write the
//      notification to $NOTIS_FILE for scripts/send-push.mjs. Exits non-zero on a verify FAIL or when no store
//      could be fetched at all; a single store failing is reported and skipped.
//
// Usage: node scripts/erbjudanden-weekly.mjs [--dry-run]

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classify } from './erbjudanden-lib.mjs';
import { loadLexikon, saveLexikon, lookupLexikon, upsertLexikon, applyLexikonEntry } from './erbjudanden-lexikon.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA = join(ROOT, 'public/data/erbjudanden');
const dryRun = process.argv.includes('--dry-run');
const work = mkdtempSync(join(tmpdir(), 'erbj-'));

const STORES = [
  { id: 'willys-borlange-stora-tuna', kalla: 'willys', butik: 'Willys Borlänge Stora Tuna', storeId: '2353', url: 'https://www.willys.se/erbjudanden/butik' },
  { id: 'hemkop-borlange-sodra-backa', kalla: 'hemkop', butik: 'Hemköp Borlänge Södra Backa', storeId: '4638', url: 'https://www.hemkop.se/erbjudanden/4638' },
  { id: 'maxi-ica-stormarknad-borlange', kalla: 'ica', butik: 'Maxi ICA Stormarknad Borlänge', url: 'https://www.ica.se/erbjudanden/maxi-ica-stormarknad-borlange-1004119/' },
];

const DROP_LEAVES = new Set(['bloja_babyvard', 'djurmat', 'djurgodis_tillbehor']);
const DROP_NAME_RE = /gravljus|värmeljus|kronljus|blockljus|oljeljus|doftljus|ljuslykt|gravlykt|marschall|strumpa|strumpor|socka|sockor|batteri/i;
const ICA_HOME_RE = /^(Hem & fritid|Hälsa & skönhet)$/;
const KEEP_FROM_ICA_HOME = new Set(['stad_disk_tvatt', 'papper_pasar_folie', 'hygien', 'halsa', 'engangs_grill', 'skadedjur', 'blommor_vaxter']);

function fetchStore(s) {
  if (s.kalla === 'ica') {
    const html = join(work, 'ica.html');
    execFileSync('curl', ['-sSf', '-m', '60', '-A', 'Mozilla/5.0 (Macintosh) Safari/605', s.url, '-o', html]);
    const out = execFileSync('node', [join(ROOT, 'scripts/erbjudanden-parse-ica-html.mjs'), html], { maxBuffer: 1 << 26 });
    return JSON.parse(out);
  }
  const out = execFileSync('node', [join(ROOT, 'scripts/erbjudanden-fetch-axfood.mjs'), s.kalla, s.storeId], { maxBuffer: 1 << 26 });
  return JSON.parse(out);
}

function isoWeek(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const today = new Date().toISOString().slice(0, 10);
const lexikon = loadLexikon();
const results = [];
const STORE_NAMN = { willys: 'Willys', hemkop: 'Hemköp', ica: 'ICA' };
const offerKey = (o) => `${o.namn}|${o.marke ?? ''}`.toLowerCase();
// Same rule as src/lib/bevaka.ts matchesBevakning, but only for keyword watches — a
// category-wide watch (empty `sok`) matches dozens of offers and would make every
// notification noise.
const bevakning = JSON.parse(readFileSync(join(DATA, 'bevakningslista.json'), 'utf8')).varor.filter((v) => v.sok.length);
function bevakaHit(o) {
  const hay = `${o.namn} ${o.marke ?? ''}`.toLowerCase();
  return bevakning.find(
    (v) => !v.undvik_marken.some((b) => hay.includes(b.toLowerCase())) && v.sok.some((k) => hay.includes(k.toLowerCase())),
  );
}
const changes = []; // { store, newWeek, total, nya: offer[] }

for (const s of STORES) {
  let raw;
  try {
    raw = fetchStore(s);
  } catch (err) {
    console.error(`✗ ${s.butik}: hämtningen misslyckades — ${String(err.message).split('\n')[0]}`);
    continue;
  }
  if (!raw.length) {
    console.error(`✗ ${s.butik}: 0 erbjudanden — sidan/formatet har troligen ändrats`);
    continue;
  }
  let newProducts = 0;
  const kept = [];
  const dropped = [];
  for (const o of raw) {
    let entry = lookupLexikon(lexikon, o.namn, o.marke);
    const known = !!entry;
    if (!entry) {
      const cls = classify(o.namn, o.marke, o.notering ?? '');
      entry = { kategori: cls.kategori, form: cls.form, varutyp: cls.varutyp, markeringar: cls.markeringar, confidence: cls.confidence, kalla: cls.kategori_kalla };
    }
    const kategori = entry.kategori;
    const homeDept = o._ica_avdelning && ICA_HOME_RE.test(o._ica_avdelning);
    const drop = DROP_LEAVES.has(kategori) || DROP_NAME_RE.test(o.namn) || (homeDept && !KEEP_FROM_ICA_HOME.has(kategori));
    if (drop) {
      dropped.push(o.namn);
      continue;
    }
    // Only products we actually keep are worth remembering.
    if (!known) {
      upsertLexikon(lexikon, o.namn, o.marke, entry);
      newProducts++;
    }
    const { _ica_avdelning, ...offer } = o;
    applyLexikonEntry(offer, entry);
    if (offer.giltigt_till == null) delete offer.giltigt_till;
    if (offer.giltigt_fran == null) delete offer.giltigt_fran;
    kept.push(offer);
  }

  // The file is the current Mon–Sun week, as the stores show it right now (re-fetched
  // daily, so mid-week additions/removals land too). Offers on their own clock keep their own dates (the parsers
  // already strip the majority date, so only real outliers carry one).
  const start = mondayOf(today);
  const end = addDays(start, 6);
  results.push({ s, kept, dropped, newProducts, start, end, total: raw.length });
}

if (!results.length) {
  console.error('Ingen butik kunde hämtas — inget skrivet.');
  process.exit(1);
}

const vecka = isoWeek(results[0].start);
const files = [];
for (const { s, kept, dropped, newProducts, start, end, total } of results) {
  const file = {
    schema_version: 1,
    kalla: s.kalla,
    butik: s.butik,
    butik_id: s.id,
    vecka,
    giltigt_fran: start,
    giltigt_till: end,
    hamtad: today,
    kalla_url: s.url,
    urval: `automatiskt hämtad (erbjudanden-weekly.mjs): livsmedel och hushåll; ${dropped.length} av ${total} erbjudanden utsorterade (blöjor, djurmat, ljus, kläder, ${s.kalla === 'ica' ? 'ICA:s Hem & fritid utom förbrukningsvaror, ' : ''}m.m.)`,
    antal: kept.length,
    erbjudanden: kept,
  };
  const path = join(DATA, s.id, `${vecka}.json`);
  files.push(path);
  console.log(`✓ ${s.butik}: ${kept.length} med, ${dropped.length} utsorterade, ${newProducts} nya produkter`);
  // Runs daily: leave the file alone when nothing but `hamtad` would change, so an
  // unchanged day produces no commit and no redeploy.
  let previous = null;
  try {
    previous = JSON.parse(readFileSync(path, 'utf8'));
  } catch {}
  const same = previous && JSON.stringify({ ...previous, hamtad: null }) === JSON.stringify({ ...file, hamtad: null });
  if (same) console.log(`  (${s.butik}: oförändrad sedan ${previous.hamtad})`);
  const before = new Set((previous?.erbjudanden ?? []).map(offerKey));
  const nya = kept.filter((o) => !before.has(offerKey(o)));
  if (nya.length) changes.push({ store: s.kalla, newWeek: !previous, total: kept.length, nya });
  if (!dryRun && !same) {
    mkdirSync(join(DATA, s.id), { recursive: true });
    writeFileSync(path, JSON.stringify(file, null, 2) + '\n');
  }
}

if (dryRun) {
  console.log(`(dry run — ${vecka} inte skriven)`);
  process.exit(0);
}

saveLexikon(lexikon);
const idxPath = join(DATA, '_index.json');
const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
if (!idx.veckor.includes(vecka)) {
  idx.veckor.push(vecka);
  idx.veckor.sort();
  // Keep the file's one-line-array layout so the diff stays a one-line change.
  const text = JSON.stringify(idx, null, 2).replace(/"veckor": \[[^\]]*\]/, `"veckor": [${idx.veckor.map((v) => `"${v}"`).join(', ')}]`);
  writeFileSync(idxPath, text.replace(/\{\n\s+"id": ([^\n]+)\n\s+("kalla"[^\n]+)\n\s+("namn"[^\n]+)\n\s+("fullnamn"[^\n]+)\n\s+\}/g, '{ "id": $1 $2 $3 $4 }') + '\n');
}
writeFileSync(join(DATA, '_latest.json'), JSON.stringify({ vecka }, null, 2) + '\n');
console.log(`Vecka ${vecka} skriven.`);

execFileSync('node', [join(ROOT, 'scripts/erbjudanden-verify.mjs'), ...files], { stdio: 'inherit' });

// ── Nytt + notification ───────────────────────────────────────────────────────
if (changes.length) {
  const weekNr = vecka.split('-W')[1].replace(/^0/, '');
  const hits = [];
  for (const c of changes) {
    for (const o of c.nya) {
      const item = bevakaHit(o);
      if (item) hits.push(`🔔 ${item.vara}: ${STORE_NAMN[c.store]} – ${o.namn}${o.marke ? ` (${o.marke})` : ''}, ${o.pris_text}`);
    }
  }
  const newWeek = changes.some((c) => c.newWeek);
  const rader = changes.map((c) =>
    c.newWeek
      ? `${STORE_NAMN[c.store]}: ${c.total} erbjudanden`
      : `${STORE_NAMN[c.store]}: ${c.nya.length} nya – ${c.nya.slice(0, 4).map((o) => o.namn).join(', ')}${c.nya.length > 4 ? ' …' : ''}`,
  );
  const nyhet = {
    id: `erbjudanden-${new Date().toISOString()}`,
    datum: new Date().toISOString(),
    titel: newWeek ? `Veckans erbjudanden v.${weekNr}` : 'Nya fynd',
    rader: [...hits, ...rader],
    notis: newWeek || hits.length > 0,
    vy: hits.length ? 'bevaka' : 'fynd',
  };
  const nyheterPath = join(ROOT, 'public/data/nyheter.json');
  let nyheter = { nyheter: [] };
  try {
    nyheter = JSON.parse(readFileSync(nyheterPath, 'utf8'));
  } catch {}
  nyheter.nyheter = [nyhet, ...nyheter.nyheter].slice(0, 60);
  writeFileSync(nyheterPath, JSON.stringify(nyheter, null, 2) + '\n');
  console.log(`Nytt: ${nyhet.titel} (${nyhet.rader.length} rader, notis: ${nyhet.notis})`);

  if (nyhet.notis && process.env.NOTIS_FILE) {
    const body = (hits.length ? hits : rader).slice(0, 2).join('\n') + (nyhet.rader.length > 2 ? '\n…' : '');
    writeFileSync(process.env.NOTIS_FILE, JSON.stringify({ title: nyhet.titel, body, url: '/matracet/?vy=nytt', tag: nyhet.id }));
  }
}
