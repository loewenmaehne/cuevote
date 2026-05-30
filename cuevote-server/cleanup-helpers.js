// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
// Shared, pure cleanup helpers used by both the main DB module (db.js) and the
// write-worker (db-worker.js), so the daily-cleanup logic can't diverge.

// YouTube-derived fields subject to the API's metadata retention limit. App data
// (id, videoId, score, voters, suggestedBy, timestamps, …) is intentionally kept.
const YT_METADATA_FIELDS = ['title', 'artist', 'thumbnail', 'duration', 'category_id', 'language'];

function stripTrackMetadata(track) {
  if (!track || typeof track !== 'object') return false;
  let changed = false;
  for (const field of YT_METADATA_FIELDS) {
    if (track[field] != null) {
      track[field] = null;
      changed = true;
    }
  }
  return changed;
}

/**
 * Strip cached YouTube metadata (title/artist/thumbnail/…) from a persisted
 * room_state JSON blob, keeping the video IDs and all application data. Mirrors
 * cleanupStaleVideoMetadata for the videos table, but for the state snapshot —
 * which the videos-table cleanup never touches. Video IDs survive so the
 * Auto-DJ and the on-join rehydrate can refill the real metadata.
 *
 * @returns {{ json: string, changed: boolean }} the (possibly) rewritten JSON
 *          and whether anything was actually cleared (skip the write if not).
 */
function stripStateMetadata(stateJson) {
  let state;
  try {
    state = JSON.parse(stateJson);
  } catch {
    return { json: stateJson, changed: false };
  }

  let changed = false;
  if (stripTrackMetadata(state.currentTrack)) changed = true;
  if (Array.isArray(state.queue)) {
    for (const track of state.queue) {
      if (stripTrackMetadata(track)) changed = true;
    }
  }

  return changed ? { json: JSON.stringify(state), changed: true } : { json: stateJson, changed: false };
}

module.exports = { stripStateMetadata };
