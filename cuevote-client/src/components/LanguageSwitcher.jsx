import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export function LanguageSwitcher({ minimized = false, className = "", id }) {
	const { language, setLanguage } = useLanguage();
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef(null);
	const buttonRef = useRef(null);
	const [focusedOptionIndex, setFocusedOptionIndex] = useState(-1);

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

	// Reset focused option when menu opens/closes
	useEffect(() => {
		if (isOpen) {
			// Find current language index
			const idx = languages.findIndex(l => l.code === language);
			setFocusedOptionIndex(idx >= 0 ? idx : 0);
		} else {
			setFocusedOptionIndex(-1);
		}
	}, [isOpen, language]);

	const handleKeyDown = (e) => {
		if (!isOpen) {
			if (e.key === 'Enter') {
				e.preventDefault();
				e.stopPropagation(); // Prevent Lobby from using this Enter
				setIsOpen(true);
			}
			return;
		}

		// Menu is open
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			e.stopPropagation();
			setFocusedOptionIndex(prev => Math.min(prev + 1, languages.length - 1));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			e.stopPropagation();
			setFocusedOptionIndex(prev => Math.max(prev - 1, 0));
		} else if (e.key === 'Enter') {
			e.preventDefault();
			e.stopPropagation();
			if (focusedOptionIndex >= 0 && focusedOptionIndex < languages.length) {
				setLanguage(languages[focusedOptionIndex].code);
				setIsOpen(false);
				// Return focus to button? Lobby handles valid index focus.
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			setIsOpen(false);
		} else if (e.key === 'Tab') {
			// Let tab out, close menu
			setIsOpen(false);
		}
	};

	// Auto-scroll to focused option
	useEffect(() => {
		if (isOpen && focusedOptionIndex >= 0) {
			const btn = document.getElementById(`lang-opt-${focusedOptionIndex}`);
			if (btn) btn.scrollIntoView({ block: 'nearest' });
		}
	}, [focusedOptionIndex, isOpen]);


	return (
		<div className={`relative ${className}`} ref={dropdownRef} onKeyDown={handleKeyDown}>
			<button
				ref={buttonRef}
				id={id}
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
					{languages.map((lang, index) => (
						<button
							key={lang.code}
							id={`lang-opt-${index}`}
							onClick={(e) => {
								e.stopPropagation();
								setLanguage(lang.code);
								setIsOpen(false);
							}}
							className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-neutral-800 transition-colors 
                                ${language === lang.code ? 'text-orange-500 font-bold bg-orange-500/10' : 'text-neutral-300'}
                                ${index === focusedOptionIndex ? 'bg-neutral-800 text-white' : ''}
                            `}
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
