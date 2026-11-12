import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      // The Open Food Facts search does not allow browsers to call it from other sites, so it is
      // reached through this site: here in development, and through vercel.json once deployed
      '/api/food-search': {
        target: 'https://search.openfoodfacts.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/food-search/, '/search'),
      },
    },
  },
})
