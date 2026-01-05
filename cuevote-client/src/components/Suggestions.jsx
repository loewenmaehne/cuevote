import React from 'react';
import { Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export function Suggestions({ suggestions, onAdd }) {
	const { t } = useLanguage();

	if (!suggestions || suggestions.length === 0) return null;

	return (
		<div className="w-full max-w-4xl mx-auto my-6 px-4">
			<h3 className="text-gray-400 text-sm font-medium mb-3 uppercase tracking-wider">
				{t('suggestions.title', 'You might also like')}
			</h3>

			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
				{suggestions.map((video) => (
					<div
						key={video.videoId}
						className="group relative bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-colors cursor-pointer"
						onClick={() => onAdd(video.videoId)}
					>
						{/* Thumbnail */}
						<div className="aspect-video w-full overflow-hidden relative">
							<img
								src={video.thumbnail}
								alt={video.title}
								className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
							/>
							{/* Overlay Icon */}
							<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
								<Plus className="w-8 h-8 text-white drop-shadow-lg" />
							</div>
						</div>

						{/* Info */}
						<div className="p-2">
							<h4 className="text-white text-xs font-semibold line-clamp-2 leading-tight mb-1" title={video.title}>
								{video.title}
							</h4>
							<p className="text-gray-400 text-[10px] truncate">
								{video.artist}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
