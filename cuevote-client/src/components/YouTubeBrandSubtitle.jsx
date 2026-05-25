// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import React from 'react';
import PropTypes from 'prop-types';
import { Language } from '../contexts/LanguageContext';

// Text-only "Powered by YouTube" tagline, used under the CueVote wordmark
// on the Lobby and beside fullscreen-page titles (PendingRequestsPage,
// BannedVideosPage). Required wherever YouTube thumbnails, titles, channel
// names, or video metadata are rendered (YouTube API Services Terms —
// Required Minimum Functionality and Attribution sections).
//
// No brandmark by design here — the localised string already names the
// service and a red icon under the orange CueVote wordmark felt visually
// heavy. Inside an active channel the attribution is handled by
// YouTubeBrandStamp (with brandmark) — that header has space to spare on
// the right edge, so the visual indicator fits naturally there.
export function YouTubeBrandSubtitle({ className = '' }) {
	const { t } = Language.useLanguage();
	return (
		<div
			className={`text-[10px] text-neutral-500 select-none ${className}`}
		>
			{t('attribution.youtube')}
		</div>
	);
}

YouTubeBrandSubtitle.propTypes = {
	className: PropTypes.string,
};
