import React, { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

export function CookieConsent({ onAccept }) {
	const { t } = useLanguage();

	return (
		<div className="fixed bottom-0 left-0 right-0 md:bottom-4 md:left-auto md:right-6 md:w-[400px] z-[100] animate-in slide-in-from-bottom-4 fade-in duration-500">
			<div className="bg-[#111] border border-white/10 p-4 md:p-6 rounded-t-2xl rounded-b-none md:rounded-2xl shadow-2xl shadow-black/50 backdrop-blur-xl relative overflow-hidden group">
				<div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-purple-500/5 pointer-events-none" />

				<div className="flex items-start gap-4 relative">
					<div className="p-3 rounded-full bg-orange-500/10 text-orange-500 flex-shrink-0">
						<Cookie size={24} />
					</div>
					<div className="space-y-3">
						<div>
							<h3 className="text-white font-bold text-lg mb-1">{t('cookie.title')}</h3>
							<p className="text-neutral-400 text-sm leading-relaxed">
								{t('cookie.description')}
								<br />
								<a href="/legal" target="_blank" className="text-orange-500 hover:text-orange-400 underline underline-offset-2">{t('cookie.policy')}</a>.
							</p>
						</div>
						<button
							onClick={onAccept}
							className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-neutral-200 transition-colors shadow-lg active:scale-95 transform duration-100"
						>
							{t('cookie.accept')}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
