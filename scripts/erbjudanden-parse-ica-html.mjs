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
// Every class-based lookup below allows extra attributes between the class
// attribute and the tag's ">" (`class="offer-card__title"[^>]*>`): as of the
// 2026-W37 capture ICA ships a Vue scoped-style attribute on part of its
// cards (`<p class="offer-card__title" data-v-2aa9b146="">`) and not on the
// rest. A regex requiring `offer-card__title">` matched only the latter, so
// 22 of 138 offer cards parsed as "no title" and were dropped with no error
// — the same silent-total-failure shape as the 2026-W33 Hemköp hash-class
// break. Match the stable class token, never the exact attribute spelling.
//
// Each card's own end date is not in the card markup at all — it lives in the
// page's Nuxt state blob, keyed by the same id the card carries as
// `data-promotion-id` ("validTo":"2026-09-13T00:00:00"). ICA staggers these:
// in the 2026-W37 capture 89 of 138 cards ended with the flyer week and 49 ran
// one to three weeks longer. Same convention as the Hemköp parser: the majority
// date is the *file's* giltigt_till (reported on stderr) and is dropped from the
// individual offers, so only an offer on its own clock carries one.
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

// id -> ISO end date, from the page state blob (not the card markup).
const validToById = new Map(
  [...html.matchAll(/"id":"(\d+)","details":\{[\s\S]{0,900}?"validTo":"(\d{4}-\d{2}-\d{2})/g)].map((m) => [
    m[1],
    m[2],
  ]),
);

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
  // A deposit-bearing item appends "+pant" to the splash, in two spellings seen so
  // far: "29,90 kr +pant" / "3 för 42 kr +pant" (2026-W36) and "29,90 kr/+pant"
  // (earlier weeks). Strip it here and record it in pris_text, so a drinks offer
  // isn't silently dropped as an unparseable splash.
  let pant = false;
  const pantM = text.match(/\s*(?:\/\s*)?\+\s*pant$/i);
  if (pantM) {
    pant = true;
    text = text.slice(0, pantM.index).replace(/\/$/, '').trim();
  }
  const pantSuffix = pant ? ' +pant' : '';
  if ((m = text.match(/^(\d+)\s*för\s*([\d,.-]+)\s*kr$/i))) {
    const multiN = parseInt(m[1], 10);
    const total = toNumber(m[2]);
    return { pris_typ: 'multi', pris: Math.round((total / multiN) * 100) / 100, pris_text: `${multiN} för ${total.toFixed(2)}kr${pantSuffix}`, unit: null };
  }
  if ((m = text.match(/^([\d,.-]+)\s*kr\/(kg|st|liter)$/i))) {
    const unit = m[2].toLowerCase() === 'liter' ? 'l' : m[2].toLowerCase();
    return { pris_typ: 'st', pris: toNumber(m[1]), pris_text: `${toNumber(m[1]).toFixed(2)}/${unit}${pantSuffix}`, unit };
  }
  if ((m = text.match(/^([\d,.-]+)\s*kr$/i))) {
    return { pris_typ: 'st', pris: toNumber(m[1]), pris_text: `${toNumber(m[1]).toFixed(2)}/st${pantSuffix}`, unit: null };
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
  // ICA sometimes ships a degenerate bold block (literally ",. ") for a card with no
  // brand — a segment with no letters or digits is punctuation, not a brand name.
  segments = segments.filter((s) => /[\p{L}\p{N}]/u.test(s));
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

  const titleM = chunk.match(/offer-card__title"[^>]*>([^<]*)</);
  const namn = titleM ? decodeEntities(titleM[1]) : null;
  if (!namn) return null;

  // Pick the two spans by their own class, never by position: a card whose
  // data-promotion-brand is empty renders the bold brand/size span as a bare
  // `<!---->` placeholder, so the detail span ("Ord.pris ... 30dgr.pris ...")
  // lands at index 0. Reading spans[0] as the brand/size text turned 55 of 306
  // offers in the 2026-W35 import into `marke: "Ord"` / `storlek: "pris 179:00
  // kr, ..."` while silently dropping their real ord_pris/pris_30dgr/jamforpris.
  const textBlockM = chunk.match(/offer-card__text"[^>]*>(.*?)<\/p>/s);
  const spans = textBlockM
    ? [...textBlockM[1].matchAll(/<span([^>]*)>([^<]*)<\/span>/g)].map((m) => ({
        bold: /offer-card__text--bold/.test(m[1]),
        text: decodeEntities(m[2]),
      }))
    : [];
  const boldText = spans.find((s) => s.bold)?.text || '';
  const detailText = spans.filter((s) => !s.bold).map((s) => s.text).join(' ');

  const ursprung = extractUrsprung(boldText) || extractUrsprung(detailText);
  const { marke, storlek } = splitBrandSize(boldText, ursprung);

  const maxKopM = detailText.match(/Max (\d+) köp\/hushåll/);
  const jmfM = detailText.match(/Jmfpris ([\d:,.\-\s]+?)\/(kg|liter|st)/i);
  const ordM = detailText.match(/Ord\.pris ([\d:,.\-\s]+?) kr/);
  const p30M = detailText.match(/30dgr\.pris ([\d:,.\-\s]+?) kr/);

  const srM = chunk.match(/sr-only"[^>]*>([^<]*)<\/span>/);
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

  const idM = chunk.match(/data-promotion-id="(\d+)"/);
  const giltigt_till = idM ? validToById.get(idM[1]) ?? null : null;

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
    giltigt_till,
  };
}

const articleRe = /<article[^>]*>.*?<\/article>/gs;
const chunks = html.match(articleRe) ?? [];

const offers = [];
for (const chunk of chunks) {
  const offer = parseArticle(chunk);
  if (offer) offers.push(offer);
}

// Keep only the offers whose end date differs from the flyer's own (see header).
const endCounts = new Map();
for (const o of offers) {
  if (o.giltigt_till) endCounts.set(o.giltigt_till, (endCounts.get(o.giltigt_till) ?? 0) + 1);
}
let fileEnd = null;
for (const [date, n] of endCounts) {
  if (fileEnd === null || n > endCounts.get(fileEnd)) fileEnd = date;
}
const outliers = [];
for (const o of offers) {
  if (o.giltigt_till === fileEnd) o.giltigt_till = null;
  else if (o.giltigt_till) outliers.push(`${o.namn}: ${o.giltigt_till}`);
}

console.log(JSON.stringify(offers, null, 2));
console.error(`Parsed ${offers.length} offers from ${chunks.length} article blocks.`);
if (fileEnd) console.error(`Majority end date (use as the file's giltigt_till): ${fileEnd}`);
if (outliers.length) console.error(`${outliers.length} offer(s) with their own end date.`);
