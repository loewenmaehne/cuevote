export const isTV = () => {
	if (typeof navigator === 'undefined' || !navigator.userAgent) {
		return false;
	}

	// Allow explicit override via URL parameter ?tv=true
	if (typeof window !== 'undefined') {
		const params = new URLSearchParams(window.location.search);
		if (params.get('tv') === 'true') return true;
	}

	const userAgent = navigator.userAgent.toLowerCase();

	return (
		userAgent.includes('smart-tv') ||
		userAgent.includes('smarttv') ||
		userAgent.includes('googletv') ||
		userAgent.includes('appletv') ||
		userAgent.includes('hbbtv') ||
		userAgent.includes('pov_tv') ||
		userAgent.includes('netcast.tv') ||
		userAgent.includes('webos') ||
		userAgent.includes('tizen') ||
		userAgent.includes('android tv') ||
		// Re-enabled: Broad Android TV check (was removed and caused regression)
		(userAgent.includes('android') && userAgent.includes('tv')) ||
		// FireTV / distinct TV boxes
		userAgent.includes('aft') ||         // FireTV keys often start with AFT
		userAgent.includes('dtv') ||         // Digital TV
		userAgent.includes('bravia') ||
		userAgent.includes('viera') ||
		userAgent.includes('philips') ||
		userAgent.includes('crkey') ||       // Chromecast
		userAgent.includes('roku') ||
		userAgent.includes('large screen')   // Some TV browsers specifically state this
	);
};

export const isMobile = () => {
	if (typeof navigator === 'undefined' || !navigator.userAgent) return false;
	const userAgent = navigator.userAgent.toLowerCase();

	// Check for TV first, as TVs are often Android-based but require different UI
	if (isTV()) return false;

	return (
		/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
		(navigator.maxTouchPoints > 0 && window.innerWidth < 768) // Fallback for touch devices
	);
};
