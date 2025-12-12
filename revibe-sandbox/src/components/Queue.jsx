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
      {tracks.map((track) => (
        <div key={track.id} id={`track-${track.id}`}>
          <Track
            track={track}
            isActive={currentTrack?.id === track.id}
            isExpanded={expandedTrackId === track.id}
            vote={votes[track.id]}
            onVote={onVote}
            onToggleExpand={onToggleExpand}
            onPreview={onPreview}
            votesEnabled={votesEnabled}
            onDelete={onDelete}
          />
        </div>
      ))}

      {/* Floating Back to Now Button - Portal to escape mask-image */}
      {/* Floating Back to Now Button - Portal to escape mask-image */}
      {showJumpToNow && currentTrack && createPortal(
        <div className="fixed bottom-36 right-8 z-[2000]">
          <button
            onClick={() => scrollToCurrent(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-full shadow-lg hover:bg-orange-600 hover:shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0 font-medium text-sm pointer-events-auto"
          >
            <span>Back to Now</span>
            {jumpDirection === 'up' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          </button>
        </div>,
        document.body
      )}
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
};
