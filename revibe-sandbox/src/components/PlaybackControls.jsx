import React from "react";
import PropTypes from "prop-types";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

export function PlaybackControls({
  isPlaying,
  onPlayPause,
  progress,
  currentTrack,
  activeChannel,
  isMuted,
  onMuteToggle,
  volume,
  onVolumeChange,
}) {
  return (
    <footer
      className="fixed bottom-0 left-0 w-full bg-[#050505]/95 backdrop-blur-md border-t border-neutral-900 px-6 py-3 flex flex-col gap-2 z-50 select-none"
    >
      <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 bg-gradient-to-r from-orange-400 to-orange-600 transition-all"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onPlayPause();
            }}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-full p-3 transition-all shadow-lg"
            disabled={!currentTrack}
          >
            {isPlaying ? <Pause /> : <Play />}
          </button>

          <div>
            <h3 className="text-base font-semibold leading-tight">
              {currentTrack ? `Now Playing · ${currentTrack.title}` : "Queue Empty"}
            </h3>
            <p className="text-sm text-neutral-400">
              {currentTrack
                ? `${currentTrack.artist} • ${activeChannel} Channel`
                : "Add songs to start playback"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-neutral-400">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onMuteToggle();
            }}
            className="hover:text-orange-400 transition-colors"
            disabled={!currentTrack}
          >
            {isMuted ? <VolumeX /> : <Volume2 />}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={volume}
            onChange={onVolumeChange}
            className={`accent-orange-500 w-24 ${isMuted ? "opacity-50" : ""}`}
            onClick={(event) => event.stopPropagation()}
            disabled={!currentTrack}
          />
        </div>
      </div>
    </footer>
  );
}

PlaybackControls.propTypes = {
  isPlaying: PropTypes.bool.isRequired,
  onPlayPause: PropTypes.func.isRequired,
  progress: PropTypes.number.isRequired,
  currentTrack: PropTypes.object,
  activeChannel: PropTypes.string.isRequired,
  isMuted: PropTypes.bool.isRequired,
  onMuteToggle: PropTypes.func.isRequired,
  volume: PropTypes.number.isRequired,
  onVolumeChange: PropTypes.func.isRequired,
};
