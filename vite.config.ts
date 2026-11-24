import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const apiPort = process.env.PORT ?? '8787'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Aven_LifePlanner_GPT/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    // Local development: the browser calls /api on the Vite origin and Vite
    // forwards it to the Aven API server (npm run dev:server).
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
})
