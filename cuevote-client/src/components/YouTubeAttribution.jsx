// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import React, { useEffect, useState } from 'react';
import { Language } from '../contexts/LanguageContext';
import { YouTubeBrandmark } from './YouTubeBrandmark';

// Global "Powered by YouTube" credit, mounted once at the app root. Required
// wherever YouTube thumbnails, titles, channel names, or video metadata are
// rendered (YouTube API Services Terms — Required Minimum Functionality and
// Attribution sections). Sits at z-[200] so it stays visible above every
// modal and fullscreen overlay where YouTube data could appear (the pending
// requests page, banned-videos page, venue/playlist view, etc).
//
// Hidden in Cinema Mode: the YouTube IFrame's own logo (bottom-right of the
// player) already satisfies the attribution requirement, and a second stamp
// over fullscreen playback would only clutter the view. The visibility check
// reads body.is-cinema-mode (set by RoomBody alongside is-mobile/is-tablet).
//
// On mobile the lokalised "Powered by YouTube" text is hidden — the brandmark
// alone is permitted by the Brand Guidelines and saves scarce screen edge.
export function YouTubeAttribution() {
	const { t } = Language.useLanguage();
	const [hidden, setHidden] = useState(false);

	useEffect(() => {
		const check = () => setHidden(document.body.classList.contains('is-cinema-mode'));
		check();
		const observer = new MutationObserver(check);
		observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
		return () => observer.disconnect();
	}, []);

	if (hidden) return null;

	return (
		<div
			className="fixed top-2 right-2 z-[200] flex items-center gap-1.5 text-[10px] text-neutral-400 select-none pointer-events-none bg-black/50 backdrop-blur-sm rounded-md px-2 py-1 border border-white/5"
			aria-label="Powered by YouTube"
		>
			<YouTubeBrandmark className="h-3 w-auto" />
			<span className="hidden sm:inline">{t('attribution.youtube')}</span>
		</div>
	);
}
