// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// OAuth consent page for the remote DJ MCP. An AI client sends the user here
// (?auth=<handle>). The user signs in (existing Google flow) and approves; we
// send MCP_AUTHORIZE over the authenticated socket — the server finalizes with
// the MCP and returns a redirect back to the AI client. The finalize secret
// stays server-side; this page never sees it.
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useWebSocketContext } from '../hooks/useWebSocketContext';
import { Language } from '../contexts/LanguageContext';
import { GoogleAuthButton } from './GoogleAuthButton';
import { GoogleGIcon } from './GoogleGIcon';

export function ConnectAI() {
  const [params] = useSearchParams();
  const handle = params.get('auth');
  const clientName = params.get('client');
  const redirectHost = params.get('redirect');
  const { t } = Language.useLanguage();
  const { user, isConnected, sendMessage, lastMessage, handleLoginSuccess, clearMessage } = useWebSocketContext();
  const [phase, setPhase] = useState('idle'); // idle | submitting | success | denied | error

  // React to the server's reply on the shared socket.
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'MCP_AUTHORIZE_RESULT' && lastMessage.payload?.redirectTo) {
      setPhase('success');
      window.location.href = lastMessage.payload.redirectTo;
    } else if (lastMessage.type === 'error' && phase === 'submitting') {
      setPhase('error');
    }
  }, [lastMessage, phase]);

  const approve = () => {
    if (!handle || !user) return;
    clearMessage(); // drop any stale error so the effect only reacts to THIS request's reply
    setPhase('submitting');
    sendMessage({ type: 'MCP_AUTHORIZE', payload: { handle } });
  };

  // If neither result nor error comes back, don't leave the button stuck.
  useEffect(() => {
    if (phase !== 'submitting') return;
    const t = setTimeout(() => setPhase('error'), 15000);
    return () => clearTimeout(t);
  }, [phase]);

  const Card = ({ children }) => (
    <div className="min-h-screen bg-[#050505] text-neutral-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950/80 p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 to-indigo-600">
            <Sparkles className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-semibold">{t('connectAi.title')}</h1>
        </div>
        {children}
      </div>
    </div>
  );

  // Invalid / missing handle.
  if (!handle) {
    return <Card><p className="text-neutral-400">{t('connectAi.invalidLink')}</p></Card>;
  }

  // Terminal states.
  if (phase === 'success') {
    return <Card><p className="text-emerald-400">{t('connectAi.success')}</p></Card>;
  }
  if (phase === 'denied') {
    return <Card><p className="text-neutral-400">{t('connectAi.denied')}</p></Card>;
  }

  // Not signed in yet → offer Google sign-in (existing flow).
  if (!user) {
    return (
      <Card>
        <p className="mb-6 text-neutral-400">{t('connectAi.signInDesc')}</p>
        <GoogleAuthButton
          onLoginSuccess={handleLoginSuccess}
          render={(login, disabled) => (
            <button
              onClick={() => login()}
              disabled={disabled}
              className={`flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-medium text-neutral-900 transition hover:bg-neutral-200 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <GoogleGIcon className="h-5 w-5" />
              {t('lobby.signInGoogle')}
            </button>
          )}
        />
      </Card>
    );
  }

  // Signed in → consent.
  return (
    <Card>
      <p className="mb-2 text-neutral-300">{t('connectAi.permissionDesc')}</p>
      {/* Always show the trust box in the consent state. The redirect HOST is the
          truthful signal; when it's absent (native/custom-scheme client) we still
          warn generically rather than silently falling back to a bare screen. */}
      <p className="mb-4 rounded-lg border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
        {redirectHost
          ? t('connectAi.requestedBy', { client: clientName || '—', host: redirectHost })
          : t('connectAi.requestedByNoHost')}
      </p>
      <p className="mb-6 text-sm text-neutral-500">
        {t('connectAi.signedInAs', { name: user.name || user.email || '—' })}
      </p>
      {phase === 'error' && (
        <p className="mb-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{t('connectAi.error')}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => setPhase('denied')}
          disabled={phase === 'submitting'}
          className="flex-1 rounded-xl border border-neutral-700 px-4 py-3 font-medium text-neutral-300 transition hover:bg-neutral-900"
        >
          {t('lobby.cancel')}
        </button>
        <button
          onClick={approve}
          disabled={phase === 'submitting' || !isConnected}
          className="flex-1 rounded-xl bg-gradient-to-br from-fuchsia-600 to-indigo-600 px-4 py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {phase === 'submitting' ? t('connectAi.connecting') : t('connectAi.allow')}
        </button>
      </div>
      {!isConnected && <p className="mt-4 text-center text-xs text-neutral-500">{t('connectAi.waiting')}</p>}
    </Card>
  );
}

export default ConnectAI;
