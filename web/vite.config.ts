import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const systemEnv = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const appGitSha = systemEnv.VERCEL_GIT_COMMIT_SHA || systemEnv.GIT_COMMIT_SHA || 'unknown'

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_GIT_SHA__: JSON.stringify(appGitSha),
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@supabase')) return 'supabase-vendor'
          if (id.includes('lucide-react')) return 'icons-vendor'
          if (id.includes('admdongkor')) return 'birthplace-vendor'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) return 'react-vendor'
          return 'vendor'
        },
      },
    },
  },
})
