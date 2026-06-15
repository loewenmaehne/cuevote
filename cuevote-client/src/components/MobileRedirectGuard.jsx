// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import React from 'react';
import { deviceDetection } from '../utils/deviceDetection';
import { MobileBlockPage } from './MobileBlockPage';

// Only devices that cannot run the web player are blocked — currently TVs
// (leanback), which need the native CueVote TV app. Phones run the web app:
// iOS AND Android browsers are put into Venue Mode by RoomBody, and Android
// additionally gets the in-app download footer (AppPromoFooter).
export const MobileRedirectGuard = ({ children }) => {
	// FAST FAIL before hooks/sockets: detect the native wrapper so the app shell
	// never flashes the block page inside the native app.
	const [isWrapper, setIsWrapper] = React.useState(() => {
		if (typeof window === 'undefined') return false;
		const ua = navigator.userAgent || navigator.vendor || window.opera;
		return ua.includes("CueVoteWrapper") || (typeof window.CueVoteAndroid !== 'undefined');
	});

	React.useEffect(() => {
		// Re-check after mount to catch any late injection / hydration mismatch.
		const checkWrapper = () => {
			const ua = navigator.userAgent || navigator.vendor || window.opera;
			const detected = ua.includes("CueVoteWrapper") || (typeof window.CueVoteAndroid !== 'undefined');
			if (detected && !isWrapper) setIsWrapper(true);
		};
		const timer = setTimeout(checkWrapper, 100);
		const timer2 = setTimeout(checkWrapper, 500); // Double check
		return () => {
			clearTimeout(timer);
			clearTimeout(timer2);
		};
	}, [isWrapper]);

	// DEV-only: preview the block page on a desktop browser via ?forceBlock=1
	const devForceBlock = import.meta.env.DEV &&
		typeof window !== 'undefined' &&
		new URLSearchParams(window.location.search).has('forceBlock');

	const isBlockedDevice = deviceDetection.isTV() || devForceBlock;

	if (isBlockedDevice && !isWrapper) {
		// Whitelist the legal page so policy links stay reachable on any device.
		if (window.location.pathname.startsWith('/legal')) {
			return children;
		}
		return <MobileBlockPage />;
	}

	return children;
};
