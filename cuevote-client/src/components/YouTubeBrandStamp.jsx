// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import React from 'react';
import { Language } from '../contexts/LanguageContext';
import { YouTubeBrandmark } from './YouTubeBrandmark';

// Right-aligned "powered by YouTube" stamp, used inside an active
// channel/room as a thin row above the main header. Required wherever
// YouTube thumbnails, titles, channel names, or video metadata are
// rendered (YouTube API Services Terms — Required Minimum Functionality
// and Attribution sections).
//
// Rendered inline (not fixed-positioned) so it gets its own row in the
// layout — the header sits cleanly below it without any overlap with
// settings/share/logout buttons. Scrolls/sticks with the parent sticky
// header. Hidden in Cinema Mode because the parent header is itself
// already hidden during fullscreen playback.
export function YouTubeBrandStamp() {
	const { t } = Language.useLanguage();
	return (
		<div className="flex justify-end items-center gap-1.5 px-3 py-1 text-[10px] text-neutral-400 select-none border-b border-neutral-900/50 bg-black/40">
			<YouTubeBrandmark className="h-3 w-auto" />
			<span>{t('attribution.youtube')}</span>
		</div>
	);
}
