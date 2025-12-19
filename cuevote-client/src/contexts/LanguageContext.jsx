import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();


export function LanguageProvider({ children }) {
	const [language, setLanguage] = useState(() => {
		return localStorage.getItem('cuevote_language') || 'en';
	});

	useEffect(() => {
		localStorage.setItem('cuevote_language', language);
	}, [language]);

	const t = (key, params = {}) => {
		const keys = key.split('.');
		let value = translations[language];

		for (const k of keys) {
			if (value && value[k]) {
				value = value[k];
			} else {
				// Fallback to English if key missing in current language
				let fallback = translations['en'];
				for (const fk of keys) {
					if (fallback && fallback[fk]) {
						fallback = fallback[fk];
					} else {
						return key; // Return key if not found anywhere
					}
				}
				value = fallback;
				break;
			}
		}

		if (typeof value === 'string') {
			return value.replace(/\{(\w+)\}/g, (match, param) => {
				return params[param] !== undefined ? params[param] : match;
			});
		}

		return value;
	};

	const value = {
		language,
		setLanguage,
		t
	};

	return (
		<LanguageContext.Provider value={value}>
			{children}
		</LanguageContext.Provider>
	);
}

export function useLanguage() {
	const context = useContext(LanguageContext);
	if (context === undefined) {
		throw new Error('useLanguage must be used within a LanguageProvider');
	}
	return context;
}
