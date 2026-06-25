// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Localhost-only HTTP admin API for ops tooling (consumed by cuevote-mcp,
// Phase 1b). It exposes live in-memory room state and moderation actions that
// the read-only DB layer cannot reach.
//
// SECURITY: disabled unless ADMIN_TOKEN is set; binds to 127.0.0.1 by default.
// NEVER proxy this port publicly. Every request must carry
//   Authorization: Bearer <ADMIN_TOKEN>
const http = require('http');
const crypto = require('crypto');
const logger = require('./logger');
const db = require('./db');
const dbAsync = require('./db-async');
const { purgeUserFromMemory } = require('./gdpr');

function sendJson(res, code, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve) => {
        let data = '';
        req.on('data', (chunk) => {
            data += chunk;
            if (data.length > 1_000_000) req.destroy(); // 1 MB cap
        });
        req.on('end', () => {
            if (!data) return resolve({});
            try { resolve(JSON.parse(data)); } catch { resolve({}); }
        });
        req.on('error', () => resolve({}));
    });
}

function tokensMatch(provided, expected) {
    const a = Buffer.from(provided || '', 'utf8');
    const b = Buffer.from(expected || '', 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

// Drop the password hash from any room metadata before it leaves the process.
function safeMeta(meta) {
    if (!meta) return meta;
    const { password, ...rest } = meta;
    return { ...rest, is_protected: !!password };
}

function nowPlaying(room) {
    const t = room.state.currentTrack;
    return t ? { title: t.title, artist: t.artist, videoId: t.videoId } : null;
}

function listActiveRooms(rooms) {
    const list = [];
    for (const [id, room] of rooms.entries()) {
        list.push({
            id,
            name: room.name,
            listeners: room.clients.size,
            isPlaying: !!room.state.isPlaying,
            queueLength: (room.state.queue || []).length,
            pending: (room.state.pendingSuggestions || []).length,
            banned: (room.state.bannedVideos || []).length,
            isPublic: room.metadata.is_public === 1,
            nowPlaying: nowPlaying(room),
        });
    }
    return list;
}

function roomAction(room, action, body, rooms, roomId) {
    switch (action) {
        case 'skip':
            room.handleNextTrack();
            return { ok: true, action, nowPlaying: nowPlaying(room) };
        case 'pause': {
            const playing = !!body.playing;
            if (playing) {
                room.networkThrottleUntil = 0;
                room.consecutiveIPErrors = 0;
            }
            room.updateState({ isPlaying: playing });
            return { ok: true, action, isPlaying: playing };
        }
        case 'ban':
            if (!body.trackId) return { error: 'missing_trackId' };
            room.handleBanSuggestion({ trackId: body.trackId });
            return { ok: true, action, banned: (room.state.bannedVideos || []).length };
        case 'unban':
            if (!body.videoId) return { error: 'missing_videoId' };
            room.handleUnbanSong({ videoId: body.videoId });
            return { ok: true, action, banned: (room.state.bannedVideos || []).length };
        case 'approve':
            if (!body.trackId) return { error: 'missing_trackId' };
            room.handleApproveSuggestion({ trackId: body.trackId });
            return { ok: true, action, pending: (room.state.pendingSuggestions || []).length };
        case 'reject':
            if (!body.trackId) return { error: 'missing_trackId' };
            room.handleRejectSuggestion({ trackId: body.trackId });
            return { ok: true, action, pending: (room.state.pendingSuggestions || []).length };
        case 'remove':
            if (!body.trackId) return { error: 'missing_trackId' };
            room.handleDeleteSong({ trackId: body.trackId });
            return { ok: true, action, queueLength: (room.state.queue || []).length };
        case 'broadcast': {
            const message = String(body.message || '').slice(0, 500);
            if (!message) return { error: 'missing_message' };
            room.broadcast({ type: 'info', message });
            return { ok: true, action, delivered: room.clients.size };
        }
        default:
            return { error: 'unknown_action' };
    }
}

function deleteRoom(rooms, roomId) {
    const room = rooms.get(roomId);
    const result = db.deleteRoom(roomId);
    if (room) {
        room.deleted = true;
        try { room.broadcast(JSON.stringify({ type: 'ROOM_DELETED' })); } catch { /* ignore */ }
        setTimeout(() => {
            room.clients.forEach((c) => { try { c.close(); } catch { /* ignore */ } });
            room.clients.clear();
        }, 200);
        try { room.destroy(); } catch { /* room_state row already cascade-deleted */ }
        rooms.delete(roomId);
    }
    return { ok: true, dbChanges: result.changes, wasActive: !!room };
}

function gdprDelete(rooms, userId) {
    const dbDeleted = db.deleteUser(userId);
    const purge = purgeUserFromMemory(rooms, userId);
    logger.info(`[Admin][GDPR] Deleted user (redacted). Rooms destroyed: ${purge.destroyedRooms.length}, scrubbed: ${purge.scrubbedRooms}.`);
    return { ok: true, dbDeleted, destroyedRooms: purge.destroyedRooms.length, scrubbedRooms: purge.scrubbedRooms };
}

async function handle(req, res, rooms, token) {
    // Auth (timing-safe).
    const auth = req.headers['authorization'] || '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!tokensMatch(provided, token)) {
        return sendJson(res, 401, { error: 'unauthorized' });
    }

    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean); // e.g. ['admin','rooms','id','skip']
    const M = req.method;

    if (parts[0] !== 'admin') return sendJson(res, 404, { error: 'not_found' });

    // GET /admin/health
    if (parts[1] === 'health' && M === 'GET') {
        return sendJson(res, 200, { status: 'ok', activeRooms: rooms.size });
    }

    // /admin/rooms ...
    if (parts[1] === 'rooms') {
        // GET /admin/rooms  → live, in-memory rooms
        if (parts.length === 2 && M === 'GET') {
            return sendJson(res, 200, { rooms: listActiveRooms(rooms) });
        }
        const roomId = parts[2];
        if (!roomId) return sendJson(res, 404, { error: 'not_found' });

        // DELETE /admin/rooms/:id
        if (parts.length === 3 && M === 'DELETE') {
            try { return sendJson(res, 200, deleteRoom(rooms, roomId)); }
            catch (e) { return sendJson(res, 500, { error: 'delete_failed', message: e.message }); }
        }

        // GET /admin/rooms/:id → true live state, or persisted snapshot fallback
        if (parts.length === 3 && M === 'GET') {
            const room = rooms.get(roomId);
            if (room) {
                return sendJson(res, 200, {
                    active: true,
                    listeners: room.clients.size,
                    metadata: safeMeta(room.metadata),
                    state: room.state,
                });
            }
            const meta = db.getRoom(roomId);
            if (!meta) return sendJson(res, 404, { error: 'room_not_found' });
            return sendJson(res, 200, {
                active: false,
                metadata: safeMeta(meta),
                snapshot: db.loadRoomState(roomId),
            });
        }

        // POST /admin/rooms/:id/:action → live moderation
        if (parts.length === 4 && M === 'POST') {
            const room = rooms.get(roomId);
            if (!room) {
                return sendJson(res, 409, {
                    error: 'room_not_active',
                    message: 'Room is not loaded in memory; live actions require an active room.',
                });
            }
            const body = await readBody(req);
            const result = roomAction(room, parts[3], body, rooms, roomId);
            return sendJson(res, result.error ? 400 : 200, result);
        }
    }

    // POST /admin/users/:id/gdpr-delete
    if (parts[1] === 'users' && parts[3] === 'gdpr-delete' && M === 'POST') {
        const userId = parts[2];
        if (!userId) return sendJson(res, 400, { error: 'missing_user' });
        try { return sendJson(res, 200, gdprDelete(rooms, userId)); }
        catch (e) { return sendJson(res, 500, { error: 'gdpr_delete_failed', message: e.message }); }
    }

    // POST /admin/maintenance/:task
    if (parts[1] === 'maintenance' && M === 'POST') {
        const task = parts[2];
        if (task === 'cleanup') {
            dbAsync.runDailyCleanup();
            return sendJson(res, 200, { ok: true, task: 'cleanup', note: 'dispatched to async worker' });
        }
        if (task === 'backup') {
            const body = await readBody(req);
            const dest = body.dest || `./backups/admin-backup-${Date.now()}.db`;
            try {
                await db.backup(dest);
                return sendJson(res, 200, { ok: true, dest });
            } catch (e) {
                return sendJson(res, 500, { error: 'backup_failed', message: e.message });
            }
        }
        return sendJson(res, 404, { error: 'unknown_task' });
    }

    return sendJson(res, 404, { error: 'not_found' });
}

/**
 * Start the admin HTTP server. No-op (returns null) unless ADMIN_TOKEN is set,
 * so existing deployments are unaffected until they opt in.
 */
function start({ rooms }) {
    const token = process.env.ADMIN_TOKEN;
    if (!token) {
        logger.info('[Admin] ADMIN_TOKEN not set — admin API disabled.');
        return null;
    }
    if (token.length < 16) {
        logger.warn('[Admin] ADMIN_TOKEN is shorter than 16 chars — use a strong random token.');
    }
    const port = parseInt(process.env.ADMIN_PORT || '8081', 10);
    const host = process.env.ADMIN_HOST || '127.0.0.1';

    const server = http.createServer((req, res) => {
        handle(req, res, rooms, token).catch((err) => {
            logger.error('[Admin] handler error:', err);
            try { sendJson(res, 500, { error: 'internal_error' }); } catch { /* ignore */ }
        });
    });
    server.on('error', (err) => logger.error('[Admin] server error:', err));
    server.listen(port, host, () => {
        logger.info(`[Admin] Admin API listening on http://${host}:${port} (token required, localhost only)`);
    });
    return server;
}

module.exports = { start };
