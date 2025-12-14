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

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <WebSocketProvider>
          <Routes>
            <Route path="/room/:roomId" element={<App />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/" element={<Lobby />} />
          </Routes>
        </WebSocketProvider>
      </GoogleOAuthProvider>
    </BrowserRouter>
  </ErrorBoundary>,
)
