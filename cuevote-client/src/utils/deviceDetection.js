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

// Tablet Detection
export const isTablet = () => {
	if (typeof navigator === 'undefined') return false;

	const userAgent = navigator.userAgent.toLowerCase();

	// 1. Explicit Tablet UAs
	const isExplicitTablet = /ipad|tablet|playbook|silk/i.test(userAgent);

	// 2. Android: If it says "Android" but NOT "Mobile", it's usually a tablet
	const isAndroidTablet = /android/i.test(userAgent) && !/mobile/i.test(userAgent);

	// 3. iPadOS 13+ (Macintosh + Touch)
	const isIPadOS = (navigator.maxTouchPoints > 0) && /macintosh/i.test(userAgent);

	// 4. Hybrid Heuristic (Touch + Widescreen)
	// We use 768px as the standard cutoff (iPad Mini width)
	const isHybridTablet = (navigator.maxTouchPoints > 0) && (window.innerWidth >= 768);

	return isExplicitTablet || isAndroidTablet || isIPadOS || isHybridTablet;
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
