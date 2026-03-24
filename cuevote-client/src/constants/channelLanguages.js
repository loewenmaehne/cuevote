export const channelLanguages = [
	{ code: 'international', label: 'International', emoji: '🌐' },
	{ code: 'en', label: 'English', emoji: '🇬🇧' },
	{ code: 'nl', label: 'Nederlands', emoji: '🇳🇱' },
	{ code: 'de', label: 'Deutsch', emoji: '🇩🇪' },
	{ code: 'fr', label: 'Français', emoji: '🇫🇷' },
	{ code: 'es', label: 'Español', emoji: '🇪🇸' },
	{ code: 'it', label: 'Italiano', emoji: '🇮🇹' },
	{ code: 'pt', label: 'Português', emoji: '🇵🇹' },
	{ code: 'zh-CN', label: '简体中文', emoji: '🇨🇳' },
	{ code: 'zh-TW', label: '繁體中文', emoji: '🇹🇼' },
	{ code: 'ja', label: '日本語', emoji: '🇯🇵' },
	{ code: 'ko', label: '한국어', emoji: '🇰🇷' },
	{ code: 'hi', label: 'हिन्दी', emoji: '🇮🇳' },
	{ code: 'th', label: 'ไทย', emoji: '🇹🇭' },
	{ code: 'vi', label: 'Tiếng Việt', emoji: '🇻🇳' },
	{ code: 'id', label: 'Bahasa Indonesia', emoji: '🇮🇩' },
	{ code: 'ms', label: 'Bahasa Melayu', emoji: '🇲🇾' },
	{ code: 'tl', label: 'Tagalog', emoji: '🇵🇭' },
	{ code: 'pl', label: 'Polski', emoji: '🇵🇱' },
	{ code: 'sv', label: 'Svenska', emoji: '🇸🇪' },
	{ code: 'da', label: 'Dansk', emoji: '🇩🇰' },
	{ code: 'no', label: 'Norsk', emoji: '🇳🇴' },
	{ code: 'fi', label: 'Suomi', emoji: '🇫🇮' },
	{ code: 'tr', label: 'Türkçe', emoji: '🇹🇷' },
	{ code: 'el', label: 'Ελληνικά', emoji: '🇬🇷' },
	{ code: 'ru', label: 'Русский', emoji: '🇷🇺' },
	{ code: 'uk', label: 'Українська', emoji: '🇺🇦' },
	{ code: 'cs', label: 'Čeština', emoji: '🇨🇿' },
	{ code: 'hu', label: 'Magyar', emoji: '🇭🇺' },
	{ code: 'ro', label: 'Română', emoji: '🇷🇴' },
	{ code: 'bg', label: 'Български', emoji: '🇧🇬' },
	{ code: 'hr', label: 'Hrvatski', emoji: '🇭🇷' },
	{ code: 'sr', label: 'Српски', emoji: '🇷🇸' },
	{ code: 'sk', label: 'Slovenčina', emoji: '🇸🇰' },
	{ code: 'ar', label: 'العربية', emoji: '🇸🇦' },
	{ code: 'he', label: 'עברית', emoji: '🇮🇱' },
];

const emojiMap = new Map(channelLanguages.map(l => [l.code, l.emoji]));

export function getFlagEmoji(code) {
	return emojiMap.get(code) || '🌐';
}
