import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true, // So production TDZ errors show original file/line in browser
    rollupOptions: {
      output: {
        // Keep large data modules in separate chunks so they are never evaluated at entry init (avoids TDZ).
        // Force context + deviceDetection into app-core so they run before App chunk (avoids 'oe' TDZ).
        manualChunks(id) {
          if (id.includes('translations.js')) return 'translations'
          if (id.includes('legalContent.js')) return 'legalContent'
          if (id.includes('node_modules')) return undefined // let default splitting handle vendor
          if (id.includes('deviceDetection') || id.includes('ContextValue') || id.includes('WebSocketContext.js') || id.includes('ConsentContext.jsx') || id.includes('LanguageContext.jsx')) return 'app-core'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0', // Force IPv4 binding
    port: 5173,
    strictPort: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    // Explicitly handle .apk MIME type
    configureServer: (server) => {
      server.middlewares.use((req, res, next) => {
        if (req.url.endsWith('.apk')) {
          res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        }
        next();
      });
    }
  },
})
