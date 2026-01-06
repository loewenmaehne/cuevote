import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { CookieBlockedPlaceholder } from './CookieBlockedPlaceholder';
import { Player } from './Player';
import PlayerErrorBoundary from './PlayerErrorBoundary';

export function PrelistenOverlay({ hasConsent, playbackError, playerContainerRef, t }) {
	return (
		<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center pt-24 pb-32 px-4 animate-fadeIn">
			<div className="w-full max-w-5xl aspect-video max-h-full min-w-[200px] min-h-[200px] bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative">
				<PlayerErrorBoundary>
					{hasConsent ? (
						playbackError ? (
							<div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-center p-6 space-y-4">
								<div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400">
									<AlertTriangle size={24} />
								</div>
								<div>
									<p className="text-white font-medium mb-1">
										{playbackError === 100 ? t('player.errorNotFound') : (playbackError === 101 || playbackError === 150 ? t('player.errorRestricted') : t('player.errorGeneric'))}
									</p>
								</div>
							</div>
						) : (
							<Player
								playerContainerRef={playerContainerRef}
							/>
						)
					) : <CookieBlockedPlaceholder />}
				</PlayerErrorBoundary>
			</div>
		</div>
	);
}
