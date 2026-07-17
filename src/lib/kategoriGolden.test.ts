import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { classify } from './kategoriClassify.mjs'

/**
 * Regression test against a 200-row hand-verified sample (see the categorisation
 * rework design issue §5): every current `ovrigt` offer at the time this fixture was
 * built, every product matching a known collision family (glass/pizza/fryst/nöt/bull/
 * oliv/sallad/ost/paprika), and a random tail. Each row's kategori/form was verified
 * by eye against the real product (see kategoriClassify.mjs's inline comments for the
 * specific bugs this caught: "Grekiskt lantbröd" landing in enportionsratt via a
 * blanket Dafgårds brand override, "Hel ananas | Costa Rica" landing in ost_hard via
 * the country name embedding "ost", etc.) — this is not just a re-dump of whatever
 * the classifier happened to output.
 *
 * Not a pass/fail gate at 100%: a small amount of drift is expected as the taxonomy
 * evolves, and the point is to print per-category accuracy and confusion pairs so a
 * regression is visible and diagnosable, not just red/green.
 */

interface GoldenRow {
  namn: string
  marke: string | null
  kategori: string
  form: string | null
}

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/__fixtures__/kategori-golden.json',
)
const golden: GoldenRow[] = JSON.parse(readFileSync(fixturePath, 'utf8'))

describe('kategoriClassify against the golden set', () => {
  it('reports accuracy and stays above the regression floor', () => {
    let correct = 0
    const perCategory = new Map<string, { correct: number; total: number }>()
    const confusions: string[] = []

    for (const row of golden) {
      const result = classify(row.namn, row.marke, '')
      const stats = perCategory.get(row.kategori) ?? { correct: 0, total: 0 }
      stats.total++
      if (result.kategori === row.kategori) {
        correct++
        stats.correct++
      } else {
        confusions.push(`${row.namn} | ${row.marke ?? ''} — expected ${row.kategori}, got ${result.kategori}`)
      }
      perCategory.set(row.kategori, stats)
    }

    const accuracy = correct / golden.length
    console.log(`\nkategori-golden accuracy: ${correct}/${golden.length} (${(accuracy * 100).toFixed(1)}%)`)

    const worst = [...perCategory.entries()]
      .map(([kat, s]) => ({ kat, acc: s.correct / s.total, ...s }))
      .filter(s => s.acc < 1)
      .sort((a, b) => a.acc - b.acc)
    if (worst.length) {
      console.log('Per-category misses:')
      for (const w of worst) console.log(`  ${w.kat}: ${w.correct}/${w.total}`)
    }
    if (confusions.length) {
      console.log('Confusion pairs:')
      for (const c of confusions) console.log(`  ${c}`)
    }

    // Regression floor, not a target — see this file's header.
    expect(accuracy).toBeGreaterThanOrEqual(0.97)
  })
})
