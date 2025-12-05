import React from "react";
import PropTypes from "prop-types";
import { Track } from "./Track";

export function Queue({
  tracks,
  currentTrack,
  expandedTrackId,
  votes,
  onVote,
  onToggleExpand,
  isMinimized,
  onPreview,
}) {
  return (
    <div
      className={`transition-all duration-700 ease-in-out ${
        isMinimized
          ? "max-h-0 opacity-0 translate-y-10"
          : "p-6 space-y-4 opacity-100 translate-y-0"
      }`}
      style={{
        maskImage: isMinimized
          ? "none"
          : "linear-gradient(to bottom, white 80%, transparent 100%)",
      }}
    >
      {tracks.map((track) => (
        <Track
          key={track.id}
          track={track}
          isActive={currentTrack?.id === track.id}
          isExpanded={expandedTrackId === track.id}
          vote={votes[track.id]}
          onVote={onVote}
          onToggleExpand={onToggleExpand}
          onPreview={onPreview}
        />
      ))}
    </div>
  );
}

Queue.propTypes = {
  tracks: PropTypes.array.isRequired,
  currentTrack: PropTypes.object,
  expandedTrackId: PropTypes.string,
  votes: PropTypes.object.isRequired,
  onVote: PropTypes.func.isRequired,
  onToggleExpand: PropTypes.func.isRequired,
  isMinimized: PropTypes.bool.isRequired,
  onPreview: PropTypes.func,
};
