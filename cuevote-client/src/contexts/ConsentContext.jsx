import React, { createContext, useContext, useState, useEffect } from 'react';

const ConsentContext = createContext(null);

export function ConsentProvider({ children }) {
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

// eslint-disable-next-line react-refresh/only-export-components
export function useConsent() {
	return useContext(ConsentContext);
}
