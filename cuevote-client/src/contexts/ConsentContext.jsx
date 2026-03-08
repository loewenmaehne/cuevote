import React, { useContext, useState, useEffect } from 'react';
import { ConsentContext } from './ConsentContextValue.js';

function ConsentProvider({ children }) {
	const [hasConsent, setHasConsent] = useState(() => {
		return localStorage.getItem("cuevote_cookie_consent") === "true";
	});
	const [showBanner, setShowBanner] = useState(false);

	useEffect(() => {
		// Show banner if no consent (with delay to look nice)
		if (!hasConsent) {
			const timer = setTimeout(() => setShowBanner(true), 1000);
			return () => clearTimeout(timer);
		}
	}, [hasConsent]);

	const giveConsent = () => {
		localStorage.setItem("cuevote_cookie_consent", "true");
		setHasConsent(true);
		setShowBanner(false);
	};

	const askForConsent = () => {
		setShowBanner(true);
	};

	return (
		<ConsentContext.Provider value={{ hasConsent, showBanner, giveConsent, askForConsent, setShowBanner }}>
			{children}
		</ConsentContext.Provider>
	);
}

function useConsent() {
	return useContext(ConsentContext);
}

export const Consent = { ConsentProvider, useConsent };
