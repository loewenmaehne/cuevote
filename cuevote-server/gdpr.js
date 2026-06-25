// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
const logger = require('./logger');

/**
 * GDPR Art. 17 — remove a deleted user's footprint from the IN-MEMORY rooms.
 *
 *  - Destroys rooms the user owns (broadcasts ROOM_DELETED, stops timers,
 *    removes them from the live map).
 *  - Scrubs the user's votes / suggestedBy entries from every remaining
 *    loaded room so their id and display name stop being broadcast.
 *
 * DB-side erasure (users, sessions, owned rooms, and room_state snapshots) is
 * handled separately by db.deleteUser; this covers only the live Room objects.
 * Shared by the WebSocket DELETE_ACCOUNT handler and the admin GDPR endpoint so
 * both paths behave identically.
 *
 * @returns {{ destroyedRooms: string[], scrubbedRooms: number }}
 */
function purgeUserFromMemory(rooms, userId) {
    const targetId = String(userId).trim();
    const destroyedRooms = [];

    // 1. Destroy owned rooms.
    for (const [id, room] of rooms.entries()) {
        const owner = String(room.metadata.owner_id || '').trim();
        if (owner === targetId) {
            try {
                room.broadcast({ type: "error", code: "ROOM_DELETED", message: "Room has been deleted by owner." });
                room.destroy();
                rooms.delete(id);
                destroyedRooms.push(id);
            } catch (err) {
                logger.error(`[GDPR] Failed to destroy room ${id}:`, err);
            }
        }
    }

    // 2. Scrub the user's PII from every remaining loaded room.
    let scrubbedRooms = 0;
    for (const [id, room] of rooms.entries()) {
        try {
            room.scrubDeletedUser(userId);
            scrubbedRooms++;
        } catch (err) {
            logger.error(`[GDPR] Failed to scrub user from room ${id}:`, err);
        }
    }

    return { destroyedRooms, scrubbedRooms };
}

module.exports = { purgeUserFromMemory };
