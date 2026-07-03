#!/usr/bin/env node
// Splits a two-column `pdftotext -layout` export into two single-column text
// streams (left.txt / right.txt next to the input file). Store offer pages
// (Willys, Hemköp) are laid out as a CSS grid of two items per row; -layout
// preserves that as two columns on the same text line, but the column
// boundary isn't at a fixed character position (proportional-width text
// squeezed into a fixed-width column grid). Splitting at the *widest*
// run of spaces on each line recovers left/right text reliably enough
// to parse each column independently as a normal single-item stream.
//
// Usage: node scripts/erbjudanden-split-columns.mjs <input.txt>
// Writes <input>.left.txt and <input>.right.txt

import { readFileSync, writeFileSync } from 'node:fs';

const [, , input] = process.argv;
if (!input) {
  console.error('Usage: node erbjudanden-split-columns.mjs <input.txt>');
  process.exit(1);
}

const text = readFileSync(input, 'utf8');
const left = [];
const right = [];

for (const rawLine of text.split('\n')) {
  const line = rawLine.trim();
  if (line === '') {
    left.push('');
    right.push('');
    continue;
  }
  // Find the widest run of 2+ spaces *within* the trimmed line; that's the
  // column gap (leading/trailing whitespace was already stripped, so it
  // can't be mistaken for the gap).
  let widest = null;
  for (const m of line.matchAll(/ {2,}/g)) {
    if (!widest || m[0].length > widest[0].length) widest = m;
  }
  if (!widest) {
    // No internal gap — single-column line, e.g. page headers/footers,
    // "Visa fler sorter", full-width banners.
    left.push(line);
    right.push('');
  } else {
    left.push(line.slice(0, widest.index).trim());
    right.push(line.slice(widest.index + widest[0].length).trim());
  }
}

const base = input.replace(/\.txt$/, '');
writeFileSync(`${base}.left.txt`, left.join('\n'));
writeFileSync(`${base}.right.txt`, right.join('\n'));
console.log(`Wrote ${base}.left.txt and ${base}.right.txt`);
