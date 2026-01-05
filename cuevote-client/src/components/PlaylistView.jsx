import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useLanguage } from '../contexts/LanguageContext';
import { Track } from "./Track";

export function PlaylistView({
    history,
    currentTrack,
    queue,
    onVote,
    votes,
    progress,
    volume,
    isMuted,
    activeChannel,
    onMuteToggle,
    onVolumeChange,
    votesEnabled = true,
    onPreview,
    onExit,
    onDelete,
    onRecommend,
    onAdd,
    activeSuggestionId, // <--- New Prop
    suggestions,        // <--- New Prop
    isFetchingSuggestions // <--- New Prop
}) {
    const scrollRef = useRef(null);
    const [expandedTrackId, setExpandedTrackId] = useState(null);
    const [showJumpToNow, setShowJumpToNow] = useState(false);
    const [jumpDirection, setJumpDirection] = useState("down");
    const { t } = useLanguage();

    const handleToggleExpand = (trackId) => {
        setExpandedTrackId((prev) => (prev === trackId ? null : trackId));
    };

    // Helper to scroll to current track
    const scrollToCurrent = (smooth = true) => {
        if (scrollRef.current) {
            const currentEl = document.getElementById("playlist-current-track");
            if (currentEl) {
                setShowJumpToNow(false);
                currentEl.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
            }
        }
    };

    // IntersectionObserver to watch "Now Playing" visibility
    useEffect(() => {
        const currentEl = document.getElementById("playlist-current-track");
        if (!currentEl) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                const isVisible = entry.isIntersecting;
                setShowJumpToNow(!isVisible);

                if (!isVisible) {
                    // Check bounding rect relative to viewport
                    const { top } = entry.boundingClientRect;
                    // If top is negative, it rolled off the top (we are below it) -> UP
                    // If top is positive, it rolled off the bottom (we are above it) -> DOWN
                    // Wait, if scrolled DOWN past it, top is negative. Jump should point UP.
                    // If scrolled UP before it, top is positive (below viewport). Jump should point DOWN.
                    setJumpDirection(top < 0 ? "up" : "down");
                }
            },
            {
                root: null, // Watch relative to VIEWPORT
                threshold: 0
            }
        );

        observer.observe(currentEl);

        return () => {
            observer.disconnect();
        };
    }, [currentTrack?.id]);

    // Initial Scroll
    useEffect(() => {
        if (!showJumpToNow) {
            scrollToCurrent();
        }
    }, [currentTrack?.id]);

    const filteredQueue = queue.filter(t => t.id !== currentTrack?.id);

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-white relative">
            <div
                className="flex-1 overflow-y-auto px-4 pb-24 custom-scrollbar scroll-smooth relative"
                ref={scrollRef}
            >
                {/* Exit Button - Floating Fixed */}
                {onExit && (
                    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                        <button
                            onClick={onExit}
                            className="pointer-events-auto flex items-center gap-2 px-6 py-2.5 bg-black/80 backdrop-blur-md text-orange-500 rounded-full hover:bg-neutral-800 transition-all shadow-xl border border-white/10 hover:scale-105 active:scale-95 group"
                        >
                            <span className="text-sm font-bold">{t('playlist.close')}</span>
                            <X size={18} />
                        </button>
                    </div>
                )}

                <div className="max-w-3xl mx-auto space-y-4 py-6 pt-2">
                    {/* History */}
                    {history.length > 0 && (
                        <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity duration-300">
                            <div className="flex items-center gap-2 px-2 pb-2 border-b border-neutral-800">
                                <span className="text-xs font-bold text-neutral-600 uppercase tracking-widest">{t('playlist.history')}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-900 text-neutral-600 font-mono">
                                    {history.length > 50 ? t('playlist.last50', { count: history.length }) : history.length}
                                </span>
                            </div>
                            {history.slice(-50).map((track, i) => (
                                <Track
                                    key={`hist-${track.id}-${i}`}
                                    track={track}
                                    isActive={false}
                                    isExpanded={expandedTrackId === `hist-${track.id}-${i}`}
                                    vote={null}
                                    onVote={() => { }}
                                    onToggleExpand={() => handleToggleExpand(`hist-${track.id}-${i}`)}
                                    readOnly={true}
                                    votesEnabled={votesEnabled}
                                    onRecommend={onRecommend}
                                    onAddSuggestion={onAdd} // Enable Suggestion Adds, but not Track Add
                                    onPreview={onPreview}
                                    activeSuggestionId={activeSuggestionId}
                                    suggestions={suggestions}
                                    isFetchingSuggestions={isFetchingSuggestions}
                                />
                            ))}
                        </div>
                    )}

                    {/* Current Track */}
                    {currentTrack && (
                        <div id="playlist-current-track" className="space-y-2 py-4">
                            <div className="flex items-center gap-2 px-2 pb-2">
                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">{t('playlist.nowPlaying')}</span>
                            </div>
                            <Track
                                track={currentTrack}
                                isActive={true}
                                isExpanded={expandedTrackId === currentTrack.id}
                                vote={votes?.[currentTrack.id] || null}
                                onVote={onVote}
                                onToggleExpand={handleToggleExpand}
                                readOnly={true}
                                votesEnabled={votesEnabled}
                                onDelete={onDelete}
                                onRecommend={onRecommend}
                                onAdd={onAdd} // Added for Re-Queue
                                activeSuggestionId={activeSuggestionId}
                                suggestions={suggestions}
                                isFetchingSuggestions={isFetchingSuggestions}
                            />
                        </div>
                    )}

                    {/* Queue */}
                    {filteredQueue.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-2 pb-2 border-b border-neutral-800 mt-4">
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{t('playlist.upNext')}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">{filteredQueue.length}</span>
                            </div>
                            {filteredQueue.map((track) => (
                                <Track
                                    key={track.id}
                                    track={track}
                                    isActive={false}
                                    isExpanded={expandedTrackId === track.id}
                                    vote={votes?.[track.id]}
                                    onVote={onVote}
                                    onToggleExpand={handleToggleExpand}
                                    readOnly={false}
                                    votesEnabled={votesEnabled}
                                    onPreview={onPreview}
                                    onDelete={onDelete}
                                    onRecommend={onRecommend}
                                    onAdd={onAdd} // Fix: Missing onAdd in Queue
                                    activeSuggestionId={activeSuggestionId}
                                    suggestions={suggestions}
                                    isFetchingSuggestions={isFetchingSuggestions}
                                />
                            ))}
                        </div>
                    ) : (
                        !currentTrack && (
                            <div className="flex h-64 w-full items-center justify-center text-neutral-500 bg-[#0a0a0a]">
                                <span className="text-lg">{t('playlist.queueEmpty')}</span>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Back to Now Button - Portal to escape potential masks/fades */}
            {showJumpToNow && currentTrack && createPortal(
                <div className="fixed bottom-8 right-8 z-[100] animate-fadeIn">
                    <button
                        onClick={() => scrollToCurrent(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-full shadow-lg hover:bg-orange-600 hover:shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0 font-medium text-sm"
                    >
                        <span>{t('playlist.backToNow')}</span>
                        {jumpDirection === 'up' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </button>
                </div>,
                document.body
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
    onExit: PropTypes.func,
    onRecommend: PropTypes.func,
    onAdd: PropTypes.func,
    activeSuggestionId: PropTypes.string,
    suggestions: PropTypes.array,
    isFetchingSuggestions: PropTypes.bool,
};
