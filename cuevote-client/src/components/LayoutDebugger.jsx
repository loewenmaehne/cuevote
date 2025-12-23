import React, { useState, useEffect } from 'react';
import { isMobile, isTablet, isTV } from '../utils/deviceDetection';

export const LayoutDebugger = () => {
	const [debugInfo, setDebugInfo] = useState({});

	useEffect(() => {
		const updateInfo = () => {
			const computedStyle = getComputedStyle(document.documentElement);
			const sat = computedStyle.getPropertyValue('--sat');
			const safeAreaInsetTop = computedStyle.getPropertyValue('safe-area-inset-top'); // Browser might not expose this directly without env(), use var

			setDebugInfo({
				width: window.innerWidth,
				height: window.innerHeight,
				satVar: sat,
				isMobile: isMobile(),
				isTablet: isTablet(),
				isTV: isTV(),
				ua: navigator.userAgent
			});
		};

		updateInfo();
		window.addEventListener('resize', updateInfo);
		return () => window.removeEventListener('resize', updateInfo);
	}, []);

	return (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			zIndex: 99999,
			backgroundColor: 'rgba(255, 0, 0, 0.8)',
			color: 'white',
			fontSize: '10px',
			padding: '4px',
			pointerEvents: 'none',
			fontFamily: 'monospace'
		}}>
			W:{debugInfo.width} H:{debugInfo.height} | SAT:{debugInfo.satVar} |
			M:{debugInfo.isMobile?.toString()} T:{debugInfo.isTablet?.toString()} TV:{debugInfo.isTV?.toString()}
		</div>
	);
};
