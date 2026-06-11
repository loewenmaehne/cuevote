// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import React, { useState, useContext, useEffect, useRef } from 'react';
import { LanguageContext } from './LanguageContextValue.js';

// Kick off the translations download the moment this (eagerly-loaded) contexts
// chunk evaluates, so it loads in parallel with the app code instead of waiting
// for the first effect — this is what closes the window where raw i18n keys flash.
// Still a dynamic import(), so translations.js is never evaluated during entry
// init: the TDZ fix from 1b57d50 ("Cannot access 'Ta' before initialization") holds.
const translationsPromise = import('./translations').then((m) => m.translations);

const pluralRulesCache = new Map();
function getPluralRules(lang) {
	let rules = pluralRulesCache.get(lang);
	if (!rules) {
		rules = new Intl.PluralRules(lang);
		pluralRulesCache.set(lang, rules);
	}
	return rules;
}

function resolveKeyPath(root, keys) {
	let v = root;
	for (const k of keys) {
		if (v != null && typeof v === 'object' && v[k] !== undefined) v = v[k];
		else return undefined;
	}
	return v;
}

function selectPluralString(bag, lang, count) {
	if (bag == null || typeof bag !== 'object') return null;
	const category = getPluralRules(lang).select(count);
	if (typeof bag[category] === 'string') return bag[category];
	if (typeof bag.other === 'string') return bag.other;
	if (typeof bag.one === 'string') return bag.one;
	for (const v of Object.values(bag)) if (typeof v === 'string') return v;
	return null;
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
		const [language, setLanguage] = useState(() => localStorage.getItem('cuevote_language') || 'en');
		const [translations, setTranslations] = useState(null);
		const initDone = useRef(false);
		const langReady = useRef(false);
		useEffect(() => {
			if (initDone.current) return;
			initDone.current = true;
			translationsPromise.then((t) => {
				setTranslations(t);
				setLanguage((prev) => detectInitialLanguage(t) || prev);
				langReady.current = true;
			});
		}, []);
		useEffect(() => {
			if (!langReady.current) return;
			localStorage.setItem('cuevote_language', language);
		}, [language]);
		const t = (key, params = {}) => {
			if (!translations) return key;
			const keys = key.split('.');
			let value = resolveKeyPath(translations[language], keys);
			let usedLang = language;
			if (value === undefined) {
				value = resolveKeyPath(translations.en, keys);
				usedLang = 'en';
				if (value === undefined) return key;
			}
			// Plural-bag handling: object value + numeric count param.
			if (value !== null && typeof value === 'object' && params.count !== undefined) {
				let str = selectPluralString(value, usedLang, params.count);
				if (str == null && usedLang !== 'en') {
					const enBag = resolveKeyPath(translations.en, keys);
					str = selectPluralString(enBag, 'en', params.count);
				}
				if (str == null) return key;
				value = str;
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
				{translations ? children : (
					// Language-neutral splash until translations resolve, so raw i18n
					// keys never paint. Intentionally text-free — any copy here would
					// itself be untranslated. Matches the app's dark + orange theme.
					<div className="fixed inset-0 z-[100] bg-[#050505] flex items-center justify-center" role="status" aria-label="Loading">
						<div className="w-10 h-10 rounded-full border-2 border-neutral-800 border-t-orange-500 animate-spin" />
					</div>
				)}
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
