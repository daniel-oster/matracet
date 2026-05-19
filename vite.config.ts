import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/matracet/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        sysdoc: resolve(__dirname, 'sysdoc.html'),
      },
    },
  },
})
