import React, { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";

export function CookieConsent({ onAccept }) {
	return (
		<div className="fixed bottom-4 left-6 right-6 md:left-auto md:right-6 md:w-[400px] z-[100] animate-in slide-in-from-bottom-4 fade-in duration-500">
			<div className="bg-[#111] border border-white/10 p-6 rounded-2xl shadow-2xl shadow-black/50 backdrop-blur-xl relative overflow-hidden group">
				<div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-purple-500/5 pointer-events-none" />

				<div className="flex items-start gap-4 relative">
					<div className="p-3 rounded-full bg-orange-500/10 text-orange-500 flex-shrink-0">
						<Cookie size={24} />
					</div>
					<div className="space-y-3">
						<div>
							<h3 className="text-white font-bold text-lg mb-1">Privacy & Playback</h3>
							<p className="text-neutral-400 text-sm leading-relaxed">
								To play music, we need to load the YouTube Player. This connects to Google's servers.
								<br />
								<a href="/legal" target="_blank" className="text-orange-500 hover:text-orange-400 underline underline-offset-2">Read our Privacy Policy</a>.
							</p>
						</div>
						<button
							onClick={onAccept}
							className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-neutral-200 transition-colors shadow-lg active:scale-95 transform duration-100"
						>
							Accept & Play Music
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
