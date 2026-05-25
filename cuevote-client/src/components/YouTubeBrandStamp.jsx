// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import React from 'react';
import { Language } from '../contexts/LanguageContext';
import { YouTubeBrandmark } from './YouTubeBrandmark';

// "Powered by YouTube" badge with the official brandmark, designed to sit
// as the last flex item inside the channel/room header bar. Required
// wherever YouTube thumbnails, titles, channel names, or video metadata
// are rendered (YouTube API Services Terms — Required Minimum
// Functionality and Attribution sections).
//
// Inline by design — the room header has free space on the right edge
// (the action buttons all live on the left), so an integrated badge fits
// naturally without any layout-push, fixed positioning, or z-index
// gymnastics. Cinema Mode hides itself automatically because the parent
// header is already hidden during fullscreen playback (the IFrame player
// surfaces its own YouTube logo there).
//
// On smaller viewports the localised text is hidden to keep the badge
// from competing with the scrollable channel pills next to it; the
// brandmark alone is permitted attribution under YouTube's Brand
// Guidelines.
export function YouTubeBrandStamp() {
	const { t } = Language.useLanguage();
	return (
		<div
			className="flex-shrink-0 flex items-center gap-1.5 px-2 text-[10px] text-neutral-500 select-none"
			aria-label="Powered by YouTube"
		>
			<YouTubeBrandmark className="h-3 w-auto" />
			<span className="hidden md:inline">{t('attribution.youtube')}</span>
		</div>
	);
}
