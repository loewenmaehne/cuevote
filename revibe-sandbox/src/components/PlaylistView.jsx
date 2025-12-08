import React, { useRef, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Play, SkipForward, Volume2, Check } from "lucide-react";
import { Track } from "./Track";
import { PlaybackControls } from "./PlaybackControls";

export function PlaylistView({
    history,
    currentTrack,
    queue,
    user,
    onVote,
    votes, // Now receiving votes
    isOwner,
    // Playback Props
    progress,
    volume,
    isMuted,
    activeChannel,
    onMuteToggle,
    onVolumeChange,
}) {
    const scrollRef = useRef(null);
    const [expandedTrackId, setExpandedTrackId] = useState(null);

    const handleToggleExpand = (trackId) => {
        setExpandedTrackId((prev) => (prev === trackId ? null : trackId));
    };

    // Scroll to current track on mount
    useEffect(() => {
        if (scrollRef.current) {
            // Find current track element
            const currentEl = document.getElementById("playlist-current-track");
            if (currentEl) {
                currentEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [currentTrack?.id]);

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-white relative">
            {/* Header */}
            <div className="p-4 border-b border-neutral-800 bg-[#0a0a0a]/95 backdrop-blur z-10 sticky top-0 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-orange-500 flex items-center gap-2">
                        <span>Playlist</span>
                        <span className="text-xs font-normal text-neutral-500 uppercase tracking-widest px-2 py-0.5 border border-neutral-800 rounded-full">Venue Mode</span>
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1">
                        Now Playing: {currentTrack?.title || "Nothing"}
                    </p>
                </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto px-4 pb-24 custom-scrollbar scroll-smooth" ref={scrollRef}>
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
                            // User said "Playing and Up Next is fine". 
                            // So the track items are fine.
                            />
                        </div>
                    )}

                    {/* Queue Section */}
                    {queue.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-2 pb-2 border-b border-neutral-800 mt-4">
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Up Next</span>
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">{queue.length}</span>
                            </div>
                            {queue.map((track) => (
                                <Track
                                    key={track.id}
                                    track={track}
                                    isActive={false} // Queue items aren't active
                                    isExpanded={expandedTrackId === track.id}
                                    vote={votes?.[track.id]} // Pass actual vote
                                    onVote={onVote}
                                    onToggleExpand={handleToggleExpand}
                                    readOnly={false} // Interactive
                                />
                            ))}
                        </div>
                    ) : (
                        !currentTrack && (
                            <div className="text-center py-20 opacity-50">
                                <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Play size={24} className="text-neutral-700 ml-1" />
                                </div>
                                <h3 className="text-lg font-medium text-neutral-400">Queue is empty</h3>
                                <p className="text-sm text-neutral-600 mt-1">Suggest a song to get started!</p>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Real Playback Controls (Read-Only/Disabled for Guest) */}
            <PlaybackControls
                isPlaying={!!currentTrack} // Show as playing if track exists (Venue Mode usually runs)
                onPlayPause={() => { }} // Disabled
                progress={progress}
                currentTrack={currentTrack}
                activeChannel={activeChannel}
                isMuted={isMuted} // Visualize current local mute state? Or forced mute?
                // "without video/audio playback" means locally it IS muted or no player.
                // But we want to show it "similar" to real one.
                // If we pass `true`, volume icon is muted.
                onMuteToggle={onMuteToggle} // Allow toggling local mute preference? Even if no audio?
                // Maybe just disable.
                volume={volume}
                onVolumeChange={onVolumeChange}
                onMinimizeToggle={() => { }}
            />
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
};
