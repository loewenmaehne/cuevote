import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { WebSocketProvider } from './contexts/WebSocketProvider.jsx';
import './index.css'
import App from './App.jsx'
import { Lobby } from './components/Lobby.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

const LegalPage = lazy(() => import('./components/LegalPage.jsx').then(m => ({ default: m.LegalPage })))

import { ConsentProvider } from './contexts/ConsentContext.jsx';
import { LanguageProvider } from './contexts/LanguageContext.jsx';
import { ConditionalGoogleOAuthProvider } from './components/ConditionalGoogleOAuthProvider.jsx';

import { MobileRedirectGuard } from './components/MobileRedirectGuard.jsx';
// ... previous imports

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <ConsentProvider>
      <LanguageProvider>
        <BrowserRouter>
          <MobileRedirectGuard>
            <ConditionalGoogleOAuthProvider>
              <WebSocketProvider>
                <Routes>
                  <Route path="/room/:roomId" element={<App />} />
                  <Route path="/legal" element={<Suspense fallback={<div className="min-h-screen bg-[#050505]" />}><LegalPage /></Suspense>} />
                  <Route path="/" element={<Lobby />} />
                </Routes>
              </WebSocketProvider>
            </ConditionalGoogleOAuthProvider>
          </MobileRedirectGuard>
        </BrowserRouter>
      </LanguageProvider>
    </ConsentProvider>
  </ErrorBoundary>,
)
