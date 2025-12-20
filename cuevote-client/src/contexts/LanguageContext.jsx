import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();


export function LanguageProvider({ children }) {
	const [language, setLanguage] = useState(() => {
		// 1. Check Local Storage
		const saved = localStorage.getItem('cuevote_language');
		if (saved && translations[saved]) {
			return saved;
		}

		// 2. Check Browser Language
		const browserLang = navigator.language || navigator.userLanguage; // e.g., "en-US", "zh-CN", "fr"

		// Special handling for Chinese variants
		if (browserLang) {
			if (browserLang.toLowerCase() === 'zh-cn' || browserLang.toLowerCase() === 'zh-sg') {
				if (translations['zh-CN']) return 'zh-CN';
			}
			if (browserLang.toLowerCase() === 'zh-tw' || browserLang.toLowerCase() === 'zh-hk') {
				if (translations['zh-TW']) return 'zh-TW';
			}

			// General handling: take first 2 chars
			const code = browserLang.split('-')[0];
			if (translations[code]) {
				return code;
			}
		}

		// 3. Fallback
		return 'en';
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
