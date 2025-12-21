import React from 'react';
import { Download, Monitor, Smartphone, Tv } from 'lucide-react';
import { isTV } from '../utils/deviceDetection';

export const MobileBlockPage = () => {
	const isTvDevice = isTV();

	return (
		<div className="flex flex-col h-[100dvh] bg-[#050505] items-center justify-center p-6 text-center relative overflow-hidden select-none">
			{/* Background Gradient */}
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/20 via-[#050505] to-[#050505] pointer-events-none" />

			<div className="relative z-10 max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">

				{/* Header */}
				<div className="space-y-4">
					<div>
						<h1 className="text-4xl font-bold tracking-tighter text-white mb-2">
							CueVote
						</h1>
						<p className="text-xl text-orange-500 font-bold tracking-wide uppercase">The Democratic Jukebox</p>
					</div>

					<p className="text-lg text-neutral-300 font-medium leading-relaxed max-w-xs mx-auto">
						{isTvDevice
							? "Turn this screen into the ultimate Jukebox. Let your guests vote on the music."
							: "Vote on songs, build the playlist together, and let the best music win."
						}
					</p>
				</div>

				{/* Feature Cards */}
				<div className="grid gap-4 pt-4">
					<div className="p-4 rounded-2xl bg-neutral-900/50 border border-white/5 backdrop-blur-md flex items-start gap-4 text-left">
						<div className="p-3 rounded-full bg-orange-500/10 text-orange-500 mt-1">
							{isTvDevice ? <Tv size={20} /> : <Monitor size={20} />}
						</div>
						<div>
							<h3 className="text-white font-bold mb-1">
								{isTvDevice ? "Cinema Mode" : "Host the Party"}
							</h3>
							<p className="text-sm text-neutral-400 leading-snug">
								{isTvDevice
									? "Install the TV App for the perfect shared player experience with Always-On screen."
									: "Use our Android App to run the music player with seamless background playback and \"Always On\" screen."
								}
							</p>
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
					Download {isTvDevice ? "TV App" : "Android App"}
				</a>

				<p className="text-xs text-neutral-700">
					Requires Android 7.0+ • Enable "Install Unknown Apps"
				</p>

			</div>
		</div>
	);
};
