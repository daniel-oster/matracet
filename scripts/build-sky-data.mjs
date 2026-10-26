/**
 * Build src/laget/sky/skyData.json — the star data for Läget's night sky — from d3-celestial's
 * (BSD-3-Clause, https://github.com/ofrohn/d3-celestial) public data files:
 *
 *   npm pack d3-celestial && tar xzf d3-celestial-*.tgz      # gives ./package/data/
 *   node scripts/build-sky-data.mjs ./package/data
 *
 * Stars to magnitude 6 (everything visible from a dark site) as flat arrays, and the constellation
 * stick figures. Flat arrays instead of GeoJSON: ~110 kB instead of ~650 kB.
 *   stars: [ra°, dec°, mag×10, B−V×10, ra°, dec°, …]  (RA 0–360, dec −90–90)
 *   lines: [[ [ra,dec],[ra,dec],… ], …]                (polylines, one per drawn stroke)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) {
  console.error('usage: build-sky-data.mjs <d3-celestial data dir>')
  process.exit(2)
}
const read = f => JSON.parse(readFileSync(join(dir, f), 'utf8'))
const ra360 = lon => (lon < 0 ? lon + 360 : lon)
const r = (n, d) => Number(n.toFixed(d))

const stars = []
for (const f of read('stars.6.json').features) {
  const [lon, lat] = f.geometry.coordinates
  const bv = Number.parseFloat(f.properties.bv)
  stars.push(r(ra360(lon), 2), r(lat, 2), Math.round(f.properties.mag * 10), Number.isFinite(bv) ? Math.round(bv * 10) : 5)
}

const lines = []
for (const f of read('constellations.lines.json').features) {
  for (const stroke of f.geometry.coordinates) lines.push(stroke.map(([lon, lat]) => [r(ra360(lon), 2), r(lat, 2)]))
}

writeFileSync(new URL('../src/laget/sky/skyData.json', import.meta.url), JSON.stringify({ stars, lines }))
console.log(`${stars.length / 4} stars, ${lines.length} strokes`)
