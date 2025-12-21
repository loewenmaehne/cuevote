import React from 'react';
import { Download, Monitor, Smartphone } from 'lucide-react';

export const MobileBlockPage = () => {
	return (
		<div className="flex flex-col h-[100dvh] bg-[#050505] items-center justify-center p-6 text-center relative overflow-hidden select-none">
			{/* Background Gradient */}
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/20 via-[#050505] to-[#050505] pointer-events-none" />

			<div className="relative z-10 max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">

				{/* Header */}
				<div className="space-y-2">
					<h1 className="text-4xl font-bold tracking-tighter text-white">
						CueVote <span className="text-orange-500">App</span>
					</h1>
					<p className="text-xl text-neutral-400 font-medium">Native Experience Required</p>
				</div>

				{/* Feature Cards */}
				<div className="grid gap-4">
					<div className="p-4 rounded-2xl bg-neutral-900/50 border border-white/5 backdrop-blur-md flex items-center gap-4 text-left">
						<div className="p-3 rounded-full bg-orange-500/10 text-orange-500">
							<Monitor size={24} />
						</div>
						<div>
							<h3 className="text-white font-bold">Always On</h3>
							<p className="text-sm text-neutral-400">Screen stays awake for the party</p>
						</div>
					</div>

					<div className="p-4 rounded-2xl bg-neutral-900/50 border border-white/5 backdrop-blur-md flex items-center gap-4 text-left">
						<div className="p-3 rounded-full bg-purple-500/10 text-purple-500">
							<Smartphone size={24} />
						</div>
						<div>
							<h3 className="text-white font-bold">Autoplay</h3>
							<p className="text-sm text-neutral-400">Music never stops between songs</p>
						</div>
					</div>
				</div>

				{/* Explanation */}
				<p className="text-neutral-500 text-sm leading-relaxed px-4">
					To ensure the best playback experience on mobile and TV, CueVote requires our native Android application.
					Browser playback is restricted to prevent interruptions.
				</p>

				{/* Action Button */}
				<a
					href="/android/app-release.apk" // Assuming you upload it here
					className="block w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold text-lg shadow-lg hover:shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
				>
					<Download size={24} className="fill-current" />
					Download Android App
				</a>

				<p className="text-xs text-neutral-700">
					Requires Android 7.0+ • Enable "Install Unknown Apps"
				</p>

			</div>
		</div>
	);
};
