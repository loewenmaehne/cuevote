import React, { useState, useEffect } from "react";
import { WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

export function LoadingScreen({ isOnline, isConnected }) {
	const { t } = useLanguage();
	const [showTimeoutCheck, setShowTimeoutCheck] = useState(false);

	useEffect(() => {
		// Reset timer when props change (though typically they won't if we are stuck)
		// Actually, we want the timer to start when this component MOUNTS and keep ticking.
		// If isOnline or isConnected changes, we might change state, but the "stuck" timer is global for this view.

		// We only care about the timer if we are "technically" fine (Online + Connected) but still stuck here.
		const timer = setTimeout(() => {
			setShowTimeoutCheck(true);
		}, 5000); // 5 seconds grace period

		return () => clearTimeout(timer);
	}, []);

	const handleRetry = () => {
		window.location.reload();
	};

	let content = {
		icon: <Loader2 size={48} className="mb-4 text-orange-500 animate-spin mx-auto" />, // Improved spinner
		message: t('app.switching'),
		action: null
	};

	if (!isOnline) {
		content = {
			icon: <WifiOff size={48} className="mb-4 text-neutral-500 mx-auto" />,
			message: t('app.noInternet', "No Internet Connection"),
			action: (
				<button
					onClick={handleRetry}
					className="mt-6 flex items-center gap-2 px-6 py-3 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-all hover:scale-105 active:scale-95 mx-auto"
				>
					<RefreshCw size={20} />
					{t('app.retry', "Retry Connection")}
				</button>
			)
		};
	} else if (!isConnected) {
		content = {
			icon: <Loader2 size={48} className="mb-4 text-neutral-500 animate-spin mx-auto" />,
			message: t('lobby.connecting', "Connecting to server..."),
			action: null // Usually connects purely automatically, but if stuck here too long...
		};
		// If we are stuck in "Connecting" for too long, same logic applies?
		// Yes, the timeout below will override if needed, OR we can add a specific retry here too.
		// Let's rely on the timeout override for simplicity.
	}

	// Timeout Override: If we are showing "Switching" or "Connecting" for too long => Offer Retry
	if (showTimeoutCheck && isOnline) {
		// Don't fully replace if we are "Connecting" - maybe just add the button?
		// Actually, if it's been 5 seconds and we are still "Switching" or "Connecting", user needs options.
		if (!content.action) {
			content.action = (
				<div className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col items-center">
					<p className="text-neutral-500 text-sm mb-4">Taking longer than usual...</p>
					<button
						onClick={handleRetry}
						className="flex items-center gap-2 px-6 py-3 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-all hover:scale-105 active:scale-95"
					>
						<RefreshCw size={20} />
						{t('app.retry', "Retry Connection")}
					</button>
				</div>
			);
		}
	}

	return (
		<div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
			<div className="flex flex-col items-center justify-center max-w-sm text-center animate-in fade-in zoom-in-95 duration-300">
				{content.icon}
				<h2 className="text-2xl font-bold mb-2">{content.message}</h2>
				{content.action}
			</div>
		</div>
	);
}
