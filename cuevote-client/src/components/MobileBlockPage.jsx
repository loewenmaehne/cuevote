import React from 'react';
import { Download, Monitor, Smartphone, Tv, Settings } from 'lucide-react';
import { isTV } from '../utils/deviceDetection';
import { useLanguage } from '../contexts/LanguageContext';

export const MobileBlockPage = () => {
	const isTvDevice = isTV();
	const { t } = useLanguage();

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
							{t('mobile.tagline')}
						</p>
					</div>

					<p className="text-lg text-neutral-300 font-medium leading-relaxed max-w-xs mx-auto opacity-90">
						{isTvDevice
							? t('mobile.tvDescription')
							: t('mobile.mobileDescription')
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
								{isTvDevice ? t('mobile.tvFeatureTitle') : t('mobile.mobileFeatureTitle')}
							</h3>
							<p className="text-sm text-neutral-400 leading-snug font-medium">
								{isTvDevice
									? t('mobile.tvFeatureBody')
									: t('mobile.mobileFeatureBody')
								}
							</p>
						</div>
					</div>
				</div>

				{/* Primary Call to Action */}
				<div className="w-full space-y-4 pt-4">
					<a
						href="https://github.com/loewenmaehne/cuevote/releases/download/v1.0.3/app-release.apk"
						download="CueVote-App.apk"
						target="_blank"
						rel="noopener noreferrer"
						className="group relative w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-lg shadow-xl hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center gap-3 overflow-hidden"
					>
						<div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
						<Download size={24} className="fill-current animate-bounce-subtle" />
						<span className="relative z-10">{isTvDevice ? t('mobile.downloadTv') : t('mobile.downloadMobile')}</span>
					</a>

					<div className="text-center space-y-1">
						<p className="text-xs text-neutral-500 font-medium">
							{t('mobile.requirement')}
						</p>
						<p className="text-xs text-neutral-400">
							<span className="opacity-70">{t('mobile.downloadFail')}</span> {t('mobile.installInstruction')}
						</p>
					</div>
				</div>

				<div className="pt-8">
					<a href="/legal" className="text-xs text-neutral-500 hover:text-orange-400 underline underline-offset-4 transition-colors">
						{t('mobile.privacyLegal')}
					</a>
				</div>

			</div>
		</div>
	);
};
