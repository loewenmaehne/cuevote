import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export function LanguageSwitcher({ minimized = false, className = "" }) {
	const { language, setLanguage } = useLanguage();
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef(null);

	const languages = [
		{ code: 'en', label: 'English' },
		{ code: 'nl', label: 'Nederlands' },
		{ code: 'de', label: 'Deutsch' },
		{ code: 'fr', label: 'Français' },
		{ code: 'es', label: 'Español' },
		{ code: 'it', label: 'Italiano' },
		{ code: 'pt', label: 'Português' },
		{ code: 'zh-CN', label: '简体中文' },
		{ code: 'zh-TW', label: '繁體中文' },
		{ code: 'ja', label: '日本語' },
		{ code: 'ko', label: '한국어' },
		{ code: 'hi', label: 'हिन्दी' },
		{ code: 'th', label: 'ไทย' },
		{ code: 'vi', label: 'Tiếng Việt' },
		{ code: 'id', label: 'Bahasa Indonesia' },
		{ code: 'ms', label: 'Bahasa Melayu' },
		{ code: 'tl', label: 'Tagalog' },
		{ code: 'pl', label: 'Polski' },
		{ code: 'sv', label: 'Svenska' },
		{ code: 'da', label: 'Dansk' },
		{ code: 'no', label: 'Norsk' },
		{ code: 'fi', label: 'Suomi' },
		{ code: 'tr', label: 'Türkçe' },
		{ code: 'el', label: 'Ελληνικά' },
		{ code: 'ru', label: 'Русский' },
		{ code: 'uk', label: 'Українська' },
		{ code: 'cs', label: 'Čeština' },
		{ code: 'hu', label: 'Magyar' },
		{ code: 'ro', label: 'Română' },
		{ code: 'bg', label: 'Български' },
		{ code: 'hr', label: 'Hrvatski' },
		{ code: 'sr', label: 'Српски' },
		{ code: 'sk', label: 'Slovenčina' },
		{ code: 'ar', label: 'العربية' },
		{ code: 'he', label: 'עברית' }
	];

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
				setIsOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	return (
		<div className={`relative ${className}`} ref={dropdownRef}>
			<button
				onClick={(e) => {
					e.stopPropagation();
					setIsOpen(!isOpen);
				}}
				className={`flex items-center gap-2 p-2 rounded-full hover:bg-neutral-800 transition-colors ${isOpen ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
				title="Change Language"
			>
				<Globe size={20} />
				{!minimized && <span className="text-sm font-medium uppercase font-mono">{language}</span>}
			</button>

			{isOpen && (
				<div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-neutral-800 rounded-xl shadow-xl overflow-hidden py-1 z-[100] animate-in fade-in zoom-in-95 duration-200 max-h-80 overflow-y-auto">
					{languages.map((lang) => (
						<button
							key={lang.code}
							onClick={(e) => {
								e.stopPropagation();
								setLanguage(lang.code);
								setIsOpen(false);
							}}
							className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-neutral-800 transition-colors ${language === lang.code ? 'text-orange-500 font-bold bg-orange-500/10' : 'text-neutral-300'}`}
						>
							<span>{lang.label}</span>
							{language === lang.code && <Check size={16} />}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
