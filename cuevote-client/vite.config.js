import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// RFC 9116 /.well-known/security.txt, emitted into the build output (dist/) so
// Nginx serves it as a static file (the dotfile rule already allows .well-known).
// `Expires` is recomputed on every `vite build`, and update_server.sh rebuilds the
// client on every deploy, so it auto-renews with no manual editing. The window is
// < 1 year (per spec) with generous margin for any gap between deploys.
function securityTxt() {
  return {
    name: 'cuevote-security-txt',
    apply: 'build',
    generateBundle() {
      const expires = new Date(Date.now() + 350 * 24 * 60 * 60 * 1000).toISOString()
      this.emitFile({
        type: 'asset',
        fileName: '.well-known/security.txt',
        source: [
          'Contact: mailto:security@cuevote.com',
          `Expires: ${expires}`,
          'Preferred-Languages: en',
          'Canonical: https://cuevote.com/.well-known/security.txt',
          'Policy: https://github.com/loewenmaehne/cuevote/blob/main/SECURITY.md',
          '',
        ].join('\n'),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), securityTxt()],
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
    // For local development only; avoid exposing this dev server to the public internet.
    // eslint-disable-next-line no-undef -- vite config runs in Node, `process` is fine here.
    headers: process.env.NODE_ENV === 'development'
      ? {
          'Access-Control-Allow-Origin': 'http://localhost:5173',
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
