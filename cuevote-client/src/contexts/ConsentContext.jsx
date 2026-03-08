import React, { useContext, useState, useEffect } from 'react';
import { ConsentContext } from './ConsentContextValue.js';

// Single export with inline functions so bundler cannot reorder and cause TDZ.
export const Consent = {
	ConsentProvider({ children }) {
		const [hasConsent, setHasConsent] = useState(() => {
			return localStorage.getItem("cuevote_cookie_consent") === "true";
		});
		const [showBanner, setShowBanner] = useState(false);
		useEffect(() => {
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
		const askForConsent = () => setShowBanner(true);
		return (
			<ConsentContext.Provider value={{ hasConsent, showBanner, giveConsent, askForConsent, setShowBanner }}>
				{children}
			</ConsentContext.Provider>
		);
	},
	useConsent() {
		return useContext(ConsentContext);
	},
};
