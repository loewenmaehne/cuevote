import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { ArrowDown, ArrowUp } from "lucide-react";
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
  isFetchingSuggestions,
}) {
  const containerRef = useRef(null);
  const [showJumpToNow, setShowJumpToNow] = useState(false);
  const [jumpDirection, setJumpDirection] = useState("down");

  // Helper to scroll to current track (which is inside the mapped list)
  const scrollToCurrent = (smooth = true) => {
    if (currentTrack) {
      const currentEl = document.getElementById(`track-${currentTrack.id}`);
      if (currentEl) {
        setShowJumpToNow(false);
        currentEl.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
      }
    }
  };

  // IntersectionObserver for Queue (Standard Mode)
  useEffect(() => {
    // For Queue, the "viewport" is usually the window, so we can use default root (null).

    const currentEl = currentTrack ? document.getElementById(`track-${currentTrack.id}`) : null;
    if (!currentEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        setShowJumpToNow(!isVisible);

        if (!isVisible) {
          const { top } = entry.boundingClientRect;
          setJumpDirection(top < 0 ? "up" : "down");
        }
      },
      {
        root: null, // Watch relative to viewport
        threshold: 0
      }
    );

    observer.observe(currentEl);

    return () => {
      observer.disconnect();
    };
  }, [currentTrack?.id]);

  // Initial scroll or on track change
  useEffect(() => {
    if (!showJumpToNow) {
      scrollToCurrent();
    }
  }, [currentTrack?.id]);


  // Filter out current track as it is shown in the bottom bar
  const visibleTracks = tracks.filter(t => t.id !== currentTrack?.id);

  return (
    <div
      ref={containerRef}
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
            isFetchingSuggestions={isFetchingSuggestions}
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
  isFetchingSuggestions: PropTypes.bool,
};
