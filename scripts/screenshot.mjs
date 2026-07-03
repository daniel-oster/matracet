/**
 * Screenshot helper for visually verifying UI changes (used by Claude Code
 * sessions, not part of the app itself).
 *
 * This repo's `playwright` devDependency is newer than the Chromium build
 * baked into the remote sandbox at /opt/pw-browsers, so the default
 * `chromium.launch()` resolution fails ("Executable doesn't exist ..."). Pass
 * executablePath explicitly and fall back to the default resolver so this
 * also works on machines without that sandbox path.
 *
 * Usage (start a server first — dev, preview, whatever's relevant):
 *   npm run preview -- --port 4321 &
 *   node scripts/screenshot.mjs <url> <output.png> [click-selector]
 *
 * Example:
 *   node scripts/screenshot.mjs http://localhost:4321/matracet/ /tmp/fynd.png "text=Fynd"
 */

import { chromium } from 'playwright'

const [, , url, outPath, clickSelector] = process.argv

if (!url || !outPath) {
  console.error('Usage: node scripts/screenshot.mjs <url> <output.png> [click-selector]')
  process.exit(1)
}

const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium'

async function launch() {
  try {
    return await chromium.launch()
  } catch {
    return chromium.launch({ executablePath: SANDBOX_CHROMIUM })
  }
}

const browser = await launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto(url, { waitUntil: 'networkidle' })

if (clickSelector) {
  await page.locator(clickSelector).first().click()
  await page.waitForTimeout(400)
}

await page.screenshot({ path: outPath })
await browser.close()
console.log(`✓ Saved ${outPath}`)
