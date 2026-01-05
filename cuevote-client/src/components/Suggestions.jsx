import React from 'react';
import { Plus, Headphones } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { isMobile } from '../utils/deviceDetection';

export function Suggestions({ suggestions, onAdd, onPreview }) {
	const { t } = useLanguage();
	const mobile = isMobile();

	// Local state to track added videos to prevent duplicates/spam
	const [addedIds, setAddedIds] = React.useState(new Set());

	if (!suggestions || suggestions.length === 0) return null;

	const handleAdd = (e, videoId) => {
		e.stopPropagation();
		if (addedIds.has(videoId)) return;

		setAddedIds(prev => new Set(prev).add(videoId));
		onAdd(videoId);
	};

	return (
		<div className="flex gap-4 overflow-x-auto pb-4 px-1 scroll-smooth snap-x snap-mandatory custom-scrollbar">
			{suggestions.map((video) => {
				const isAdded = addedIds.has(video.videoId);
				return (
					<div
						key={video.videoId}
						className={`group relative flex-shrink-0 w-40 snap-start bg-white/5 rounded-xl overflow-hidden hover:bg-white/10 transition-all cursor-pointer border border-white/5 ${isAdded ? 'opacity-50 grayscale' : ''}`}
						onClick={(e) => !isAdded && handleAdd(e, video.videoId)}
					>
						{/* Thumbnail */}
						<div className="aspect-video w-full overflow-hidden relative">
							<img
								src={video.thumbnail}
								alt={video.title}
								className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
								loading="lazy"
							/>
							{/* Overlay Icons */}
							{!isAdded && (
								<div className={`absolute inset-0 transition-opacity flex items-center justify-center gap-3 ${mobile
									? "opacity-100 bg-black/30"
									: "opacity-0 group-hover:opacity-100 bg-black/60"
									}`}>
									{onPreview && (
										<button
											onClick={(e) => {
												e.stopPropagation();
												onPreview(video);
											}}
											className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors hover:scale-110 active:scale-95"
											title={t('track.preview')}
										>
											<Headphones size={20} />
										</button>
									)}
									<button
										onClick={(e) => handleAdd(e, video.videoId)}
										className="p-2 rounded-full bg-orange-500 hover:bg-orange-400 text-white transition-colors hover:scale-110 active:scale-95 shadow-lg"
										title={t('track.add')}
									>
										<Plus size={20} />
									</button>
								</div>
							)}
							{isAdded && (
								<div className="absolute inset-0 flex items-center justify-center bg-black/60">
									<span className="text-green-500 font-bold text-xs uppercase tracking-wider">{t('track.added', 'Added')}</span>
								</div>
							)}
						</div>

						{/* Info */}
						<div className="p-3">
							<h4 className="text-white text-xs font-bold line-clamp-2 leading-tight mb-1 whitespace-normal h-8" title={video.title}>
								{video.title}
							</h4>
							<p className="text-orange-400/80 text-[10px] truncate font-medium">
								{video.artist}
							</p>
						</div>
					</div>
				);
			})}
		</div>

	);
}
