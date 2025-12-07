import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { WebSocketProvider } from './contexts/WebSocketProvider.jsx';
import './index.css'
import App from './App.jsx'
import { Lobby } from './components/Lobby.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
          <WebSocketProvider>
            <Routes>
              <Route path="/room/:roomId" element={<App />} />
              <Route path="/" element={<Lobby />} />
            </Routes>
          </WebSocketProvider>
        </GoogleOAuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
