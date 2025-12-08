import React, { useRef, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Play, SkipForward, Volume2, Check } from "lucide-react";
import { Track } from "./Track";

export function PlaylistView({
	history,
	currentTrack,
	queue,
	user,
	onVote,
	votes, // Now receiving votes
	isOwner,
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
								onVote={onVote} // Allow changing vote on current track? Standard queue allows it.
								onToggleExpand={handleToggleExpand}
								readOnly={true} // User requested "Playlist View" mostly for read-only? 
							// Wait, "keeping the voting mechanism etc" for FUTURE songs. 
							// Usually you can't vote on playing song in standard queue? 
							// Standard queue actually DOES show current track at the top if integrated? 
							// In standard App.jsx, current track is in Player, not Queue list.
							// So for visual parity, this should look like an active Track.
							// I'll keep it readOnly to match "Venue Mode" (no control), but maybe allow expanding.
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

			{/* Visual-Only "Now Playing" Bar (Mock Player) */}
			{currentTrack && (
				<div className="absolute bottom-0 left-0 w-full bg-[#0a0a0a]/95 backdrop-blur-md border-t border-neutral-800 px-6 py-4 flex items-center justify-between z-20 select-none">

					{/* Left: Track Info */}
					<div className="flex items-center gap-4 w-1/3">
						<img src={currentTrack.thumbnail} alt="" className="w-12 h-12 rounded bg-neutral-900 object-cover" />
						<div className="min-w-0">
							<h4 className="font-bold text-white text-sm truncate">{currentTrack.title}</h4>
							<p className="text-neutral-500 text-xs truncate">{currentTrack.artist}</p>
						</div>
					</div>

					{/* Center: Fake Controls */}
					<div className="flex flex-col items-center gap-2 w-1/3 opacity-50 cursor-not-allowed" title="Controls disabled in Venue Mode">
						<div className="flex items-center gap-6">
							<SkipForward size={20} className="rotate-180 text-neutral-500" />
							<div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
								<div className="w-2.5 h-2.5 bg-black rounded-sm" /> {/* Pause icon ish */}
							</div>
							<SkipForward size={20} className="text-neutral-500" />
						</div>
						<div className="w-full max-w-[200px] h-1 bg-neutral-800 rounded-full overflow-hidden">
							<div className="h-full w-1/2 bg-neutral-600 rounded-full" />
						</div>
					</div>

					{/* Right: Fake Volume Slider */}
					<div className="flex items-center justify-end gap-2 w-1/3 opacity-50 cursor-not-allowed">
						<Volume2 size={18} className="text-neutral-500" />
						<div className="w-24 h-1 bg-neutral-800 rounded-full relative">
							<div className="absolute left-0 top-0 h-full w-[80%] bg-neutral-600 rounded-full" />
						</div>
					</div>
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
};
