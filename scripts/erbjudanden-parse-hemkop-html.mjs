#!/usr/bin/env node
// Parses a Hemköp "Erbjudanden" store page (hemkop.se/erbjudanden/<id>) into
// draft offer JSON. Source: a Safari .webarchive of that page, with its main
// HTML resource extracted first (see erbjudanden-webarchive-extract.py).
//
// This page is a Next.js app (__NEXT_DATA__ script tag present), but that
// blob only carries CMS/shell content — the actual offer list is
// client-rendered into plain DOM, captured as-is by the webarchive. Two card
// shapes exist on the page:
//   - `data-testid="product-container"` (the vast majority): the full
//     in-store ("Gäller i butik") offer grid, with product-title,
//     display-manufacturer/display-volume, a price block (plain "X,XX/st",
//     "X,XX/kg", "N för X kr", or "N % rabatt"), and — when present —
//     ordinary-price / promotion-compare-price (jämförpris) /
//     "Lägsta 30-dagarspris" (pris_30dgr) blocks.
//   - `data-testid="product-main-link"` (rare — 2 of 61 this week): Hemköp's
//     personal "Bara för dig" coupons, which require in-app activation and
//     carry no absolute price (just a splash like "10 % rabatt"). Per the
//     README's existing convention for these: klubbpris stays false and the
//     coupon nature goes in `notering`, not `klubbpris`.
// Price and price-type are read from stable `data-testid` markers only —
// never from the styled-components hash classes (`sc-<hash>-N`), which change
// on any Hemköp redeploy: the price string comes from `screen-reader-text`
// and klubbpris from an explicit `<p>Klubbpris</p>` label on the card.
//
// No explicit "Ordinarie pris"/"Spara X kr" savings line exists on most
// cards — `ordinary-price` is present only on some (see `ord_pris`).
//
// Usage:
//   node scripts/erbjudanden-parse-hemkop-html.mjs page.html > draft.json

import { readFileSync } from 'node:fs';
import { extractUrsprung, markeringarFromUrsprung, classify, tightenUnit, toNumber } from './erbjudanden-lib.mjs';

const [, , input] = process.argv;
if (!input) {
  console.error('Usage: node erbjudanden-parse-hemkop-html.mjs <page.html>');
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

// The card's own accessible price string, e.g. "15,00 /st", "129,00 /kg",
// "2 för 28 kr". Read from `data-testid="screen-reader-text"` — a stable
// testid, unlike the styled-components hash class (`sc-<hash>-1`) this used
// to key off, which silently stopped matching when Hemköp redeployed (the
// 2026-W33 import parsed 0 offers from 67 intact blocks because of it).
function extractPriceText(chunk) {
  const m = chunk.match(/data-testid="screen-reader-text"[^>]*>([^<]*)</);
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : null;
}

function parsePriceText(text) {
  let m;
  if ((m = text.match(/^(\d+)\s*för\s*([\d,.-]+)\s*kr$/i))) {
    const multiN = parseInt(m[1], 10);
    const total = toNumber(m[2]);
    return { pris_typ: 'multi', pris: Math.round((total / multiN) * 100) / 100, pris_text: `${multiN} för ${total.toFixed(2)}kr`, unit: null };
  }
  if ((m = text.match(/^([\d,.\s-]+?)\s*%\s*rabatt$/i))) {
    return { pris_typ: 'rabatt', pris: null, pris_text: `${m[1].trim()}% rabatt`, unit: null };
  }
  // "15,00 /st" / "129,00/kg" — the accessible string separates value and
  // unit with a space, the old price block did not; accept both.
  if ((m = text.match(/^([\d,.-]+)\s*\/\s*(st|kg|l|liter)$/i))) {
    const unit = m[2].toLowerCase() === 'liter' ? 'l' : m[2].toLowerCase();
    return { pris_typ: 'st', pris: toNumber(m[1]), pris_text: `${toNumber(m[1]).toFixed(2)}/${unit}`, unit };
  }
  return null;
}

function parseProductContainer(chunk) {
  const nameM = chunk.match(/data-testid="product-title"[^>]*>([^<]*)</);
  const namn = nameM ? decodeEntities(nameM[1]) : null;
  if (!namn) return null;

  const mfrM = chunk.match(/data-testid="display-manufacturer"[^>]*>([^<]*)</);
  const marke = mfrM ? decodeEntities(mfrM[1]).replace(/,\s*$/, '') || null : null;
  const volM = chunk.match(/data-testid="display-volume"[^>]*>([^<]*)</);
  const storlek = volM ? tightenUnit(decodeEntities(volM[1])) : null;

  const priceText = extractPriceText(chunk);
  if (!priceText) return null;
  const parsed = parsePriceText(priceText);
  if (!parsed) return null;

  // The splash no longer carries a `title="Klubbpris"` attribute; the card
  // renders an explicit `<p>Klubbpris</p>` label instead. Splash *colour*
  // (splash-yellow/splash-red/pricebomb-splash) looks like it correlates but
  // does not: 2026-W33 had 2 yellow multi-buy cards with no Klubbpris label,
  // so match the label itself, never the colour.
  const klubbpris = /<p[^>]*>Klubbpris<\/p>/.test(chunk);
  const notering = /<p[^>]*>Bara för dig<\/p>/.test(chunk)
    ? 'Bara för dig (kräver aktivering i appen)'
    : null;

  const ordM = chunk.match(/data-testid="ordinary-price"[\s\S]*?data-testid="presentation-text"[^>]*>([^<]*)</);
  const ord_pris = ordM ? ordExtract(ordM[1]) : null;

  const jmfM = chunk.match(/data-testid="promotion-compare-price"[\s\S]*?data-testid="presentation-text"[^>]*>([^<]*)</);
  const jamforpris = jmfM ? jmfExtract(jmfM[1]) : (parsed.unit === 'kg' ? `${parsed.pris.toFixed(2)}/kg` : null);

  const p30M = chunk.match(/Lägsta 30-dagarspris[\s\S]*?data-testid="presentation-text"[^>]*>([^<]*)</);
  const pris_30dgr = p30M ? p30Extract(p30M[1]) : null;

  const haystack = `${namn} ${marke ?? ''} ${storlek ?? ''}`;
  const ursprung = extractUrsprung(haystack);
  const cls = classify(namn, marke, haystack);

  return {
    namn,
    marke,
    storlek,
    pris_text: parsed.pris_text,
    pris: parsed.pris,
    pris_typ: parsed.pris_typ,
    jamforpris,
    ord_pris,
    pris_30dgr,
    besparing: null,
    klubbpris,
    max_kop: null,
    markeringar: markeringarFromUrsprung(ursprung, cls.markeringar),
    ursprung,
    notering,
    kategori: cls.kategori,
    form: cls.form,
    varutyp: cls.varutyp,
    kategori_kalla: cls.kategori_kalla,
  };
}

// "Ord pris 165,60 kr/kg" -> "165.60/kg"; "Ord pris 25,88-30,23 kr" -> "25.88-30.23"
function ordExtract(text) {
  const t = decodeEntities(text);
  const m = t.match(/Ord pris ([\d,.\s-]+?)\s*kr(?:\/(kg|st|liter))?$/i);
  if (!m) return null;
  const nums = m[1].trim().replace(/\s+/g, '').replace(/,/g, '.');
  const unit = m[2] ? (m[2].toLowerCase() === 'liter' ? 'l' : m[2].toLowerCase()) : null;
  return unit ? `${nums}/${unit}` : nums;
}

// "Erbj. Jmf pris 45,45-50,00/kg" -> "45.45-50.00/kg"
function jmfExtract(text) {
  const t = decodeEntities(text);
  const m = t.match(/Jmf pris ([\d,.\s-]+?)\/(kg|st|liter)/i);
  if (!m) return null;
  const unit = m[2].toLowerCase() === 'liter' ? 'l' : m[2].toLowerCase();
  return `${m[1].trim().replace(/\s+/g, '').replace(/,/g, '.')}/${unit}`;
}

// "30 dgr pris 15,09-21,72 kr/st" -> "15.09-21.72/st"
function p30Extract(text) {
  const t = decodeEntities(text);
  const m = t.match(/30 dgr pris ([\d,.\s-]+?)\s*kr(?:\/(kg|st|liter))?/i);
  if (!m) return null;
  const nums = m[1].trim().replace(/\s+/g, '').replace(/,/g, '.');
  const unit = m[2] ? (m[2].toLowerCase() === 'liter' ? 'l' : m[2].toLowerCase()) : null;
  return unit ? `${nums}/${unit}` : nums;
}

function parsePersonalCoupon(chunk) {
  const nameM = chunk.match(/<a title="([^"]+)"[^>]*data-testid="product-main-link"/);
  const namn = nameM ? decodeEntities(nameM[1]) : null;
  if (!namn) return null;

  const priceText = extractPriceText(chunk);
  const parsed = priceText ? parsePriceText(priceText) : null;
  if (!parsed) return null;

  const mfrM = chunk.match(/data-testid="display-manufacturer"[^>]*>([^<]*)</);
  const marke = mfrM ? decodeEntities(mfrM[1]).replace(/,\s*$/, '') || null : null;
  const volM = chunk.match(/data-testid="display-volume"[^>]*>([^<]*)</);
  const storlek = volM ? tightenUnit(decodeEntities(volM[1])) : null;
  const haystack = `${namn} ${marke ?? ''} ${storlek ?? ''}`;
  const ursprung = extractUrsprung(haystack);
  const cls = classify(namn, marke, haystack);

  return {
    namn,
    marke,
    storlek,
    pris_text: parsed.pris_text,
    pris: parsed.pris,
    pris_typ: parsed.pris_typ,
    jamforpris: null,
    ord_pris: null,
    pris_30dgr: null,
    besparing: null,
    klubbpris: false,
    max_kop: null,
    markeringar: markeringarFromUrsprung(ursprung, cls.markeringar),
    ursprung,
    notering: 'Bara för dig (kräver aktivering i appen)',
    kategori: cls.kategori,
    form: cls.form,
    varutyp: cls.varutyp,
    kategori_kalla: cls.kategori_kalla,
  };
}

const offers = [];

const pcStarts = [...html.matchAll(/data-testid="product-container"/g)].map((m) => m.index);
for (let i = 0; i < pcStarts.length; i++) {
  const chunk = html.slice(pcStarts[i], pcStarts[i + 1] ?? pcStarts[i] + 6000);
  const offer = parseProductContainer(chunk);
  if (offer) offers.push(offer);
}

const couponStarts = [...html.matchAll(/data-testid="product-main-link"/g)].map((m) => m.index);
for (let i = 0; i < couponStarts.length; i++) {
  // The title attribute sits right before this testid on the same <a> tag.
  const tagStart = html.lastIndexOf('<a ', couponStarts[i]);
  const chunk = html.slice(tagStart, couponStarts[i + 1] ?? couponStarts[i] + 4000);
  const offer = parsePersonalCoupon(chunk);
  if (offer) offers.push(offer);
}

console.log(JSON.stringify(offers, null, 2));
console.error(`Parsed ${offers.length} offers (${pcStarts.length} in-store + ${couponStarts.length} personal-coupon blocks scanned).`);
