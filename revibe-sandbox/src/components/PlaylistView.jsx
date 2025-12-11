import React, { useRef, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Play, SkipForward, Volume2, Check, ArrowDown } from "lucide-react";
import { Track } from "./Track";
import { PlaybackControls } from "./PlaybackControls";

export function PlaylistView({
    history,
    currentTrack,
    queue,
    onVote,
    votes, // Now receiving votes
    // Playback Props
    progress,
    volume,
    isMuted,
    activeChannel,
    onMuteToggle,
    onVolumeChange,
    votesEnabled = true,
    onPreview,
}) {
    const scrollRef = useRef(null);
    const [expandedTrackId, setExpandedTrackId] = useState(null);
    const [showJumpToNow, setShowJumpToNow] = useState(false);
    const [isAutoScrolling, setIsAutoScrolling] = useState(false);

    const handleToggleExpand = (trackId) => {
        setExpandedTrackId((prev) => (prev === trackId ? null : trackId));
    };

    // Helper to scroll to current track
    const scrollToCurrent = (smooth = true) => {
        if (scrollRef.current) {
            const currentEl = document.getElementById("playlist-current-track");
            if (currentEl) {
                setIsAutoScrolling(true);
                currentEl.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
                // Reset auto-scrolling flag after animation (approx timing)
                setTimeout(() => setIsAutoScrolling(false), 1000);
            }
        }
    };

    // Scroll listener to toggle "Jump to Now" button
    const handleScroll = () => {
        if (isAutoScrolling) return; // Ignore scroll events during auto-scroll

        if (scrollRef.current) {
            const container = scrollRef.current;
            const currentEl = document.getElementById("playlist-current-track");

            if (currentEl) {
                const containerRect = container.getBoundingClientRect();
                const trackRect = currentEl.getBoundingClientRect();

                // Check if current track is significantly out of view
                // We consider "away" if the track is not roughly centered or visible
                // Simple check: is it outside the viewport?
                const isOutOfView = (
                    trackRect.bottom < containerRect.top ||
                    trackRect.top > containerRect.bottom
                );

                setShowJumpToNow(isOutOfView);
            }
        }
    };

    // Scroll to current track on mount or track change, ONLY if not scrolled away
    useEffect(() => {
        // If we are already showing the jump button, it means the user is purposefully looking away.
        // So we DO NOT auto-scroll.
        // If the jump button is hidden, we assume the user is "following" the request, so we scroll.
        if (!showJumpToNow) {
            scrollToCurrent();
        }
    }, [currentTrack?.id]);

    // Filter current track out of queue to prevent duplicates in "Up Next"
    const filteredQueue = queue.filter(t => t.id !== currentTrack?.id);

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-white relative">
            {/* Scrollable List */}
            <div
                className="flex-1 overflow-y-auto px-4 pb-24 custom-scrollbar scroll-smooth"
                ref={scrollRef}
                onScroll={handleScroll}
            >
                <div className="max-w-3xl mx-auto space-y-4 py-6">

                    {/* History Section */}
                    {history.length > 0 && (
                        <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity duration-300">
                            <div className="flex items-center gap-2 px-2 pb-2 border-b border-neutral-800">
                                <span className="text-xs font-bold text-neutral-600 uppercase tracking-widest">History</span>
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-900 text-neutral-600 font-mono">{history.length}</span>
                            </div>
                            {history.map((track, i) => (
                                <Track
                                    key={`hist-${track.id}-${i}`}
                                    track={track}
                                    isActive={false} // Never active in history logic
                                    isExpanded={expandedTrackId === `hist-${track.id}-${i}`}
                                    vote={null} // No votes for history
                                    onVote={() => { }} // No-op
                                    onToggleExpand={() => handleToggleExpand(`hist-${track.id}-${i}`)}
                                    readOnly={true} // Read-only mode
                                    votesEnabled={votesEnabled}
                                />
                            ))}
                        </div>
                    )}

                    {/* Current Track Section */}
                    {currentTrack && (
                        <div id="playlist-current-track" className="space-y-2 py-4">
                            <div className="flex items-center gap-2 px-2 pb-2">
                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">Now Playing</span>
                            </div>
                            <Track
                                track={currentTrack}
                                isActive={true}
                                isExpanded={expandedTrackId === currentTrack.id}
                                vote={votes?.[currentTrack.id] || null} // Show vote if user voted on it while in queue
                                onVote={onVote}
                                onToggleExpand={handleToggleExpand}
                                readOnly={true} // Read Only in Playlist View for current track (match queue behavior?) 
                                votesEnabled={votesEnabled}
                            // User said "Playing and Up Next is fine". 
                            // So the track items are fine.
                            />
                        </div>
                    )}

                    {/* Queue Section */}
                    {filteredQueue.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-2 pb-2 border-b border-neutral-800 mt-4">
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Up Next</span>
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">{filteredQueue.length}</span>
                            </div>
                            {filteredQueue.map((track) => (
                                <Track
                                    key={track.id}
                                    track={track}
                                    isActive={false} // Queue items aren't active
                                    isExpanded={expandedTrackId === track.id}
                                    vote={votes?.[track.id]} // Pass actual vote
                                    onVote={onVote}
                                    onToggleExpand={handleToggleExpand}
                                    readOnly={false} // Interactive
                                    votesEnabled={votesEnabled}
                                    onPreview={onPreview}
                                />
                            ))}
                        </div>
                    ) : (
                        !currentTrack && (
                            <div className="flex h-64 w-full items-center justify-center text-neutral-500 bg-[#0a0a0a]">
                                <span className="text-lg">Queue empty</span>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Jump to Now Button */}
            {showJumpToNow && currentTrack && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-fadeIn">
                    <button
                        onClick={() => scrollToCurrent(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-full shadow-lg hover:bg-orange-600 transition-all hover:scale-105 active:scale-95 font-medium text-sm"
                    >
                        <span>Back to Playing</span>
                        <ArrowDown size={16} />
                    </button>
                </div>
            )}

        </div>
    );
}

PlaylistView.propTypes = {
    history: PropTypes.array,
    currentTrack: PropTypes.object,
    queue: PropTypes.array,
    user: PropTypes.object,
    onVote: PropTypes.func,
    votes: PropTypes.object,
    isOwner: PropTypes.bool,
    progress: PropTypes.number,
    volume: PropTypes.number,
    isMuted: PropTypes.bool,
    activeChannel: PropTypes.string,
    onMuteToggle: PropTypes.func,
    onVolumeChange: PropTypes.func,
    votesEnabled: PropTypes.bool,
    onPreview: PropTypes.func,
};
