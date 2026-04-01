// Copyright (c) 2026 Julian Zienert. Licensed under the PolyForm Noncommercial License 1.0.0.
import React, { lazy, Suspense } from "react";
import { Music, PlayCircle } from "lucide-react";
import { Consent } from './contexts/ConsentContext';

const RoomBody = lazy(() => import('./RoomBody'));

function App() {
  const { hasConsent, giveConsent } = Consent.useConsent();

  if (!hasConsent) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#050505] items-center justify-center p-6 relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/20 via-[#050505] to-[#050505] pointer-events-none" />
        <div className="relative z-10 max-w-lg text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-white">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-400">CueVote</span>
            </h1>
            <p className="text-xl text-neutral-400 font-medium">The Democratic Jukebox</p>
          </div>
          <div className="p-8 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 mb-4">
              <Music size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Enable Audio & Video</h2>
              <p className="text-neutral-400 text-sm leading-relaxed">
                To play music from YouTube and participate in the playlist, we need to use cookies.
              </p>
            </div>
            <button
              onClick={giveConsent}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold text-lg shadow-lg hover:shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <PlayCircle size={24} className="fill-current" />
              Enable & Join Party
            </button>
            <p className="text-xs text-neutral-600">
              By joining, you agree to our <a href="/legal" target="_blank" className="underline hover:text-neutral-400">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <span className="text-neutral-500">Loading…</span>
      </div>
    }>
      <RoomBody />
    </Suspense>
  );
}
export default App;
