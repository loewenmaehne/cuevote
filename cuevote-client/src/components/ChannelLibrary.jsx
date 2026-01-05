import React, { useMemo, useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { X, Search, Library, Music2 } from "lucide-react";
import { useLanguage } from '../contexts/LanguageContext';
import { Track } from "./Track";

export function ChannelLibrary({
	history = [],
	onExit,
	activeChannel,
	onAdd, // New prop to add song to queue
	isOwner,
	onDelete,
	onPreview,
	onRecommend,
	activeSuggestionId,
	suggestions,
	isFetchingSuggestions,
	queueVideoIds,
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedTrackId, setExpandedTrackId] = useState(null);
	const { t } = useLanguage();

	// Infinite Scroll State
	const [displayedCount, setDisplayedCount] = useState(50);
	const observerTarget = useRef(null);

	const handleToggleExpand = (trackId) => {
		setExpandedTrackId((prev) => (prev === trackId ? null : trackId));
	};

	// Deduplicate history to get unique songs
	// Only valid if videoId is present
	const uniqueSongs = useMemo(() => {
		const map = new Map();
		history.forEach(track => {
			if (track.videoId && !map.has(track.videoId)) {
				map.set(track.videoId, track);
			}
		});
		return Array.from(map.values()).reverse();
	}, [history]);

	const filteredSongs = useMemo(() => {
		const now = Date.now();
		const TWENTY_EIGHT_DAYS_MS = 28 * 24 * 60 * 60 * 1000;

		let result = uniqueSongs.filter(song => {
			if (!song.playedAt) return false;
			const age = now - song.playedAt;
			return age < TWENTY_EIGHT_DAYS_MS;
		});

		if (searchQuery.trim()) {
			const lowerQ = searchQuery.toLowerCase();
			result = result.filter(song =>
				(song.title && song.title.toLowerCase().includes(lowerQ)) ||
				(song.artist && song.artist.toLowerCase().includes(lowerQ))
			);
		}

		return result;
	}, [uniqueSongs, searchQuery]);

	// Reset displayed count when search changes
	useEffect(() => {
		setDisplayedCount(50);
	}, [searchQuery]);

	const visibleSongs = useMemo(() => {
		return filteredSongs.slice(0, displayedCount);
	}, [filteredSongs, displayedCount]);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && displayedCount < filteredSongs.length) {
					console.log("Loading more items...");
					setDisplayedCount((prev) => prev + 50);
				}
			},
			{ threshold: 0.1 } // Trigger when 10% of sentinel is visible
		);

		if (observerTarget.current) {
			observer.observe(observerTarget.current);
		}

		return () => {
			if (observerTarget.current) {
				observer.unobserve(observerTarget.current);
			}
		};
	}, [observerTarget, displayedCount, filteredSongs.length]);


	return (
		<div className="w-full h-full flex flex-col bg-[#0a0a0a] text-white md:animate-in md:fade-in md:slide-in-from-bottom-10 md:duration-300">

			{/* Search */}
			<div className="p-4 border-b border-neutral-800 bg-black/20 backdrop-blur-md">
				<div className="relative max-w-2xl mx-auto">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
					<input
						type="text"
						placeholder={t('library.searchPlaceholder')}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-500 transition-colors"
					/>
				</div>
				<p className="text-xs text-neutral-500 text-center mt-3 font-medium">
					<span className="text-orange-500">{filteredSongs.length}</span> {t('header.songs')} {t('library.inLibrary')}
				</p>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto custom-scrollbar p-4">
				{!searchQuery && (
					<div className="mb-6 max-w-lg mx-auto bg-neutral-900/40 p-4 rounded-xl border border-neutral-800/50">
						<p className="text-sm text-neutral-400 text-center leading-relaxed" dangerouslySetInnerHTML={{ __html: t('library.info1') }}></p>
						<p className="text-xs text-neutral-500 text-center mt-2 leading-relaxed px-4" dangerouslySetInnerHTML={{ __html: t('library.info2') }}></p>
					</div>
				)}

				<div className="space-y-2 max-w-3xl mx-auto">
					{visibleSongs.length > 0 ? (
						<>
							{visibleSongs.map((track, i) => (
								<Track
									key={`lib-${track.videoId}-${i}`}
									track={track}
									isActive={false}
									isExpanded={expandedTrackId === `lib-${track.videoId}-${i}`}
									readOnly={true}
									votesEnabled={false}
									onToggleExpand={() => handleToggleExpand(`lib-${track.videoId}-${i}`)}
									// Pass onAdd directly, Track ensures ID is passed
									onAdd={onAdd}
									onDelete={onDelete ? () => onDelete(track.videoId) : undefined}
									onPreview={onPreview}
									onRecommend={onRecommend}
									activeSuggestionId={activeSuggestionId}
									suggestions={suggestions}
									isFetchingSuggestions={isFetchingSuggestions}
									queueVideoIds={queueVideoIds}
								/>
							))}
							{/* Sentinel for Infinite Scroll */}
							<div ref={observerTarget} className="h-4 w-full" />
						</>
					) : (
						<div className="flex flex-col items-center justify-center py-20 text-neutral-600 gap-4">
							<Music2 size={48} className="opacity-20" />
							<p>{t('library.empty')}</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

ChannelLibrary.propTypes = {
	history: PropTypes.array.isRequired,
	onExit: PropTypes.func.isRequired,
	activeChannel: PropTypes.string,
	onAdd: PropTypes.func,
	isOwner: PropTypes.bool,
	onDelete: PropTypes.func,
	onPreview: PropTypes.func,
	onRecommend: PropTypes.func,
	activeSuggestionId: PropTypes.string,
	suggestions: PropTypes.array,
	isFetchingSuggestions: PropTypes.bool,
};
