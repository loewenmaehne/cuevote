import React from "react";
import PropTypes from "prop-types";
import { Music } from "lucide-react";

export const Player = React.memo(function Player({ playerContainerRef, musicSource, currentTrack, spotifyNeedsAuth, spotifyAccountError, onSpotifyAuth, isOwner, isPlayerReady }) {
  if (musicSource === 'spotify') {
    const SpotifyLogo = () => (
      <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#1DB954]" fill="currentColor">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
      </svg>
    );

    // Account error (no Premium) — show for owner
    if (spotifyAccountError && isOwner) {
      return (
        <div ref={playerContainerRef} className="h-full w-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-black">
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <SpotifyLogo />
            </div>
            <p className="text-white font-bold text-lg">Spotify Premium Required</p>
            <p className="text-neutral-400 text-sm max-w-xs">Playback requires a Spotify Premium subscription. Please upgrade your account and try again.</p>
            <button
              onClick={onSpotifyAuth}
              className="px-6 py-3 rounded-full bg-[#1DB954] text-white font-bold hover:bg-[#1ed760] transition-all"
            >
              Reconnect Spotify
            </button>
          </div>
        </div>
      );
    }

    // Owner: show connect button if auth needed, or if player not ready yet
    if (isOwner && (spotifyNeedsAuth || (!isPlayerReady && !currentTrack))) {
      return (
        <div ref={playerContainerRef} className="h-full w-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-black">
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1DB954]/10 flex items-center justify-center">
              <SpotifyLogo />
            </div>
            <p className="text-white font-bold text-lg">Connect Spotify</p>
            <p className="text-neutral-400 text-sm max-w-xs">Connect your Spotify Premium account to play music in this room.</p>
            <button
              onClick={onSpotifyAuth}
              className="px-6 py-3 rounded-full bg-[#1DB954] text-white font-bold hover:bg-[#1ed760] transition-all"
            >
              Connect Spotify
            </button>
          </div>
        </div>
      );
    }

    // Guest: waiting for owner to connect
    if (!isOwner && !currentTrack) {
      return (
        <div ref={playerContainerRef} className="h-full w-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-black">
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1DB954]/10 flex items-center justify-center">
              <SpotifyLogo />
            </div>
            <p className="text-white font-medium">Waiting for music...</p>
            <p className="text-neutral-500 text-sm max-w-xs">The room owner controls Spotify playback.</p>
          </div>
        </div>
      );
    }

    // Track is playing — show album art (owner & guest)
    return (
      <div ref={playerContainerRef} className="h-full w-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-black relative overflow-hidden">
        {currentTrack?.thumbnail ? (
          <>
            <img src={currentTrack.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl scale-110" />
            <div className="relative z-10 flex flex-col items-center gap-4 p-6 text-center">
              <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-48 h-48 rounded-2xl shadow-2xl ring-1 ring-white/10" />
              <div className="max-w-xs">
                <p className="text-white font-bold text-lg truncate">{currentTrack.title}</p>
                <p className="text-neutral-400 text-sm truncate">{currentTrack.artist}</p>
              </div>
              {!isOwner && currentTrack.previewUrl && (
                <audio src={currentTrack.previewUrl} controls className="mt-2 w-64 h-8 opacity-80" />
              )}
              {!isOwner && !currentTrack.previewUrl && (
                <p className="text-neutral-600 text-xs mt-1">Owner controls playback</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-neutral-500">
            <Music size={48} />
            <p className="text-sm">Spotify</p>
          </div>
        )}
      </div>
    );
  }

  return <div ref={playerContainerRef} className="h-full w-full" />;
});

Player.displayName = "Player";

Player.propTypes = {
  playerContainerRef: PropTypes.object.isRequired,
  musicSource: PropTypes.string,
  currentTrack: PropTypes.object,
  spotifyNeedsAuth: PropTypes.bool,
  spotifyAccountError: PropTypes.bool,
  onSpotifyAuth: PropTypes.func,
  isOwner: PropTypes.bool,
  isPlayerReady: PropTypes.bool,
};
