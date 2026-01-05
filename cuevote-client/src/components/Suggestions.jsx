import React from 'react';
import { Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export function Suggestions({ suggestions, onAdd }) {
	const { t } = useLanguage();

	if (!suggestions || suggestions.length === 0) return null;

	return (


		<div className="flex gap-4 overflow-x-auto pb-4 px-1 scroll-smooth snap-x snap-mandatory custom-scrollbar">
			{suggestions.map((video) => (
				<div
					key={video.videoId}
					className="group relative flex-shrink-0 w-40 snap-start bg-white/5 rounded-xl overflow-hidden hover:bg-white/10 transition-all cursor-pointer border border-white/5"
					onClick={() => onAdd(video.videoId)}
				>
					{/* Thumbnail */}
					<div className="aspect-video w-full overflow-hidden relative">
						<img
							src={video.thumbnail}
							alt={video.title}
							className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
							loading="lazy"
						/>
						{/* Overlay Icon */}
						<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
							<Plus className="w-8 h-8 text-white drop-shadow-lg scale-90 group-hover:scale-100 transition-transform" />
						</div>
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
			))}
		</div>
		</div >
	);
}
