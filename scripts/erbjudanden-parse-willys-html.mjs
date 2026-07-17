#!/usr/bin/env node
// Parses a Willys "Erbjudanden" e-handel page (willys.se/erbjudanden/ehandel)
// into draft offer JSON. Source: a Safari .webarchive of that page, with its
// main HTML resource extracted first (see erbjudanden-webarchive-extract.py).
//
// This page's schema.org Product markup gives exact price digits straight
// from itemprop="name"/"brand" and the LOYALTY/GENERAL price spans — no
// glued-digit guessing needed like the PDF-based parser. But it does NOT
// expose an explicit "Jmf-pris"/"Ordinarie pris" field anywhere in the
// markup (checked: absent from the HTML entirely), so:
//   - jamforpris is only filled when the item is already priced per kg/l
//     directly (loose-weight goods) — left null otherwise, matching the
//     "Willys oftast inte" (usually doesn't provide one) behavior the
//     README already documents and what two of three prior weeks show.
//   - ord_pris is derived as pris + besparing when a "Spara X kr" note is
//     present (verified against itemprop=offers meta price, which turned
//     out to equal this exact sum for non-multi-buy items — but is NOT
//     reliable on its own: for multi-buy/"N för" items that same meta
//     field instead mirrors the 30-day-low price, so it is not used here).
//
// Usage:
//   node scripts/erbjudanden-parse-willys-html.mjs page.html > draft.json

import { readFileSync } from 'node:fs';
import { extractUrsprung, markeringarFromUrsprung, classify, tightenUnit } from './erbjudanden-lib.mjs';

const LABEL_MAP = {
  'Nyckelhålsmärkt': 'nyckelhal',
  'Från Sverige': 'svensk',
  'Svensk flagga': 'svensk',
  'Kött från Sverige': 'kott_sverige',
  'Svensk fågel': 'fagel_sverige',
  'EU-ekologiskt': 'eko',
  'Miljömärkt': 'miljomarkt',
  'MSC-märkt': 'msc',
  'ASC-märkt': 'asc',
  'KRAV-märkt': 'krav',
  'Svanen-märkt': 'svanen',
  'Rainforest Alliance': 'rainforest',
  'Fairtrade': 'fairtrade',
};

const [, , input] = process.argv;
if (!input) {
  console.error('Usage: node erbjudanden-parse-willys-html.mjs <page.html>');
  process.exit(1);
}

const html = readFileSync(input, 'utf8');

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// Products are sibling blocks (never nested), so slicing the raw HTML
// between consecutive start markers gives one complete product each time.
const startRe = /<div data-testid="product" class="[^"]*" itemscope="" itemtype="https:\/\/schema\.org\/Product">/g;
const starts = [...html.matchAll(startRe)].map((m) => m.index);

function parseRange(s) {
  // "10,60-12,00" -> [10.6, 12.0]; "40,00" -> [40, 40]
  const parts = s.split('-').map((p) => parseFloat(p.replace(',', '.')));
  return parts.length === 2 ? parts : [parts[0], parts[0]];
}

function fmtRange([lo, hi]) {
  return lo === hi ? lo.toFixed(2) : `${lo.toFixed(2)}-${hi.toFixed(2)}`;
}

// "TINE Ca 830g" / "COCA-COLA • COCA-COLA ZERO 15p/33cl" -> marke + storlek,
// same split heuristic as the PDF-based parser (trailing size token).
function splitBrandSize(brandSize) {
  const m = brandSize.match(/(.*?)\s*((?:ca:?\s*)?[\d.,]+(?:\s*[x/-]\s*[\d.,]+)*\s*(?:g|kg|ml|cl|l|st|p)\b.*)$/i);
  if (m && m[1].trim()) return { marke: m[1].trim(), storlek: normalizeStorlek(m[2]) };
  if (m) return { marke: null, storlek: normalizeStorlek(m[2]) };
  return { marke: brandSize || null, storlek: null };
}

function normalizeStorlek(s) {
  if (!s) return null;
  return tightenUnit(s.replace(/^ca:?\s*/i, 'CA: ')).toUpperCase();
}

function titleCaseCountry(s) {
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function parseProduct(chunk) {
  const nameM = chunk.match(/itemprop="name"[^>]*>([^<]*)</);
  const namn = nameM ? decodeEntities(nameM[1]) : null;
  if (!namn) return null;

  const brandM = chunk.match(/itemprop="brand"[^>]*>([^<]*)</);
  const brandSize = brandM ? decodeEntities(brandM[1]) : '';

  const klubbpris = /data-testid="product-price-LOYALTY"/.test(chunk);
  const priceIdx = chunk.search(/data-testid="product-price-(?:LOYALTY|GENERAL)"/);
  const priceTail = chunk.slice(priceIdx);
  const spans = [...priceTail.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) => decodeEntities(m[1])).slice(0, 4);
  const [krStr, , oreStr, unitRaw] = spans;
  const kr = parseInt(krStr, 10);
  const ore = oreStr ? parseInt(oreStr || '0', 10) : 0;
  const value = Math.round((kr + ore / 100) * 100) / 100;
  let unit = (unitRaw || '').trim(); // '', '/kg', '/st', '+pant'
  const pant = unit === '+pant';
  if (pant) unit = '';

  const multiM = chunk.match(/>(\d+)\s*för</i);
  const multiN = multiM ? parseInt(multiM[1], 10) : null;

  const labelWindow = chunk.slice(0, chunk.search(/itemprop="name"/));
  const markeringar = [...labelWindow.matchAll(/title="([^"]+)"/g)]
    .map((m) => LABEL_MAP[m[1]])
    .filter(Boolean);

  const sparaM = chunk.match(/Spara ([\d,.-]+)\s*kr/);
  const maxKopM = chunk.match(/Max (\d+) köp/);
  const p30M = chunk.match(/Lägsta 30-dgrspris ([\d,.-]+)\s*kr(?:\/(kg|st|l))?/i);
  const tillfalligtParti = /Tillfälligt parti/.test(chunk);

  let pris_typ = 'st';
  let pris = value;
  let pris_text;
  if (multiN) {
    pris_typ = 'multi';
    pris = Math.round((value / multiN) * 100) / 100;
    pris_text = `${multiN} FÖR ${value.toFixed(2)}`;
  } else {
    pris_text = `${value.toFixed(2)}${unit || '/st'}`;
  }
  if (pant) pris_text += ' +pant';

  let jamforpris = null;
  if (!multiN && (unit === '/kg' || unit === '/l')) {
    jamforpris = `${value.toFixed(2)}${unit}`;
  }

  let besparing = null;
  let ord_pris = null;
  if (sparaM) {
    const range = parseRange(sparaM[1]);
    besparing = `${fmtRange(range)}kr`;
    const [savLo, savHi] = range;
    ord_pris = fmtRange([pris + savLo, pris + savHi]);
  }

  let pris_30dgr = null;
  if (p30M) {
    const range = parseRange(p30M[1]);
    const p30Unit = p30M[2] || (unit ? unit.replace('/', '') : 'st');
    pris_30dgr = `${fmtRange(range)}kr/${p30Unit}`;
  }

  const { marke, storlek } = splitBrandSize(brandSize);
  let ursprung = extractUrsprung(`${namn} ${brandSize}`);
  if (ursprung) ursprung = titleCaseCountry(ursprung);
  const cls = classify(namn, marke, brandSize);

  return {
    namn,
    marke,
    storlek,
    pris_text,
    pris,
    pris_typ,
    jamforpris,
    ord_pris,
    pris_30dgr,
    besparing,
    klubbpris,
    max_kop: maxKopM ? parseInt(maxKopM[1], 10) : null,
    markeringar: markeringarFromUrsprung(ursprung, [...markeringar, ...cls.markeringar]),
    ursprung,
    notering: tillfalligtParti ? 'Tillfälligt parti' : null,
    kategori: cls.kategori,
    form: cls.form,
    varutyp: cls.varutyp,
    kategori_kalla: cls.kategori_kalla,
  };
}

const offers = [];
for (let i = 0; i < starts.length; i++) {
  const chunk = html.slice(starts[i], starts[i + 1] ?? starts[i] + 4000);
  const offer = parseProduct(chunk);
  if (offer) offers.push(offer);
}

console.log(JSON.stringify(offers, null, 2));
console.error(`Parsed ${offers.length} offers from ${starts.length} product blocks.`);
