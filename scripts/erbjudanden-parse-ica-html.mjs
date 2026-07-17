#!/usr/bin/env node
// Parses an ICA "Erbjudanden" store page (icamaxiborlange.se or ica.se store
// page, e.g. icamaxiborlange.se or ica.se/butiker/.../erbjudanden) into draft
// offer JSON. Source: a Safari .webarchive of that page, with its main HTML
// resource extracted first (see erbjudanden-webarchive-extract.py).
//
// Unlike the PDF-based erbjudanden-parse-ica.mjs, this page has no glued
// digits or page-break artifacts to fight — each offer is a clean
// <article class="... offer-card ..." data-promotion-id="..."> block with
// stable text content: offer-card__title (name), offer-card__text--bold
// (brand/origin/size), offer-card__text (Max köp / Jmfpris / Ord.pris /
// 30dgr.pris), and a price-splash sr-only span with the actual offer price
// text ("2 för 25 kr", "79 kr/kg", "10% rabatt", "Köp 3 betala för 2", ...).
// No explicit "Spara X kr" savings text exists on this page (checked: ICA
// has never populated `besparing` even from the old PDF source either).
//
// Non-<article class="offer-card"...> blocks on this page are editorial ad
// cards (class "ids-article-card") — filtered out by requiring the
// "offer-card" class token before offer-card__title is even looked up.
//
// Usage:
//   node scripts/erbjudanden-parse-ica-html.mjs page.html > draft.json

import { readFileSync } from 'node:fs';
import { extractUrsprung, markeringarFromUrsprung, classify, tightenUnit, toNumber } from './erbjudanden-lib.mjs';

const [, , input] = process.argv;
if (!input) {
  console.error('Usage: node erbjudanden-parse-ica-html.mjs <page.html>');
  process.exit(1);
}

const html = readFileSync(input, 'utf8');

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function parseSplash(text) {
  let m;
  if ((m = text.match(/^(\d+)\s*för\s*([\d,.-]+)\s*kr$/i))) {
    const multiN = parseInt(m[1], 10);
    const total = toNumber(m[2]);
    return { pris_typ: 'multi', pris: Math.round((total / multiN) * 100) / 100, pris_text: `${multiN} för ${total.toFixed(2)}kr`, unit: null };
  }
  if ((m = text.match(/^([\d,.-]+)\s*kr\/\+pant$/i))) {
    return { pris_typ: 'st', pris: toNumber(m[1]), pris_text: `${toNumber(m[1]).toFixed(2)}/st +pant`, unit: null };
  }
  if ((m = text.match(/^([\d,.-]+)\s*kr\/(kg|st|liter)$/i))) {
    const unit = m[2].toLowerCase() === 'liter' ? 'l' : m[2].toLowerCase();
    return { pris_typ: 'st', pris: toNumber(m[1]), pris_text: `${toNumber(m[1]).toFixed(2)}/${unit}`, unit };
  }
  if ((m = text.match(/^([\d,.-]+)\s*kr$/i))) {
    return { pris_typ: 'st', pris: toNumber(m[1]), pris_text: `${toNumber(m[1]).toFixed(2)}/st`, unit: null };
  }
  if ((m = text.match(/^(\d+)\s*%\s*rabatt$/i))) {
    return { pris_typ: 'rabatt', pris: null, pris_text: `${m[1]}% rabatt`, unit: null };
  }
  if ((m = text.match(/^Köp (\d+) betala för (\d+)$/i))) {
    return { pris_typ: 'rabatt', pris: null, pris_text: `Köp ${m[1]} betala för ${m[2]}`, unit: null, notering: `Köp ${m[1]} betala för ${m[2]}` };
  }
  return null;
}

// "Dalsjöfors. Ursprung Sverige. Ca 800 g. " -> marke "Dalsjöfors", storlek "Ca 800 g"
// (Ursprung sentence is stripped separately via extractUrsprung/removed before this split.)
function splitBrandSize(boldText, ursprung) {
  const residual = boldText.replace(/Ursprung [A-Za-zÅÄÖåäö/ ]+?\.?(?=\s|$)/, '');
  let segments = residual.split('.').map((s) => s.trim()).filter(Boolean);
  // Some cards state the origin as a bare country name with no "Ursprung "
  // prefix (e.g. "ICA. Nederländerna. 200 g.") — extractUrsprung's fallback
  // country-name match catches it, but the sentence-stripping regex above
  // only removes the "Ursprung X." phrasing, so also drop any leftover
  // segment that's exactly the detected country name.
  if (ursprung) segments = segments.filter((s) => s.toLowerCase() !== ursprung.toLowerCase());
  if (!segments.length) return { marke: null, storlek: null };
  if (/^\d/.test(segments[0]) || /^ca\b/i.test(segments[0])) {
    return { marke: null, storlek: tightenUnit(segments.join(', ')) };
  }
  return { marke: segments[0], storlek: tightenUnit(segments.slice(1).join(', ')) || null };
}

function parseArticle(chunk) {
  // Only real offer cards, not editorial "ids-article-card" ad blocks.
  const classM = chunk.match(/^<article[^>]*class="([^"]*)"/);
  const classes = classM ? classM[1].split(/\s+/) : [];
  if (!classes.includes('offer-card')) return null;

  const titleM = chunk.match(/offer-card__title">([^<]*)</);
  const namn = titleM ? decodeEntities(titleM[1]) : null;
  if (!namn) return null;

  const textBlockM = chunk.match(/offer-card__text">(.*?)<\/p>/s);
  const spans = textBlockM
    ? [...textBlockM[1].matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) => decodeEntities(m[1]))
    : [];
  const boldText = spans[0] || '';
  const detailText = spans[1] || '';

  const ursprung = extractUrsprung(boldText) || extractUrsprung(detailText);
  const { marke, storlek } = splitBrandSize(boldText, ursprung);

  const maxKopM = detailText.match(/Max (\d+) köp\/hushåll/);
  const jmfM = detailText.match(/Jmfpris ([\d:,.\-\s]+?)\/(kg|liter|st)/i);
  const ordM = detailText.match(/Ord\.pris ([\d:,.\-\s]+?) kr/);
  const p30M = detailText.match(/30dgr\.pris ([\d:,.\-\s]+?) kr/);

  const srM = chunk.match(/sr-only">([^<]*)<\/span>/);
  const splash = srM ? parseSplash(decodeEntities(srM[1])) : null;
  if (!splash) return null; // decorative/no-price card slipped through

  let jamforpris = null;
  if (jmfM) {
    const unit = jmfM[2].toLowerCase() === 'liter' ? 'l' : jmfM[2].toLowerCase();
    jamforpris = `${jmfM[1].replace(/:/g, '.').replace(/\s+/g, '')}/${unit}`;
  } else if (splash.unit) {
    jamforpris = `${splash.pris.toFixed(2)}/${splash.unit}`;
  }

  const cls = classify(namn, marke, `${boldText} ${detailText}`);

  return {
    namn,
    marke,
    storlek,
    pris_text: splash.pris_text,
    pris: splash.pris,
    pris_typ: splash.pris_typ,
    jamforpris,
    ord_pris: ordM ? ordM[1].replace(/:/g, '.').replace(/\s+/g, '') : null,
    pris_30dgr: p30M ? p30M[1].replace(/:/g, '.').replace(/\s+/g, '') : null,
    besparing: null,
    klubbpris: false,
    max_kop: maxKopM ? parseInt(maxKopM[1], 10) : null,
    markeringar: markeringarFromUrsprung(ursprung, cls.markeringar),
    ursprung,
    notering: splash.notering ?? null,
    kategori: cls.kategori,
    form: cls.form,
    varutyp: cls.varutyp,
    kategori_kalla: cls.kategori_kalla,
  };
}

const articleRe = /<article[^>]*>.*?<\/article>/gs;
const chunks = html.match(articleRe) ?? [];

const offers = [];
for (const chunk of chunks) {
  const offer = parseArticle(chunk);
  if (offer) offers.push(offer);
}

console.log(JSON.stringify(offers, null, 2));
console.error(`Parsed ${offers.length} offers from ${chunks.length} article blocks.`);
