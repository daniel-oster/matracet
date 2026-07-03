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
// Lines with only ONE token (no internal gap — e.g. "Visa fler sorter",
// "TILLFÄLLIGT PARTI", a lone "Jmf-pris ..." line, or a price digit run
// that a font-size change split into two chunks like "28    00") don't
// carry a gap to split on. Which column they belong to is decided by
// comparing their leading indentation against the document's own
// empirically observed left/right column start positions (computed from
// every *gapped* line first) — NOT a hardcoded "always left", which
// silently corrupted right-column-only lines (dropped fields, and in a
// couple of cases a price digit run split across the two streams,
// producing a wrong price on both sides).
//
// Usage: node scripts/erbjudanden-split-columns.mjs <input.txt>
// Writes <input>.left.txt and <input>.right.txt

import { readFileSync, writeFileSync } from 'node:fs';

const [, , input] = process.argv;
if (!input) {
  console.error('Usage: node erbjudanden-split-columns.mjs <input.txt>');
  process.exit(1);
}

const rawLines = readFileSync(input, 'utf8').split('\n');

function widestGap(content) {
  let widest = null;
  for (const m of content.matchAll(/ {2,}/g)) {
    if (!widest || m[0].length > widest[0].length) widest = m;
  }
  return widest;
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Pass 1: parse every line into { indent, content } and, for gapped lines,
// record where the left and right columns actually start in this document.
const parsed = rawLines.map((raw) => {
  const content = raw.replace(/\s+$/, '');
  const indent = content.length - content.replace(/^\s+/, '').length;
  const trimmed = content.trim();
  if (trimmed === '') return { blank: true };
  // NOTE: a lone price is occasionally rendered as two text runs at
  // different font sizes (kronor, then a smaller superscript öre pair)
  // with unusual x-spacing that looks exactly like a 2+ space column gap
  // (e.g. "28    00" for "28,00"). There is no reliable way to tell that
  // apart from a genuine two-item row sharing this line — in the one
  // occurrence seen so far it really was two different items' prices, so
  // this is intentionally NOT special-cased. If a parsed price looks
  // implausible (e.g. 0 kr, or a 1-2 digit "price"), check the source line
  // for this pattern before trusting the parser output.
  const gap = widestGap(trimmed);
  if (gap && gap.index > 0) {
    return {
      gapped: true,
      indent,
      leftText: trimmed.slice(0, gap.index).trim(),
      rightText: trimmed.slice(gap.index + gap[0].length).trim(),
      rightIndent: indent + gap.index + gap[0].length,
    };
  }
  return { gapped: false, indent, text: trimmed };
});

const leftStarts = parsed.filter((p) => p.gapped).map((p) => p.indent);
const rightStarts = parsed.filter((p) => p.gapped).map((p) => p.rightIndent);
const globalThreshold = leftStarts.length && rightStarts.length
  ? (median(leftStarts) + median(rightStarts)) / 2
  : Infinity; // no gapped lines to learn from — fall back to "always left"

// Column x-positions drift across the document (different content lengths
// push a column's own text further right, e.g. a bare 4-digit price with no
// unit sits noticeably righter than "SPARA ... KR/ST" would). A single
// document-wide threshold misjudges those — so for each gapless line, prefer
// the LOCAL left/right reference from the nearest gapped line nearby over
// the global one.
const WINDOW = 6;
function nearestGappedThreshold(i) {
  for (let d = 1; d <= WINDOW; d++) {
    const before = parsed[i - d];
    if (before?.gapped) return (before.indent + before.rightIndent) / 2;
    const after = parsed[i + d];
    if (after?.gapped) return (after.indent + after.rightIndent) / 2;
  }
  return globalThreshold;
}

// Pass 2: emit left/right streams, assigning single-token lines by indent.
const left = [];
const right = [];
parsed.forEach((p, i) => {
  if (p.blank) {
    left.push('');
    right.push('');
  } else if (p.gapped) {
    left.push(p.leftText);
    right.push(p.rightText);
  } else if (p.indent >= nearestGappedThreshold(i)) {
    left.push('');
    right.push(p.text);
  } else {
    left.push(p.text);
    right.push('');
  }
});

const base = input.replace(/\.txt$/, '');
writeFileSync(`${base}.left.txt`, left.join('\n'));
writeFileSync(`${base}.right.txt`, right.join('\n'));
console.log(`Wrote ${base}.left.txt and ${base}.right.txt (global column threshold: indent >= ${globalThreshold})`);
