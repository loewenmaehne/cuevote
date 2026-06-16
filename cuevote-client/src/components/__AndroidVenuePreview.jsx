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

const VIDS = ['dQw4w9WgXcQ', '3JZ_D3ELwOQ', 'kJQP7kiw5Fk', 'fLexgOxsZu0', 'L_jWHffIx5E'];
const SONGS = [
	['Blinding Lights', 'The Weeknd'], ['Levitating', 'Dua Lipa'], ['Despacito', 'Luis Fonsi'],
	['As It Was', 'Harry Styles'], ['Smells Like Teen Spirit', 'Nirvana'], ['Bad Guy', 'Billie Eilish'],
	['Shape of You', 'Ed Sheeran'], ['Uptown Funk', 'Mark Ronson'], ['Rolling in the Deep', 'Adele'],
	['Believer', 'Imagine Dragons'], ['Counting Stars', 'OneRepublic'], ['Sunflower', 'Post Malone'],
	['Dance Monkey', 'Tones and I'], ['Numb', 'Linkin Park'],
];
// queue[0] mirrors currentTrack (the live invariant the real room maintains).
const QUEUE = SONGS.map(([title, artist], i) => mk('t' + i, VIDS[i % VIDS.length], title, artist, 20 - i));

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
						appFooterPresent
					/>
				</div>
				<AppPromoFooter />
			</div>
		</div>
	);
}
