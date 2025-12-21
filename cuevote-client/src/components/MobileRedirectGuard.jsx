import React from 'react';
import { isTV } from '../utils/deviceDetection';
import { MobileBlockPage } from './MobileBlockPage';

export const MobileRedirectGuard = ({ children }) => {
	// FAST FAIL: Check Mobile Block *Before* Hooks
	// This ensures we dont wait for Sockets/Contexts if we are just going to block anyway.
	const userAgent = navigator.userAgent || navigator.vendor || window.opera;
	const isAndroid = /android/i.test(userAgent);
	const isWrapper = userAgent.includes("CueVoteWrapper");

	if ((isAndroid || isTV()) && !isWrapper) {
		console.log("[MobileRedirectGuard] Blocking access - Android/TV detected", { userAgent, isAndroid, isWrapper });
		return <MobileBlockPage />;
	}

	return children;
};
