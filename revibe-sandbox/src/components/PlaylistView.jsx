import React, { useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { Clock, ThumbsUp, ThumbsDown } from "lucide-react";

export function PlaylistView({
	history,
	currentTrack,
	queue,
	user,
	onVote,
	isOwner,
}) {
	const scrollRef = useRef(null);

	// Scroll to current track on mount or change
	useEffect(() => {
		if (scrollRef.current) {
			// Simple logic: scroll to the "current track" element roughly
			// We can add an ID to the current track row
			const currentEl = document.getElementById("playlist-current-track");
			if (currentEl) {
				currentEl.scrollIntoView({ behavior: "smooth", block: "center" });
			}
		}
	}, [currentTrack?.id]);

	const formatDuration = (seconds) => {
		const min = Math.floor(seconds / 60);
		const sec = seconds % 60;
		return `${min}:${sec.toString().padStart(2, "0")}`;
	};

	return (
		<div className="flex flex-col h-full bg-[#0a0a0a] text-white">
			{/* Header */}
			<div className="p-4 border-b border-neutral-800 bg-[#0a0a0a]/95 backdrop-blur z-10 sticky top-0">
				<h2 className="text-xl font-bold text-orange-500 flex items-center gap-2">
					<span>Playlist</span>
					<span className="text-xs font-normal text-neutral-500 uppercase tracking-widest px-2 py-0.5 border border-neutral-800 rounded-full">Venue Mode</span>
				</h2>
				<p className="text-xs text-neutral-500 mt-1">
					Now Playing: {currentTrack?.title || "Nothing"}
				</p>
			</div>

			{/* Scrollable List */}
			<div className="flex-1 overflow-y-auto p-4 custom-scrollbar" ref={scrollRef}>
				<div className="max-w-4xl mx-auto space-y-1">

					{/* History Section */}
					{history.length > 0 && (
						<div className="mb-4">
							<div className="text-xs font-bold text-neutral-600 uppercase tracking-wider mb-2 px-2">History</div>
							{history.map((track) => (
								<div key={track.id + "_hist"} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900/40 border border-transparent opacity-60 grayscale hover:grayscale-0 hover:opacity-80 transition-all">
									<span className="text-neutral-600 w-6 text-center text-xs">✔</span>
									<img src={track.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
									<div className="flex-1 min-w-0">
										<h4 className="font-medium text-neutral-400 truncate text-sm">{track.title}</h4>
										<p className="text-xs text-neutral-600 truncate">{track.artist}</p>
									</div>
									<div className="text-xs text-neutral-600 font-mono">
										{formatDuration(track.duration)}
									</div>
								</div>
							))}
						</div>
					)}

					{/* Current Track */}
					{currentTrack && (
						<div id="playlist-current-track" className="my-6">
							<div className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
								<span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
								Now Playing
							</div>
							<div className="flex items-center gap-4 p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 shadow-[0_0_30px_-5px_rgba(249,115,22,0.15)] transform scale-[1.02] transition-all">
								<img src={currentTrack.thumbnail} alt="" className="w-14 h-14 rounded-lg object-cover shadow-lg" />
								<div className="flex-1 min-w-0">
									<h4 className="font-bold text-white text-lg truncate drop-shadow-sm">{currentTrack.title}</h4>
									<p className="text-sm text-orange-200/80 truncate font-medium">{currentTrack.artist}</p>
									<div className="flex items-center gap-3 mt-2">
										<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/20">
											Suggested by {currentTrack.suggestedByUsername || "User"}
										</span>
									</div>
								</div>
								<div className="text-sm font-bold text-orange-500 font-mono bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/20">
									{formatDuration(currentTrack.duration)}
								</div>
							</div>
						</div>
					)}

					{/* Upcoming Queue */}
					{queue.length > 0 ? (
						<div>
							<div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 px-2">Up Next</div>
							{queue.map((track, i) => {
								const userVote = track.voters?.[user?.id];
								const score = track.score || 0;

								return (
									<div key={track.id} className="group flex items-center gap-3 p-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all">
										<div className="text-neutral-500 w-6 text-center text-sm font-mono">{i + 1}</div>
										<img src={track.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
										<div className="flex-1 min-w-0">
											<h4 className="font-medium text-neutral-200 truncate text-sm group-hover:text-white transition-colors">{track.title}</h4>
											<p className="text-xs text-neutral-500 truncate">{track.artist}</p>
										</div>

										<div className="flex items-center gap-3">
											<div className="hidden sm:flex items-center gap-1 bg-neutral-950 rounded-lg p-1 border border-neutral-800">
												<button
													onClick={() => onVote(track.id, 'up')}
													className={`p-1.5 rounded-md transition-all ${userVote === 'up' ? 'bg-green-500/20 text-green-400' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`}
													title="Upvote"
												>
													<ThumbsUp size={14} className={userVote === 'up' ? 'fill-current' : ''} />
												</button>
												<span className={`text-xs font-bold w-6 text-center ${score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-neutral-500'}`}>
													{score}
												</span>
												<button
													onClick={() => onVote(track.id, 'down')}
													className={`p-1.5 rounded-md transition-all ${userVote === 'down' ? 'bg-red-500/20 text-red-400' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`}
													title="Downvote"
												>
													<ThumbsDown size={14} className={userVote === 'down' ? 'fill-current' : ''} />
												</button>
											</div>

											<div className="text-xs text-neutral-500 font-mono w-10 text-right">
												{formatDuration(track.duration)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<p className="text-center text-neutral-500 py-10 text-sm italic">Queue is empty. Suggest a song!</p>
					)}

				</div>
			</div>
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
