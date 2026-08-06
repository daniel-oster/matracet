import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/matracet/',
  // Baked into the bundle at build time, not read at runtime — shown on the Synka screen so a
  // stale cached bundle (notably an iOS "Add to Home Screen" icon, which has no service worker
  // to bust its own cache — see CLAUDE.md's "Lessons learned") is visible to compare against
  // "when did I last actually deploy", instead of guessing from symptoms like issue #103 did.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        sysdoc: resolve(__dirname, 'sysdoc.html'),
      },
    },
  },
})
