// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert

/**
 * Whether this viewer may vote and suggest in this room.
 *
 * Mirrors Room.canParticipate on the server. The server decides — this only
 * exists so the UI can explain the rule up front instead of letting someone tap
 * a vote button and collect an error toast.
 */
export function canParticipate(user, requireLogin) {
	if (!user) return false;
	if (requireLogin && user.isGuest) return false;
	return true;
}

/**
 * The name to show next to a track for whoever suggested it.
 *
 * Guests have no account name, so the server sends a flag and a short tag and
 * the word itself is translated here — otherwise every guest in a German room
 * would be labelled "Guest".
 */
export function suggesterLabel(track, t) {
	if (!track) return null;
	if (track.suggestedByIsGuest) {
		return track.suggestedByGuestTag
			? `${t('track.guest')} ${track.suggestedByGuestTag}`
			: t('track.guest');
	}
	return track.suggestedByUsername || null;
}
