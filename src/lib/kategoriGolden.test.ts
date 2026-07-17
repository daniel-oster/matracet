import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { classify } from './kategoriClassify.mjs'
import { loadLexikon, lookupLexikon } from '../../scripts/erbjudanden-lexikon.mjs'

/**
 * Regression test against a 200-row **genuinely blind random sample** of the corpus
 * (see CLAUDE.md's "the lexicon shipped 100% regex output" post-mortem for why this
 * fixture was rebuilt from scratch once already — the first version was enriched for
 * known-hard collision families and then, worse, *regenerated from the classifier's
 * own output* after bugs were fixed, which meant it scored 100% and had stopped
 * measuring anything). This version: 200 products sampled uniformly at random from
 * the full corpus, each hand-labelled by reading the product name/brand and reasoning
 * about the taxonomy *before* ever running classify() on it — the label file was
 * written and saved first, then compared against classifier output in a second,
 * separate step. Real, measured accuracy on that blind pass was 97.5%: expect this
 * number to be lower than any sample enriched for hard cases, and expect it to
 * fluctuate a little as real classifier improvements trade one edge case for another
 * — that's a feature of an honest measurement, not a flaw in the fixture.
 *
 * Several real, previously-invisible bugs were only found this way, not by the
 * original (enriched, self-referential) sample — see kategoriClassify.mjs's inline
 * comments for specifics: a missing `hygien` leaf rule that silently dumped shampoo/
 * toothpaste/deodorant/sanitary-products into `stad_disk_tvatt`, "Sejfilé" landing in
 * `kott` because the fish-species pattern was defensively space-anchored without
 * checking whether that was actually needed, "Hallonsoda"/"Blåbärsdryck" landing in
 * `bar` (berries) because BAR_RE had none of FRUIT_RE's drink/dairy/cereal
 * exclusions, and more. Not a pass/fail gate at 100% — the point is to print
 * per-category accuracy and confusion pairs so a regression is visible and
 * diagnosable, not just red/green.
 *
 * Looks up the actual production lexicon first, falling back to classify() only on a
 * lexicon miss -- a round-3 review of PR #79 correctly pointed out that testing
 * classify() alone never exercises the file that actually drives the app
 * (_kategori-lexikon.json, replayed by scripts/erbjudanden-recategorize.mjs), so a
 * regex fix could pass this test while a stale/wrong lexicon entry for that exact
 * product still ships. Every golden-set product should already be a lexicon hit
 * (they were sampled from the real corpus), so this mostly just verifies the lexicon
 * agrees with the classifier that seeded it -- but it will catch a manual correction
 * that silently drifted from what the current classifier would say, which classify()
 * alone cannot.
 */

interface GoldenRow {
  namn: string
  marke: string | null
  kategori: string
}

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/__fixtures__/kategori-golden.json',
)
const golden: GoldenRow[] = JSON.parse(readFileSync(fixturePath, 'utf8'))
const lexikon = loadLexikon()

describe('kategoriClassify against the golden set', () => {
  it('reports accuracy and stays above the regression floor', () => {
    let correct = 0
    let lexikonMisses = 0
    const perCategory = new Map<string, { correct: number; total: number }>()
    const confusions: string[] = []

    for (const row of golden) {
      const entry = lookupLexikon(lexikon, row.namn, row.marke)
      const kategori = entry ? entry.kategori : (lexikonMisses++, classify(row.namn, row.marke, '').kategori)
      const stats = perCategory.get(row.kategori) ?? { correct: 0, total: 0 }
      stats.total++
      if (kategori === row.kategori) {
        correct++
        stats.correct++
      } else {
        confusions.push(`${row.namn} | ${row.marke ?? ''} — expected ${row.kategori}, got ${kategori}`)
      }
      perCategory.set(row.kategori, stats)
    }
    if (lexikonMisses > 0) {
      console.log(`\n${lexikonMisses}/${golden.length} golden rows were NOT in the lexicon (fell back to classify())`)
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

    // Regression floor, not a target — see this file's header. Measured 97.5% (195/200)
    // on this blind sample; floor set a couple points below that so small, legitimate
    // taxonomy tweaks don't flip the test red on their own.
    expect(accuracy).toBeGreaterThanOrEqual(0.95)
  })
})
