// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import React from 'react';
import { deviceDetection } from '../utils/deviceDetection';
import { MobileBlockPage } from './MobileBlockPage';

const DISMISS_KEY = 'cuevote_mobile_web_ok';

export const MobileRedirectGuard = ({ children }) => {
	// FAST FAIL: Check Mobile Block *Before* Hooks
	// This ensures we dont wait for Sockets/Contexts if we are just going to block anyway.
	const [isWrapper, setIsWrapper] = React.useState(() => {
		// Initial check during render
		if (typeof window === 'undefined') return false;
		const ua = navigator.userAgent || navigator.vendor || window.opera;
		return ua.includes("CueVoteWrapper") || (typeof window.CueVoteAndroid !== 'undefined');
	});

	// The user explicitly chose to continue in the mobile browser despite the
	// reduced feature set (no playback / prelisten / hosting). Persisted so the
	// block page does not reappear on every navigation.
	const [dismissed, setDismissed] = React.useState(() => {
		if (typeof window === 'undefined') return false;
		try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
	});

	React.useEffect(() => {
		// Re-check after mount to catch any late injection or hydration mismatches
		const checkWrapper = () => {
			const ua = navigator.userAgent || navigator.vendor || window.opera;
			const detected = ua.includes("CueVoteWrapper") || (typeof window.CueVoteAndroid !== 'undefined');
			if (detected && !isWrapper) {
				console.log("[MobileRedirectGuard] Late detection of Wrapper!");
				setIsWrapper(true);
			}
		};

		const timer = setTimeout(checkWrapper, 100);
		const timer2 = setTimeout(checkWrapper, 500); // Double check

		return () => {
			clearTimeout(timer);
			clearTimeout(timer2);
		};
	}, [isWrapper]);

	const handleContinue = React.useCallback(() => {
		try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage unavailable */ }
		setDismissed(true);
	}, []);

	// Calculate Device Type
	const userAgent = navigator.userAgent || navigator.vendor || window.opera;
	const isAndroid = /android/i.test(userAgent);

	// DEV-only: preview the block page on a desktop browser via ?forceBlock=1
	const devForceBlock = import.meta.env.DEV &&
		typeof window !== 'undefined' &&
		new URLSearchParams(window.location.search).has('forceBlock');

	const isBlockedDevice = isAndroid || deviceDetection.isTV() || devForceBlock;

	if (isBlockedDevice && !isWrapper && !dismissed) {
		// Whitelist Legal Page
		if (window.location.pathname.startsWith('/legal')) {
			return children;
		}

		if (import.meta.env.DEV) {
			console.log("[MobileRedirectGuard] Showing block page", { userAgent, isAndroid, isWrapper, devForceBlock });
		}
		return <MobileBlockPage onContinue={handleContinue} />;
	}

	return children;
};
