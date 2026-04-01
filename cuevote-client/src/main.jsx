// Copyright (c) 2026 Julian Zienert. Licensed under the PolyForm Noncommercial License 1.0.0.
import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WebSocketProvider } from './contexts/WebSocketProvider.jsx';
import './index.css'
import { Lobby } from './components/Lobby.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

const App = lazy(() => import('./App.jsx'))
const LegalPage = lazy(() => import('./components/LegalPage.jsx').then(m => ({ default: m.LegalPage })))

import { Consent } from './contexts/ConsentContext.jsx';
import { Language } from './contexts/LanguageContext.jsx';
import { ConditionalGoogleOAuthProvider } from './components/ConditionalGoogleOAuthProvider.jsx';

import { MobileRedirectGuard } from './components/MobileRedirectGuard.jsx';
// ... previous imports

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <Consent.ConsentProvider>
      <Language.LanguageProvider>
        <BrowserRouter>
          <MobileRedirectGuard>
            <ConditionalGoogleOAuthProvider>
              <WebSocketProvider>
                <Routes>
                  <Route path="/room/:roomId" element={<Suspense fallback={<div className="min-h-screen bg-[#050505] flex items-center justify-center"><span className="text-neutral-500">Loading…</span></div>}><App /></Suspense>} />
                  <Route path="/legal" element={<Suspense fallback={<div className="min-h-screen bg-[#050505]" />}><LegalPage /></Suspense>} />
                  <Route path="/" element={<Lobby />} />
                </Routes>
              </WebSocketProvider>
            </ConditionalGoogleOAuthProvider>
          </MobileRedirectGuard>
        </BrowserRouter>
      </Language.LanguageProvider>
    </Consent.ConsentProvider>
  </ErrorBoundary>,
)
