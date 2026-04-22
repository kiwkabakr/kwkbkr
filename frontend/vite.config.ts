import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['web-haptics'],
  },
  build: {
    // Modern browsers only — skip legacy transpile for smaller, faster bundles.
    target: 'es2022',
    // CSS code-splits per route chunk so pages don't block on unrelated styles.
    cssCodeSplit: true,
    // Source maps off in prod to keep shipped payload small.
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Keep React / router / QR libs in stable vendor chunks for long-term caching.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react'
          }
          if (/[\\/]node_modules[\\/]qrcode\.react[\\/]/.test(id)) return 'qrcode'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
