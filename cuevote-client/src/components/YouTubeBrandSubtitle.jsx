// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import React from 'react';
import PropTypes from 'prop-types';
import { Language } from '../contexts/LanguageContext';

// Inline "powered by YouTube" credit, designed to live underneath the
// CueVote wordmark (or beside a fullscreen-page title). Required wherever
// YouTube thumbnails, titles, channel names, or video metadata are rendered
// (YouTube API Services Terms — Required Minimum Functionality and
// Attribution sections).
//
// Text-only by design — the localised "Powered by YouTube" string already
// names the service and reads as a clean tagline under the CueVote brand.
// The official YouTube brandmark is available in YouTubeBrandmark.jsx if a
// future surface wants to use it; YouTube's Terms accept text-only
// attribution as visible credit.
//
// Rendered inline as a flex item so it integrates with the surrounding
// layout — never a floating overlay. Cinema Mode auto-handles itself: the
// header that hosts this subtitle is already hidden during fullscreen
// playback, and the IFrame player surfaces its own YouTube logo
// bottom-right.
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
