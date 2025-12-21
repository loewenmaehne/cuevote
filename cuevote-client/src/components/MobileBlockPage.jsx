import React from 'react';
import { Download, Monitor, Smartphone, Tv, Settings } from 'lucide-react';
import { isTV } from '../utils/deviceDetection';

export const MobileBlockPage = () => {
	const isTvDevice = isTV();

	return (
		<div className="flex flex-col h-[100dvh] bg-[#050505] items-center justify-center p-6 text-center relative overflow-hidden select-none font-sans">
			{/* Dynamic Background */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-900/40 via-[#050505] to-[#050505] animate-pulse-slow pointer-events-none" />
			<div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02] pointer-events-none mix-blend-overlay" />

			<div className="relative z-10 max-w-md w-full space-y-8 animate-in fade-in zoom-in-95 duration-700 flex flex-col items-center">

				{/* Header Section */}
				<div className="space-y-3">
					<div className="flex flex-col items-center">
						<h1 className="text-5xl font-black tracking-tighter text-white mb-1 drop-shadow-2xl">
							CueVote
						</h1>
						<div className="h-1 w-24 bg-gradient-to-r from-orange-600 to-orange-400 rounded-full mb-4" />
						<p className="text-xl font-bold tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-400 drop-shadow-sm">
							The Democratic Jukebox
						</p>
					</div>

					<p className="text-lg text-neutral-300 font-medium leading-relaxed max-w-xs mx-auto opacity-90">
						{isTvDevice
							? "Turn this screen into the ultimate Jukebox. Let your guests vote on the music."
							: "Vote on songs, build the playlist together, and let the best music win."
						}
					</p>
				</div>

				{/* Feature Cards - Glassmorphism */}
				<div className="w-full grid gap-4">
					<div className="group p-5 rounded-2xl bg-neutral-900/40 border border-white/10 backdrop-blur-xl flex items-start gap-4 text-left shadow-2xl hover:bg-neutral-800/50 transition-colors duration-300">
						<div className="p-3 rounded-full bg-orange-500/20 text-orange-400 mt-1 shadow-inner group-hover:scale-110 transition-transform duration-300">
							{isTvDevice ? <Tv size={22} /> : <Monitor size={22} />}
						</div>
						<div>
							<h3 className="text-white font-bold text-lg mb-1 tracking-tight">
								{isTvDevice ? "Cinema Mode" : "Host the Party"}
							</h3>
							<p className="text-sm text-neutral-400 leading-snug font-medium">
								{isTvDevice
									? "Install the TV App for the perfect shared player experience with Always-On screen."
									: "Use our Android App to run the music player with seamless background playback and \"Always On\" screen."
								}
							</p>
						</div>
					</div>
				</div>

				{/* Installation Steps */}
				<div className="w-full space-y-6 pt-2">

					{/* Step 1: Download */}
					<div className="space-y-3">
						<div className="flex items-center gap-2 px-1">
							<span className="bg-orange-500/20 text-orange-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-orange-500/20">Step 1</span>
							<span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Get the App</span>
						</div>
						<a
							href="/android/app-release.apk"
							download="CueVote-App.apk"
							target="_blank"
							rel="noopener noreferrer"
							className="group relative w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-lg shadow-xl hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center gap-3 overflow-hidden"
						>
							<div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
							<Download size={24} className="fill-current animate-bounce-subtle" />
							<span className="relative z-10">Download {isTvDevice ? "TV App" : "Android App"}</span>
						</a>
					</div>

					{/* Step 2: Install */}
					<div className="space-y-3">
						<div className="flex items-center gap-2 px-1">
							<span className="bg-neutral-800 text-neutral-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-white/5">Step 2</span>
							<span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Allow Access</span>
						</div>

						<div className="relative group/hint overflow-hidden rounded-xl bg-neutral-900/40 border border-white/5 p-4 flex items-center gap-4 transition-colors hover:bg-neutral-900/60 hover:border-orange-500/20">
							<div className="p-2 rounded-full bg-neutral-800 text-orange-500/80 group-hover/hint:text-orange-500 group-hover/hint:bg-orange-500/10 transition-colors">
								<Settings size={18} />
							</div>
							<div className="text-left">
								<p className="text-xs text-neutral-400 font-medium mb-0.5">
									Settings &gt; Enable
								</p>
								<p className="text-sm text-neutral-200 font-bold group-hover/hint:text-orange-400 transition-colors">
									"Install Unknown Apps"
								</p>
							</div>
						</div>
					</div>

				</div>

				{/* Footer / Legal */}
				<div className="pt-8 opacity-60 hover:opacity-100 transition-opacity">
					<a href="/legal" className="text-xs text-neutral-500 hover:text-orange-400 underline underline-offset-4 transition-colors">
						Privacy Policy & Legal
					</a>
				</div>

			</div>
		</div>
	);
};
