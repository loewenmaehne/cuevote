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
  votesEnabled = true,
  onDelete,
  onRecommend,
  onAdd,
  activeSuggestionId,
  suggestions,
  suggestionsError,
  isFetchingSuggestions,
  queueVideoIds
}) {
  // Filter out current track as it is shown in the bottom bar
  const visibleTracks = tracks.filter(t => t.id !== currentTrack?.id);

  return (
    <div
      className={`relative transition-all duration-700 ease-in-out ${isMinimized
        ? "max-h-0 opacity-0 translate-y-10"
        : "p-6 space-y-4 opacity-100 translate-y-0"
        }`}
      style={{
        maskImage: isMinimized
          ? "none"
          : "linear-gradient(to bottom, white 80%, transparent 100%)",
      }}
    >
      {visibleTracks.map((track) => (
        <div key={track.id} id={`track-${track.id}`}>
          <Track
            track={track}
            isActive={false} // Never active in this list
            isExpanded={expandedTrackId === track.id}
            vote={votes[track.id]}
            onVote={onVote}
            onToggleExpand={onToggleExpand}
            onPreview={onPreview}
            votesEnabled={votesEnabled}
            onDelete={onDelete}
            onRecommend={onRecommend}
            onAdd={onAdd}
            activeSuggestionId={activeSuggestionId}
            suggestions={suggestions}
            suggestionsError={suggestionsError}
            isFetchingSuggestions={isFetchingSuggestions}
            queueVideoIds={queueVideoIds}
          />
        </div>
      ))}

      {/* "Back to Now" removed as current track is not in list */}
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
  votesEnabled: PropTypes.bool,
  onDelete: PropTypes.func,
  onRecommend: PropTypes.func,
  onAdd: PropTypes.func,
  activeSuggestionId: PropTypes.string,
  suggestions: PropTypes.array,
  suggestionsError: PropTypes.string,
  isFetchingSuggestions: PropTypes.bool,
};
