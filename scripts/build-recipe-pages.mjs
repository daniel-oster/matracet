/**
 * Postbuild step: generate a static file per recipe at dist/recept/<slug>/index.html, each
 * with its own <title> and OpenGraph tags.
 *
 * Problem: a shared recipe link is a real path now (src/lib/recipeLink.ts), but the app is a
 * client-rendered SPA — a link-preview crawler (iMessage, Slack, ...) doesn't run JS, so
 * without this it would fetch dist/index.html and see the generic "Matracet" card for every
 * recipe, with no image or recipe name.
 *
 * Solution: since GitHub Pages serves any file that actually exists directly (no SPA rewrite
 * needed), write one real file per recipe. The page *is* the app — same bundle, same
 * <div id="root">, dist/index.html's asset references are absolute (/matracet/assets/...) so a
 * copy at any depth loads correctly — just with a recipe-specific <head>. The client picks the
 * slug back up from the URL path once JS runs (App.tsx's overlaySlug init).
 *
 * Reads public/data/recipes/_index.json rather than each recipe's own recept.json — the index
 * already has everything a preview card needs (namn, tid_min, kategorier, bildUrl).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const SITE_URL = 'https://daniel-oster.github.io/matracet/'
const OG_BLOCK_RE = /<!-- BEGIN OG:[\s\S]*?<!-- END OG -->/

const KATEGORI_LABELS = {
  vegansk: 'vegansk',
  vegetarisk: 'vegetarisk',
  fisk: 'fisk',
  kott: 'kött',
  glutenfri: 'glutenfri',
  laktosfri: 'laktosfri',
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildOgBlock({ namn, tid_min, kategorier, bildUrl, url }) {
  const title = escapeHtml(`${namn} · Matracet`)
  const descriptionParts = [`${tid_min} min`, ...kategorier.map((k) => KATEGORI_LABELS[k] ?? k)]
  const description = escapeHtml(descriptionParts.join(' · '))
  const lines = [
    '<title>' + title + '</title>',
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="Matracet" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
  ]
  if (bildUrl) lines.push(`<meta property="og:image" content="${escapeHtml(bildUrl)}" />`)
  lines.push(`<meta name="twitter:card" content="summary_large_image" />`)
  return lines.join('\n    ')
}

const distIndexPath = resolve(root, 'dist/index.html')
const template = readFileSync(distIndexPath, 'utf-8')
if (!OG_BLOCK_RE.test(template)) {
  throw new Error('dist/index.html has no "BEGIN OG"/"END OG" block to replace — check index.html')
}

const { recipes } = JSON.parse(readFileSync(resolve(root, 'public/data/recipes/_index.json'), 'utf-8'))

let written = 0
let skippedImage = 0
for (const r of recipes) {
  const url = `${SITE_URL}recept/${encodeURIComponent(r.slug)}/`
  const ogBlock = buildOgBlock({ ...r, url })
  const html = template.replace(OG_BLOCK_RE, ogBlock)
  const outDir = resolve(root, 'dist/recept', r.slug)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'index.html'), html)
  written++
  if (!r.bildUrl) skippedImage++
}

console.log(`✓ Generated ${written} recipe preview pages in dist/recept/ (${skippedImage} without og:image)`)
