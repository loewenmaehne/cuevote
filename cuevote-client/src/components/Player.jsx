import React from "react";
import PropTypes from "prop-types";
import { Music } from "lucide-react";

export const Player = React.memo(function Player({ playerContainerRef, musicSource, currentTrack }) {
  if (musicSource === 'apple_music') {
    return (
      <div ref={playerContainerRef} className="h-full w-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-black relative overflow-hidden">
        {currentTrack?.thumbnail ? (
          <>
            <img
              src={currentTrack.thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl scale-110"
            />
            <div className="relative z-10 flex flex-col items-center gap-4 p-6 text-center">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-48 h-48 rounded-2xl shadow-2xl ring-1 ring-white/10"
              />
              <div className="max-w-xs">
                <p className="text-white font-bold text-lg truncate">{currentTrack.title}</p>
                <p className="text-neutral-400 text-sm truncate">{currentTrack.artist}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-neutral-500">
            <Music size={48} />
            <p className="text-sm">Apple Music</p>
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
};
