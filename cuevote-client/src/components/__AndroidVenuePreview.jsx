// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
// DEV-ONLY preview (route /__android-preview, gated by import.meta.env.DEV) for
// screenshotting the Android Venue Mode screen + AppPromoFooter on small
// viewports without a backend. Mirrors RoomBody's venue layout and renders the
// real PlaylistView + AppPromoFooter with mock data. Not bundled in production.
import React from 'react';
import { PlaylistView } from './PlaylistView';
import { AppPromoFooter } from './AppPromoFooter';

const mk = (id, videoId, title, artist, score) => ({ id, videoId, title, artist, score });

// queue[0] mirrors currentTrack (the live invariant the real room maintains).
const QUEUE = [
	mk('t1', 'dQw4w9WgXcQ', 'Blinding Lights', 'The Weeknd', 14),
	mk('t2', '3JZ_D3ELwOQ', 'Levitating', 'Dua Lipa', 11),
	mk('t3', 'kJQP7kiw5Fk', 'Despacito', 'Luis Fonsi', 9),
	mk('t4', 'fLexgOxsZu0', 'As It Was', 'Harry Styles', 6),
	mk('t5', 'L_jWHffIx5E', 'Smells Like Teen Spirit', 'Nirvana', 3),
];

export default function AndroidVenuePreview() {
	const noop = () => {};
	const queueVideoIds = new Set(QUEUE.map((t) => t.videoId));
	return (
		<div className="flex flex-col h-[100dvh] bg-[#050505]">
			<div className="w-full h-full flex flex-col overflow-hidden">
				<div className="flex-1 min-h-0 overflow-hidden">
					<PlaylistView
						history={[]}
						currentTrack={QUEUE[0]}
						queue={QUEUE}
						user={{ id: 'guest', name: 'Guest' }}
						onVote={noop}
						votes={{}}
						isOwner={false}
						progress={32}
						volume={80}
						isMuted={false}
						activeChannel="Rooftop Saturday"
						onMuteToggle={noop}
						onVolumeChange={noop}
						votesEnabled={true}
						onPreview={null}
						onDelete={null}
						onRecommend={noop}
						onAdd={noop}
						activeSuggestionId={null}
						suggestions={[]}
						isFetchingSuggestions={false}
						queueVideoIds={queueVideoIds}
						disableFloatingUI={false}
						activeTab="playlist"
					/>
				</div>
				<AppPromoFooter />
			</div>
		</div>
	);
}
