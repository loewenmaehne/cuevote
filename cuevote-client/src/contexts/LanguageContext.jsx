import React, { useState, useContext, useEffect, useRef } from 'react';
import { LanguageContext } from './LanguageContextValue.js';

function getTranslations() {
	return import('./translations').then((m) => m.translations);
}

function detectInitialLanguage(translations) {
	const saved = localStorage.getItem('cuevote_language');
	if (saved && translations[saved]) return saved;
	const browserLang = navigator.language || navigator.userLanguage;
	if (browserLang) {
		if (browserLang.toLowerCase() === 'zh-cn' || browserLang.toLowerCase() === 'zh-sg') {
			if (translations['zh-CN']) return 'zh-CN';
		}
		if (browserLang.toLowerCase() === 'zh-tw' || browserLang.toLowerCase() === 'zh-hk') {
			if (translations['zh-TW']) return 'zh-TW';
		}
		const code = browserLang.split('-')[0];
		if (translations[code]) return code;
	}
	return 'en';
}

// Single export with inline methods so bundler cannot reorder and cause TDZ.
export const Language = {
	LanguageProvider({ children }) {
		const [language, setLanguage] = useState('en');
		const [translations, setTranslations] = useState(null);
		const initDone = useRef(false);
		useEffect(() => {
			if (initDone.current) return;
			initDone.current = true;
			getTranslations().then((t) => {
				setTranslations(t);
				setLanguage((prev) => detectInitialLanguage(t) || prev);
			});
		}, []);
		useEffect(() => {
			localStorage.setItem('cuevote_language', language);
		}, [language]);
		const t = (key, params = {}) => {
			if (!translations) return key;
			const keys = key.split('.');
			let value = translations[language];
			for (const k of keys) {
				if (value && value[k]) {
					value = value[k];
				} else {
					let fallback = translations['en'];
					for (const fk of keys) {
						if (fallback && fallback[fk]) {
							fallback = fallback[fk];
						} else {
							return key;
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
		return (
			<LanguageContext.Provider value={{ language, setLanguage, t }}>
				{children}
			</LanguageContext.Provider>
		);
	},
	useLanguage() {
		const context = useContext(LanguageContext);
		if (context === undefined) {
			throw new Error('useLanguage must be used within a LanguageProvider');
		}
		return context;
	},
};
