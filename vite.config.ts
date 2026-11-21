import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/matracet/',
  // Shown on Hantera appen, so a home-screen icon still running an old bundle is easy to spot.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        sysdoc: resolve(__dirname, 'sysdoc.html'),
        laget: resolve(__dirname, 'laget/index.html'),
      },
    },
  },
})
