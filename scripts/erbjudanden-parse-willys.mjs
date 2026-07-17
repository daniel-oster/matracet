#!/usr/bin/env node
// Parses a Willys e-handel "Erbjudanden" pdftotext -layout export into
// draft offer JSON. Willys renders offers as a 2-column CSS grid, so a
// column split (erbjudanden-split-columns.mjs) is required first —
// this script parses ONE single-column stream at a time.
//
// Prices are glued digit runs with no decimal separator (e.g. "1990" for
// 19.90 kr) because the öre digits are a separate, smaller text run in the
// source and pdftotext just concatenates them — the last two digits are
// always öre.
//
// Usage:
//   node scripts/erbjudanden-split-columns.mjs willys.txt
//   node scripts/erbjudanden-parse-willys.mjs willys.left.txt > left.json
//   node scripts/erbjudanden-parse-willys.mjs willys.right.txt > right.json
//   # then concatenate the two arrays
//
// Output is a DRAFT: spot-check against the source text before folding
// into the store's weekly JSON file, especially items with "Visa fler
// sorter" (multiple variants collapsed into one card) or missing fields.

import { readFileSync } from 'node:fs';
import { stripPageNoise, extractUrsprung, markeringarFromUrsprung, classify, tightenUnit } from './erbjudanden-lib.mjs';

// Banner labels the site renders above the product name (not part of it).
const BANNER_LABELS = new Set(['TILLFÄLLIGT PARTI', 'NYHET', 'EKOLOGISK', 'KLUBBPRIS', 'GÄLLER TILL ONS 24/6']);

const [, , input] = process.argv;
if (!input) {
  console.error('Usage: node erbjudanden-parse-willys.mjs <column.txt>');
  process.exit(1);
}

const raw = readFileSync(input, 'utf8').split('\n').map((l) => l.trim());
const lines = stripPageNoise(raw).filter((l) => l !== '');

function glued(digits) {
  if (digits.length <= 2) return parseFloat(`0.${digits.padStart(2, '0')}`);
  return parseFloat(`${digits.slice(0, -2)}.${digits.slice(-2)}`);
}

// Trim page chrome (nav/filter bar) before the first recognizable item
// header or price line.
const headerLineRe = /^(SPARA |[0-9]+ FÖR$)/;
const priceLineRe = /^\d+\s*\/(st|kg|l)$/i;
const firstItemIdx = lines.findIndex((l) => headerLineRe.test(l) || priceLineRe.test(l));
const contentLines = lines.slice(Math.max(firstItemIdx, 0));

// Split into per-item blocks: each item ends with a "N st" quantity-stepper
// line, or "Slut i lager" ("out of stock") in place of that stepper when
// the item can't be added to cart. Missing the latter previously let an
// out-of-stock item's block swallow the *next* item's header/fields too.
const blockEndRe = /^(\d+ st|Slut i lager)$/;
const blocks = [];
let cur = [];
for (const line of contentLines) {
  if (blockEndRe.test(line)) {
    if (cur.length) blocks.push(cur);
    cur = [];
  } else {
    cur.push(line);
  }
}
const itemBlocks = blocks;

function parseBlock(block) {
  let besparing = null;
  let priceValue = null;
  let priceUnit = null;
  let multiN = null;
  let namn = null;
  let banner = null;
  let pant = false;
  const rest = [];

  for (const line of block) {
    let m;
    if ((m = line.match(/^SPARA\s+([\d,]+)\s*KR\/(ST|KG)$/i))) {
      besparing = `${m[1].replace(',', '.')}kr`;
    } else if ((m = line.match(/^(\d+)\s*FÖR$/))) {
      multiN = parseInt(m[1], 10);
    } else if (namn === null && (m = line.match(/^(\d+)\s*\/(st|kg|l)(\s*\+pant)?$/i))) {
      priceValue = glued(m[1]);
      priceUnit = m[2].toLowerCase();
      if (m[3]) pant = true;
    } else if (namn === null && (m = line.match(/^(\d+)\s*\+pant$/i))) {
      // Glued price with a deposit flag but no unit shown at all.
      priceValue = glued(m[1]);
      priceUnit = priceUnit || 'st';
      pant = true;
    } else if (namn === null && /^\d+$/.test(line)) {
      // Bare glued price with no unit suffix (common for "N FÖR" multi-buy
      // deals, which show a flat total rather than a per-kg/per-st price).
      priceValue = glued(line);
      priceUnit = priceUnit || 'st';
    } else if (line === '+pant') {
      // Deposit flag rendered on its own line — never part of the name,
      // regardless of whether the price/name have been captured yet.
      pant = true;
    } else if (line === 'Visa fler sorter') {
      // multi-variant card — the name below is representative, not exhaustive
    } else if (namn === null && (BANNER_LABELS.has(line) || /^HANDLA FÖR \d+ KR$/.test(line))) {
      banner = line;
    } else if (namn === null) {
      namn = line;
    } else {
      rest.push(line);
    }
  }

  if (!namn) return null;

  // First `rest` line still holding brand/size until we hit a recognized
  // "Jmf-pris" / "Ordinarie pris" / "Lägsta 30-dgrspris" field line.
  const fieldRe = /^(Jmf-pris|Ordinarie pris|Lägsta 30-dgrspris)\b/;
  const brandLines = [];
  const fieldLines = [];
  let inFields = false;
  for (const l of rest) {
    if (fieldRe.test(l)) inFields = true;
    (inFields ? fieldLines : brandLines).push(l);
  }
  const brandSize = brandLines.join(' ').trim();
  const fieldText = fieldLines.join(' ');

  const maxKopMatch = fieldText.match(/Max (\d+) köp/);
  const jmfMatches = [...fieldText.matchAll(/Jmf-pris ([\d,]+)\s*kr\/(kg|l|st)/gi)];
  const ordMatch = fieldText.match(/Ordinarie pris ([\d,]+)\s*kr\/(kg|l|st)/i);
  const p30Match = fieldText.match(/Lägsta 30-dgrspris ([\d,]+)\s*kr(?:\/(kg|l|st))?/i);

  const ursprung = extractUrsprung(`${namn} ${brandSize}`);

  // Split brandSize "BARILLA 200G" / "ARLA KO CA: 670G" into brand + storlek.
  let marke = null;
  let storlek = null;
  const sizeMatch = brandSize.match(/(.*?)\s*((?:CA:?\s*)?[\d.,]+\s*(?:G|KG|ML|CL|L|ST|P)\b.*)$/i);
  if (sizeMatch && sizeMatch[1].trim()) {
    marke = sizeMatch[1].trim();
    storlek = sizeMatch[2].trim();
  } else if (sizeMatch) {
    storlek = sizeMatch[2].trim();
  } else if (brandSize) {
    marke = brandSize;
  }

  let pris_typ = 'st';
  let pris = priceValue;
  let pris_text;
  if (multiN) {
    pris_typ = 'multi';
    pris = priceValue != null ? Math.round((priceValue / multiN) * 100) / 100 : null;
    pris_text = `${multiN} FÖR ${priceValue?.toFixed(2)}`;
  } else {
    pris_text = `${priceValue?.toFixed(2)}/${priceUnit}`;
  }
  if (pant) pris_text += ' +pant';
  const cls = classify(namn, marke, brandSize);

  return {
    namn,
    marke,
    storlek: tightenUnit(storlek),
    pris_text,
    pris,
    pris_typ,
    jamforpris: jmfMatches[0] ? `${jmfMatches[0][1].replace(',', '.')}/${jmfMatches[0][2]}` : null,
    ord_pris: ordMatch ? ordMatch[1].replace(',', '.') : null,
    pris_30dgr: p30Match ? `${p30Match[1].replace(',', '.')}kr/${p30Match[2] || priceUnit}` : null,
    besparing,
    klubbpris: false,
    max_kop: maxKopMatch ? parseInt(maxKopMatch[1], 10) : null,
    markeringar: markeringarFromUrsprung(ursprung, cls.markeringar),
    ursprung,
    notering: banner
      ? (banner === 'TILLFÄLLIGT PARTI' ? 'Tillfälligt parti' : banner === 'EKOLOGISK' ? 'EKOLOGISK' : banner)
      : (block.some((l) => l === 'Visa fler sorter') ? 'Välj & blanda' : null),
    kategori: cls.kategori,
    form: cls.form,
    varutyp: cls.varutyp,
    kategori_kalla: cls.kategori_kalla,
  };
}

const offers = itemBlocks.map(parseBlock).filter(Boolean);
console.log(JSON.stringify(offers, null, 2));
console.error(`Parsed ${offers.length} offers from ${itemBlocks.length} blocks.`);
