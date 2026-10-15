import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Sent in hello, so two players can see that they run different builds (plan 08, decision 14). Netlify
    // sets COMMIT_REF to the git commit.
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(process.env.COMMIT_REF || 'dev'),
  },
  build: {
    rollupOptions: {
      output: {
        // Game data in one cached file that changes only when the data changes (plan review-fixes, decision 11)
        manualChunks(id) {
          if (/\/src\/(characters|tactics|crisis)\/jarvis-rows\.json$/.test(id)) return 'game-data'
          if (/\/src\/(characters\/characters|tactics\/cards|crisis\/cards)\.json$/.test(id))
            return 'game-data'
        },
      },
    },
  },
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
