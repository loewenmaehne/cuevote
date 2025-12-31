import React, { useState, useEffect } from "react";
import { WifiOff, RefreshCw, Loader2, ServerCrash } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

export function LoadingScreen({ isOnline, isConnected, embedded = false, message, fullScreen = true }) {
	const { t } = useLanguage();
	const [showTimeoutCheck, setShowTimeoutCheck] = useState(false);
	const [isRetrying, setIsRetrying] = useState(false);

	useEffect(() => {
		// Reset state when status changes to OFFLINE (pause timer?) 
		// Actually, we just want a simple timer that runs on mount.
		// If we are offline, the state is 'offline' anyway.

		// Start a "stuck" timer
		const timer = setTimeout(() => {
			setShowTimeoutCheck(true);
		}, 5000); // 5 seconds grace period before showing retry options

		return () => clearTimeout(timer);
	}, []); // Run once on mount

	const handleRetry = () => {
		setIsRetrying(true);
		// Simulate a brief "trying" state visually before actual reload or just reload
		setTimeout(() => {
			window.location.reload();
		}, 500);
	};

	// Determine State
	let state = 'loading'; // loading | offline | error
	if (!isOnline) state = 'offline';
	else if (showTimeoutCheck) state = 'error'; // Took too long (socket or data)
	else state = 'loading'; // Just connecting normally

	// Content Configuration
	const getConfig = () => {
		switch (state) {
			case 'offline':
				return {
					icon: <WifiOff size={48} className="text-neutral-500 mb-6" />,
					title: t('app.noInternet', "No Internet Connection"),
					sub: t('app.checkConnection', "Please check your internet connection."),
					action: true
				};
			case 'error':
				return {
					icon: <ServerCrash size={48} className="text-orange-500 mb-6" />,
					title: t('app.connectionIssue', "Connection Issue"), // New key or fallback
					sub: t('app.takingTooLong', "Taking longer than usual..."),
					action: true
				};
			case 'loading':
			default:
				return {
					icon: <Loader2 size={48} className="text-orange-500 animate-spin mb-6" />,
					title: message || t('app.connecting', "Connecting to server..."),
					sub: null,
					action: false
				};
		}
	};

	const config = getConfig();

	const content = (
		<div className={`flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500 ${embedded ? "" : "max-w-md p-8"}`}>
			<div className={`transition-all duration-500 ${isRetrying ? "opacity-50 scale-90" : "opacity-100 scale-100"}`}>
				{config.icon}
			</div>

			<h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
				{config.title}
			</h2>

			{config.sub && (
				<p className="text-neutral-400 font-medium mb-8">
					{config.sub}
				</p>
			)}

			{config.action && (
				<button
					onClick={handleRetry}
					disabled={isRetrying}
					className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold text-lg shadow-lg hover:shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<RefreshCw size={20} className={isRetrying ? "animate-spin" : ""} />
					{isRetrying ? t('app.retrying', "Retrying...") : t('app.retry', "Retry Connection")}
				</button>
			)}
		</div>
	);

	if (embedded) {
		return (
			<div className="flex flex-col items-center justify-center p-8 w-full h-full min-h-[300px]">
				{content}
			</div>
		);
	}

	// Full Screen Mode
	return (
		<div className="fixed inset-0 z-[100] bg-[#050505] text-white flex items-center justify-center p-6 overflow-hidden">
			{/* Background Gradient */}
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/20 via-[#050505] to-[#050505] pointer-events-none" />

			{/* Content */}
			<div className="relative z-10 w-full flex items-center justify-center">
				{content}
			</div>
		</div>
	);
}

