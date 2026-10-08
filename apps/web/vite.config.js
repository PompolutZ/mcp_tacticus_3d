import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The API listens on 8787. Its routes have no /api prefix.
      '/api': {
        target: 'http://localhost:8787',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
