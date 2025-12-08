import React, { useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { ThumbsUp, ThumbsDown, Check, Play, SkipForward, Volume2 } from "lucide-react";

export function PlaylistView({
	history,
	currentTrack,
	queue,
	user,
	onVote,
	isOwner,
}) {
	const scrollRef = useRef(null);

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

	const formatDuration = (seconds) => {
		if (!seconds) return "0:00";
		const min = Math.floor(seconds / 60);
		const sec = seconds % 60;
		return `${min}:${sec.toString().padStart(2, "0")}`;
	};

	// Helper to render a track row with Queue-like styling
	const renderRow = (track, type, index) => {
		const isHistory = type === 'history';
		const isCurrent = type === 'current';

		const userVote = track.voters?.[user?.id];
		const score = track.score || 0;

		return (
			<div
				key={track.id + (isHistory ? "_hist_" + index : "")}
				id={isCurrent ? "playlist-current-track" : undefined}
				className={`group flex items-center gap-3 p-3 rounded-xl border transition-all duration-300
                ${isCurrent
						? "bg-neutral-800/80 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.1)]"
						: "bg-neutral-900/40 border-transparent hover:bg-neutral-800/60 hover:border-neutral-700"}
                ${isHistory ? "opacity-50 grayscale hover:opacity-100 hover:grayscale-0" : "opacity-100"}
            `}
			>
				{/* Rank / Status Icon */}
				<div className="w-8 flex justify-center text-neutral-500 font-mono text-sm">
					{isCurrent ? (
						<div className="w-4 h-4 rounded-full bg-orange-500 animate-pulse" />
					) : isHistory ? (
						<Check size={16} />
					) : (
						<span className="group-hover:hidden">{index + 1}</span>
					)}
				</div>

				{/* Thumbnail */}
				<div className="relative">
					<img
						src={track.thumbnail}
						alt={track.title}
						className={`w-12 h-12 rounded-lg object-cover shadow-sm ${isCurrent ? "ring-2 ring-orange-500/50" : ""}`}
					/>
				</div>

				{/* Title & Artist */}
				<div className="flex-1 min-w-0">
					<h4 className={`font-medium truncate text-base ${isCurrent ? "text-orange-500" : "text-neutral-200 group-hover:text-white"}`}>
						{track.title}
					</h4>
					<div className="flex items-center gap-2">
						<p className="text-sm text-neutral-500 truncate">{track.artist}</p>
						<span className="text-xs text-neutral-600">•</span>
						<span className="text-xs text-neutral-600">
							{track.suggestedByUsername || "Anonymous"}
						</span>
					</div>
				</div>

				{/* Actions (Only for Future/Current?) */}
				<div className="flex items-center gap-4">
					{/* Vote Controls (Only for Queue items) */}
					{!isHistory && !isCurrent && (
						<div className="flex items-center gap-1 bg-neutral-950 rounded-lg p-1 border border-neutral-800">
							<button
								onClick={() => onVote(track.id, 'up')}
								className={`p-1.5 rounded-md transition-all ${userVote === 'up' ? 'bg-green-500/20 text-green-400' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`}
							>
								<ThumbsUp size={14} className={userVote === 'up' ? 'fill-current' : ''} />
							</button>
							<span className={`text-xs font-bold w-6 text-center ${score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-neutral-500'}`}>
								{score}
							</span>
							<button
								onClick={() => onVote(track.id, 'down')}
								className={`p-1.5 rounded-md transition-all ${userVote === 'down' ? 'bg-red-500/20 text-red-400' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`}
							>
								<ThumbsDown size={14} className={userVote === 'down' ? 'fill-current' : ''} />
							</button>
						</div>
					)}

					{/* Duration */}
					<div className="text-sm font-mono text-neutral-500 w-10 text-right">
						{formatDuration(track.duration)}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="flex flex-col h-full bg-[#0a0a0a] text-white relative">
			{/* List Container */}
			<div className="flex-1 overflow-y-auto custom-scrollbar p-6 scroll-smooth" ref={scrollRef}>
				<div className="max-w-3xl mx-auto space-y-6 pb-24">

					{/* History Section */}
					{history.length > 0 && (
						<div className="space-y-2">
							<div className="flex items-center gap-2 px-2 pb-2 border-b border-neutral-800">
								<span className="text-xs font-bold text-neutral-600 uppercase tracking-widest">Previously Played</span>
								<span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-900 text-neutral-600 font-mono">{history.length}</span>
							</div>
							{history.map((track, i) => renderRow(track, 'history', i))}
						</div>
					)}

					{/* Current Track Section */}
					{currentTrack && (
						<div className="space-y-4 py-2">
							{renderRow(currentTrack, 'current', 0)}
						</div>
					)}

					{/* Queue Section */}
					{queue.length > 0 ? (
						<div className="space-y-2">
							<div className="flex items-center gap-2 px-2 pb-2 border-b border-neutral-800 mt-4">
								<span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Up Next</span>
								<span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">{queue.length}</span>
							</div>
							{queue.map((track, i) => renderRow(track, 'queue', i))}
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
			{/* The user requested "The volume slider" specifically, implying they miss the visual of the player bar. */}
			{/* We render a disabled/visual version of the PlaybackControls footer */}
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
	isOwner: PropTypes.bool,
};
