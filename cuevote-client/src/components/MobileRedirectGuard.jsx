import React from 'react';
import { isTV } from '../utils/deviceDetection';
import { MobileBlockPage } from './MobileBlockPage';

export const MobileRedirectGuard = ({ children }) => {
	// FAST FAIL: Check Mobile Block *Before* Hooks
	// This ensures we dont wait for Sockets/Contexts if we are just going to block anyway.
	const [isWrapper, setIsWrapper] = React.useState(() => {
		// Initial check during render
		if (typeof window === 'undefined') return false;
		const ua = navigator.userAgent || navigator.vendor || window.opera;
		return ua.includes("CueVoteWrapper") || (typeof window.CueVoteAndroid !== 'undefined');
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

	// Calculate Device Type
	const userAgent = navigator.userAgent || navigator.vendor || window.opera;
	const isAndroid = /android/i.test(userAgent);

	if ((isAndroid || isTV()) && !isWrapper) {
		// Whitelist Legal Page
		if (window.location.pathname.startsWith('/legal')) {
			return children;
		}

		console.log("[MobileRedirectGuard] Blocking access - Android/TV detected", { userAgent, isAndroid, isWrapper });
		return <MobileBlockPage />;
	}

	return children;
};
