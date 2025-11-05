import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves from /nba-curios/ path
  // For local dev, this is ignored (serves from /)
  base: process.env.NODE_ENV === 'production' ? '/nba-curios/' : '/',
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})
