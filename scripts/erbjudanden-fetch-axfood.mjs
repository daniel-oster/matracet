#!/usr/bin/env node
// Fetches a Willys or Hemköp store's in-store offers straight from the JSON
// endpoint the store's own erbjudanden page loads them from, and prints draft
// offer JSON — no Safari .webarchive needed. Both chains are Axfood and share
// one endpoint shape:
//
//   https://www.<willys|hemkop>.se/search/campaigns/offline
//     ?q=<storeId>&type=PERSONAL_GENERAL&page=0&size=500
//
// Store ids: `https://www.<chain>.se/axfood/rest/search/store?q=Borlänge`
// (Willys Borlänge Stora Tuna = 2353, Hemköp Borlänge Södra Backa = 4638).
// This is not a documented public API — if it starts returning HTML, 403 or an
// empty `results`, fall back to the webarchive + erbjudanden-parse-*-html.mjs
// path.
//
// Field mapping, verified against the 2026-W43 response:
//   rewardLabel/conditionLabel  "69,90/st" | "269/kg" | "2 för"+"89,00" | "+pant"
//   priceNoUnit                 the ordinary price (ord_pris)
//   savePrice                   "Spara 33,00 kr" | "Tillfälligt parti" (→ notering)
//   comparePrice                jämförpris, "155:33 kr/kg"
//   offlinePromotionLowestHistoricalPrice  30-day low
//   campaignType LOYALTY        klubbpris (Willys Plus / Hemköp-klubben)
//   startDate/endDate           "19/10-2026" per offer — the majority end date is
//                               the file's giltigt_till (stderr), and only an offer
//                               on its own clock keeps a date, same convention as
//                               the HTML parsers.
//
// Usage:
//   node scripts/erbjudanden-fetch-axfood.mjs willys 2353 [--raw saved.json] > draft.json
//   (--raw reads a previously saved response instead of fetching; --save-raw <path>
//   writes the fetched response to disk for later re-parsing)

import { readFileSync, writeFileSync } from 'node:fs';
import { extractUrsprung, markeringarFromUrsprung, classify, tightenUnit } from './erbjudanden-lib.mjs';

const LABEL_MAP = {
  keyhole: 'nyckelhal',
  swedish_flag: 'svensk',
  from_sweden: 'svensk',
  meat_from_sweden: 'kott_sverige',
  swedish_bird: 'fagel_sverige',
  ecological: 'eko',
  eu_ecological: 'eko',
  krav: 'krav',
  msc_fish: 'msc',
  asc_fish: 'asc',
  swan: 'svanen',
  fairtrade: 'fairtrade',
  rainforest_alliance: 'rainforest',
};

const args = process.argv.slice(2);
const [chain, storeId] = args;
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
if (!['willys', 'hemkop'].includes(chain) || !storeId) {
  console.error('Usage: node erbjudanden-fetch-axfood.mjs <willys|hemkop> <storeId> [--raw file] [--save-raw file]');
  process.exit(1);
}

async function load() {
  const raw = flag('--raw');
  if (raw) return JSON.parse(readFileSync(raw, 'utf8'));
  const url = `https://www.${chain}.se/search/campaigns/offline?q=${storeId}&type=PERSONAL_GENERAL&page=0&size=500`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const text = await res.text();
  const savePath = flag('--save-raw');
  if (savePath) writeFileSync(savePath, text);
  return JSON.parse(text);
}

const num = (s) => parseFloat(String(s).replace(':', '.').replace(',', '.'));
const fmt = (n) => n.toFixed(2);

/** "6,80-10,58" → "6.80-10.58"; "33,00" → "33.00"; null when no number. */
function range(s) {
  const m = String(s ?? '').match(/(\d+(?:[,.:]\d+)?)(?:\s*-\s*(\d+(?:[,.:]\d+)?))?/);
  if (!m) return null;
  const lo = num(m[1]);
  const hi = m[2] ? num(m[2]) : lo;
  return lo === hi ? fmt(lo) : `${fmt(lo)}-${fmt(hi)}`;
}

/** "19/10-2026" → "2026-10-19" */
function isoDate(s) {
  const m = String(s ?? '').match(/(\d{1,2})\/(\d{1,2})-(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

function unitOf(s) {
  const m = String(s ?? '').match(/\/\s*(kg|l|st)\b/i);
  return m ? m[1].toLowerCase() : null;
}

function parseOffer(r) {
  const p = r.potentialPromotions?.[0];
  if (!p || !r.name) return null;
  const reward = String(p.rewardLabel ?? '');
  const cond = String(p.conditionLabel ?? '').trim();
  const pant = /\+\s*pant/i.test(reward);

  const multiM = cond.match(/^(\d+)\s*för$/i);
  const value = num(reward.match(/\d+(?:[,.]\d+)?/)?.[0] ?? NaN);
  const unit = unitOf(reward);
  const notes = [];

  let pris_typ = 'st';
  let pris = Number.isFinite(value) ? value : null;
  let pris_text;
  if (multiM) {
    const n = parseInt(multiM[1], 10);
    pris_typ = 'multi';
    pris = Math.round((value / n) * 100) / 100;
    pris_text = `${n} FÖR ${fmt(value)}`;
  } else if (/%/.test(reward)) {
    pris_typ = 'rabatt';
    pris = null;
    pris_text = reward.trim();
  } else {
    pris_text = `${fmt(value)}/${unit ?? 'st'}`;
  }
  if (pant) pris_text += ' +pant';
  const handlaM = cond.match(/Handla för (\d+)\s*kr/i);
  if (handlaM) notes.push(`Vid köp för minst ${handlaM[1]} kr`);

  const cmpUnit = unitOf(String(p.comparePrice ?? '').replace(/\s*kr/, ''));
  const jamforpris = p.comparePrice && range(p.comparePrice) ? `${range(p.comparePrice)}/${cmpUnit ?? 'st'}` : null;

  const save = String(p.savePrice ?? '');
  const tillfalligt = /Tillfälligt parti/i.test(save);
  if (tillfalligt) notes.push('Tillfälligt parti');
  const besparing = !tillfalligt && range(save) ? `${range(save)}kr` : null;

  const ordinary = r.priceNoUnit ? num(r.priceNoUnit) : null;
  const ord_pris = ordinary && pris != null && ordinary > pris + 0.001 ? fmt(ordinary) : null;

  const low = r.offlinePromotionLowestHistoricalPrice;
  const pris_30dgr = low && range(low) ? `${range(low)}kr/${unitOf(low.replace(/\s*kr/, '')) ?? 'st'}` : null;

  const maxM = String(p.redeemLimitLabel ?? '').match(/Max (\d+)/);
  const marke = r.manufacturer && r.manufacturer !== 'Styck' ? r.manufacturer : null;
  const storlek = r.displayVolume ? tightenUnit(r.displayVolume).toUpperCase() : null;
  const description = String(p.description ?? '').trim();

  const ursprung = extractUrsprung(`${r.name} ${marke ?? ''} ${description}`);
  // "Sverige • Rapsgris" — the origin already lands in `ursprung`, keep only the rest.
  const noteText = description
    .split('•')
    .map((s) => s.trim())
    .filter((s) => s && (!ursprung || s.toLowerCase() !== ursprung.toLowerCase()))
    .join(' • ');
  const cls = classify(r.name, marke, `${marke ?? ''} ${storlek ?? ''} ${description}`);
  const labels = (r.labels ?? []).map((l) => LABEL_MAP[l]).filter(Boolean);

  return {
    offer: {
      namn: r.name.trim(),
      marke,
      storlek,
      pris_text,
      pris,
      pris_typ,
      jamforpris,
      ord_pris,
      pris_30dgr,
      besparing,
      klubbpris: p.campaignType === 'LOYALTY',
      max_kop: maxM ? parseInt(maxM[1], 10) : null,
      markeringar: [...new Set(markeringarFromUrsprung(ursprung, [...labels, ...cls.markeringar]))],
      ursprung,
      notering: [noteText || null, ...notes].filter(Boolean).join(' • ') || null,
      kategori: cls.kategori,
      form: cls.form,
      varutyp: cls.varutyp,
      kategori_kalla: cls.kategori_kalla,
    },
    from: isoDate(p.startDate),
    to: isoDate(p.endDate),
  };
}

const data = await load();
const parsed = (data.results ?? []).map(parseOffer).filter(Boolean);

const counts = {};
for (const { to } of parsed) if (to) counts[to] = (counts[to] ?? 0) + 1;
const fileEnd = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
// The file's start is the Monday of the week the majority end date falls in.
let fileStart = null;
if (fileEnd) {
  const d = new Date(`${fileEnd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  fileStart = d.toISOString().slice(0, 10);
}

const offers = parsed.map(({ offer, from, to }) => {
  const out = { ...offer };
  if (from && fileStart && from > fileStart) out.giltigt_fran = from;
  if (to && to !== fileEnd) out.giltigt_till = to;
  return out;
});

console.log(JSON.stringify(offers, null, 2));
console.error(`Parsed ${offers.length} offers from ${(data.results ?? []).length} results.`);
console.error(`File window (use as giltigt_fran/giltigt_till): ${fileStart} .. ${fileEnd}`);
const own = offers.filter((o) => o.giltigt_fran || o.giltigt_till).length;
if (own) console.error(`${own} offer(s) with their own dates.`);
