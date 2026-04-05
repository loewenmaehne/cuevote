import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Use HTTPS locally when mkcert certificates are available.
// In production, Vite is not used (nginx serves the built dist/).
const certPath = path.resolve(__dirname, '..', 'certs', 'localhost.pem');
const keyPath = path.resolve(__dirname, '..', 'certs', 'localhost-key.pem');
const httpsConfig = fs.existsSync(certPath) && fs.existsSync(keyPath)
  ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
  : false;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true, // So production TDZ errors show original file/line in browser
    rollupOptions: {
      output: {
        // Keep large data modules in separate chunks so they are never evaluated at entry init (avoids TDZ).
        // Only single-export modules in app-core (ContextValue, deviceDetection, WebSocketContext).
        // Exclude ConsentContext.jsx / LanguageContext.jsx (two exports each) so they stay in index/App and cannot TDZ inside app-core.
        manualChunks(id) {
          if (id.includes('translations.js')) return 'translations'
          if (id.includes('legalContent.js')) return 'legalContent'
          if (id.includes('node_modules')) return undefined
          // Context providers in their own chunk so they always run before App chunk (avoids TDZ 'ce' etc).
          if (id.includes('ConsentContext.jsx') || id.includes('LanguageContext.jsx')) return 'contexts'
          if (id.includes('deviceDetection') || id.includes('ContextValue') || id.includes('WebSocketContext.js')) return 'app-core'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0', // Force IPv4 binding
    port: 5173,
    strictPort: true,
    https: httpsConfig,
    // For local development only; avoid exposing this dev server to the public internet.
    headers: process.env.NODE_ENV === 'development'
      ? {
          'Access-Control-Allow-Origin': httpsConfig ? 'https://localhost:5173' : 'http://localhost:5173',
        }
      : {},
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
