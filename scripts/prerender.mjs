/**
 * Postbuild pre-render step for the sysdoc page.
 *
 * Problem: WebFetch (used by Claude Chat and other crawlers) fetches raw HTML
 * before JavaScript executes, so React SPAs appear empty.
 *
 * Solution: use Vite's ssrLoadModule + react-dom/server to server-render the
 * SysdocApp component and inject the HTML into the built dist/sysdoc.html.
 * The client-side JS then hydrates the existing markup instead of re-rendering.
 */

import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const server = await createServer({
  root,
  plugins: [react()],
  server: { middlewareMode: true },
  appType: 'custom',
  base: '/matracet/',
  logLevel: 'warn',
})

try {
  const mod = await server.ssrLoadModule('/src/components/sysdoc/SysdocApp.tsx')
  const html = renderToString(createElement(mod.default))

  const htmlPath = resolve(root, 'dist/sysdoc.html')
  const template = readFileSync(htmlPath, 'utf-8')
  const rendered = template.replace(
    '<div id="sysdoc-root"></div>',
    `<div id="sysdoc-root">${html}</div>`,
  )
  writeFileSync(htmlPath, rendered)
  console.log('✓ Pre-rendered dist/sysdoc.html')
} finally {
  await server.close()
}
