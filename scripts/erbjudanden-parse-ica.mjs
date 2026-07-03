#!/usr/bin/env node
// Parses an ICA "Erbjudanden" pdftotext -layout export into draft offer
// JSON. ICA's export is single-column — one item per block, blocks
// delimited by the "Lägg i inköpslista" button — which makes it the
// simplest of the three stores to parse.
//
// Usage: node scripts/erbjudanden-parse-ica.mjs <pdftotext-output.txt> > draft.json
//
// Output is a DRAFT: spot-check names/prices against the source text,
// remove non-food/non-household items (clothing, electronics, toys, books —
// ICA's export mixes those into the same list), and fix any category
// guesses before folding into the store's weekly JSON file.

import { readFileSync } from 'node:fs';
import { stripPageNoise, extractUrsprung, markeringarFromUrsprung, guessKategori, tightenUnit, toNumber } from './erbjudanden-lib.mjs';

const [, , input] = process.argv;
if (!input) {
  console.error('Usage: node erbjudanden-parse-ica.mjs <input.txt>');
  process.exit(1);
}

const raw = readFileSync(input, 'utf8').split('\n').map((l) => l.trim());
const lines = stripPageNoise(raw).filter((l) => l !== '');

// Drop everything before the first real offer block (nav/tab-bar chrome).
const firstIdx = lines.findIndex((l) => /^(\d+%|\d+ för|[\d,]+:-)/.test(l));
const relevant = lines.slice(firstIdx === -1 ? 0 : firstIdx);

const chunks = [];
let current = [];
for (const line of relevant) {
  if (line === 'Lägg i inköpslista') {
    if (current.length) chunks.push(current);
    current = [];
  } else if (!/^(Håll koll med ICAs app|Ladda ner ICA-appen|ICAs reklamfilmer|Veckans reklamfilm)$/.test(line)) {
    current.push(line);
  }
}
if (current.length) chunks.push(current);

// A page break mid-item repeats the last line(s) of content at the top of
// the next page. Collapse consecutive duplicate lines within a chunk.
function dedupe(chunkLines) {
  const out = [];
  for (const l of chunkLines) {
    if (out[out.length - 1] !== l) out.push(l);
  }
  return out;
}

function parseChunk(rawChunkLines) {
  // A unit suffix ("/st", "/kg") sometimes renders glued to the following
  // name text on one physical line (e.g. "/st      Kaffe hela bönor") —
  // split it back into its own line so the normal state machine handles it.
  const split = rawChunkLines.flatMap((l) => {
    const m = l.match(/^\/(st|kg|l)\s+(.+)$/);
    return m ? [`/${m[1]}`, m[2]] : [l];
  });
  const chunkLines = dedupe(split);

  let multiN = null;
  let priceRaw = null;
  let pris_typ = 'st';
  let namn = null;
  let percentVal = null;
  const detailsLines = [];

  for (const line of chunkLines) {
    let m;
    if (namn === null && (m = line.match(/^(\d+) för\s+([\d:,.]+):-\s*(.*)$/))) {
      multiN = parseInt(m[1], 10);
      priceRaw = m[2];
      pris_typ = 'multi';
      if (m[3]) detailsLines.push(m[3]);
    } else if (/^\d+ för$/.test(line)) {
      multiN = parseInt(line, 10);
      pris_typ = 'multi';
    } else if ((m = line.match(/^(\d+) för\s+(.+)$/))) {
      // "N för" header sharing a line with details text (price arrives
      // later, after a page break) rather than the usual attached price.
      multiN = parseInt(m[1], 10);
      pris_typ = 'multi';
      detailsLines.push(m[2]);
    } else if (namn === null && (m = line.match(/^(\d+)%$/))) {
      pris_typ = 'rabatt';
      percentVal = m[1];
    } else if (line === 'rabatt') {
      pris_typ = 'rabatt';
    } else if (line === '+pant') {
      // Deposit flag rendered on its own line right after the price.
    } else if (namn === null && (m = line.match(/^([\d:,.]+):-\s+(.+)$/))) {
      // price glued to name on the same line, e.g. "25:-        Tortillabröd"
      if (!priceRaw) priceRaw = m[1];
      namn = m[2].trim();
    } else if (!priceRaw && /^[\d:,.]+:-$/.test(line)) {
      // Bare price line. Usually precedes the name, but a handful of items
      // render name-then-discount-header-then-price (price ends up here
      // after the name was already captured) — accept it either way.
      priceRaw = line.replace(':-', '');
    } else if (!priceRaw && /^\d{3,4}$/.test(line)) {
      // Glued-digit price with no colon separator (e.g. "3990" for 39.90 kr)
      // — the öre digits are a separate, smaller text run in the source
      // that pdftotext just concatenates; last two digits are always öre.
      priceRaw = `${line.slice(0, -2)}:${line.slice(-2)}`;
    } else if (namn === null && /^\/(st|kg|l)$/.test(line)) {
      // unit-only line following a lone price line, no name yet
    } else if (namn === null) {
      namn = line.trim();
    } else {
      detailsLines.push(line);
    }
  }

  if (!namn) return null;
  const details = detailsLines.join(' ');

  const maxKopMatch = details.match(/Max (\d+) köp\/hushåll/);
  const jmfMatch = details.match(/Jmfpris ([\d:,.\-]+)\/(kg|liter|st|l)/i);
  const ordMatch = details.match(/Ord\.pris ([\d:,.\-]+) kr/);
  const p30Match = details.match(/30dgr\.pris ([\d:,.\-]+) kr/);
  const ursprung = extractUrsprung(details);

  // Strip recognized sentences to isolate "Brand. size." remainder.
  let residual = details
    .replace(/Max \d+ köp\/hushåll\.?/, '')
    .replace(/Jmfpris [\d:,.\-]+\/(kg|liter|st|l)\.?/i, '')
    .replace(/Ord\.pris [\d:,.\-]+ kr\.?/, '')
    .replace(/30dgr\.pris [\d:,.\-]+ kr\.?/, '')
    .replace(/Ursprung [A-Za-zÅÄÖåäö/ ]+?\.?(?=\s|$)/, '')
    .trim();

  const segments = residual.split('.').map((s) => s.trim()).filter(Boolean);
  let marke = null;
  let storlek = null;
  if (segments.length) {
    if (/^\d/.test(segments[0]) || /^(ca|Ca)\b/.test(segments[0])) {
      storlek = segments.join(', ');
    } else {
      marke = segments[0];
      storlek = segments.slice(1).join(', ') || null;
    }
  }

  const pris = pris_typ === 'multi' && priceRaw
    ? Math.round((toNumber(priceRaw) / multiN) * 100) / 100
    : toNumber(priceRaw);

  // Swedish convention: whole kronor as "25:-", amounts with öre as "79,90".
  function swedishAmount(raw) {
    const n = toNumber(raw);
    if (n == null) return null;
    return Number.isInteger(n) ? `${n}:-` : n.toFixed(2).replace('.', ',');
  }

  let pris_text;
  if (pris_typ === 'multi') pris_text = `${multiN} för ${swedishAmount(priceRaw)}`;
  else if (pris_typ === 'rabatt') pris_text = percentVal ? `${percentVal}% rabatt` : 'rabatt';
  else pris_text = `${swedishAmount(priceRaw)}/st`;

  return {
    namn,
    marke,
    storlek: tightenUnit(storlek),
    pris_text,
    pris,
    pris_typ,
    jamforpris: jmfMatch ? `${jmfMatch[1].replace(/:/g, '.')}/${jmfMatch[2] === 'liter' ? 'l' : jmfMatch[2]}` : null,
    ord_pris: ordMatch ? ordMatch[1].replace(/:/g, '.') : null,
    pris_30dgr: p30Match ? `${p30Match[1].replace(/:/g, '.')}kr/st` : null,
    besparing: null,
    klubbpris: false,
    max_kop: maxKopMatch ? parseInt(maxKopMatch[1], 10) : null,
    markeringar: markeringarFromUrsprung(ursprung),
    ursprung,
    notering: null,
    kategori: guessKategori(namn, details),
  };
}

const offers = [];
let prevKey = null;
for (const chunk of chunks) {
  const offer = parseChunk(chunk);
  if (!offer || !offer.namn) continue;
  // Page-break artifact: the last item before a page break gets its
  // name+details line repeated at the top of the next page.
  const key = offer.namn + '|' + (offer.storlek ?? '');
  if (key === prevKey) continue;
  prevKey = key;
  offers.push(offer);
}

console.log(JSON.stringify(offers, null, 2));
console.error(`Parsed ${offers.length} offers from ${chunks.length} chunks.`);
