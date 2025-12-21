import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { WebSocketProvider } from './contexts/WebSocketProvider.jsx';
import './index.css'
import App from './App.jsx'
import { Lobby } from './components/Lobby.jsx'
import { LegalPage } from './components/LegalPage.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

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
          <ConditionalGoogleOAuthProvider>
            <WebSocketProvider>
              <MobileRedirectGuard>
                <Routes>
                  <Route path="/room/:roomId" element={<App />} />
                  <Route path="/legal" element={<LegalPage />} />
                  <Route path="/" element={<Lobby />} />
                </Routes>
              </MobileRedirectGuard>
            </WebSocketProvider>
          </ConditionalGoogleOAuthProvider>
        </BrowserRouter>
      </LanguageProvider>
    </ConsentProvider>
  </ErrorBoundary>,
)
