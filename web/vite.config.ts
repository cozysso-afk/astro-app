import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
