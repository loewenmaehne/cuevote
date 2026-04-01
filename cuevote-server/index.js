// Copyright (c) 2026 Julian Zienert. Licensed under the PolyForm Noncommercial License 1.0.0.
require('dotenv').config();
const logger = require('./logger');
logger.info("Server starting...");
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // In production, crash so the process manager can restart cleanly.
    if (process.env.NODE_ENV === 'production') {
        try {
            setTimeout(() => process.exit(1), 100);
        } catch {
            process.exit(1);
        }
    }
});

const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");
const bcrypt = require('bcryptjs');
const { slugify } = require('transliteration');
const db = require('./db');
const dbAsync = require('./db-async');
const backupScheduler = require('./backup_scheduler');
backupScheduler.start();

// Ensure global fetch is available (Node 18+ or polyfilled).
if (typeof fetch !== 'function') {
    logger.error('[Startup] global.fetch is not available. Require Node.js 18+ or a fetch polyfill.');
    process.exit(1);
}

function redactForLog(value) {
    if (value === undefined || value === null || value === '') return '[REDACTED]';
    return '[REDACTED]';
}

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

const server = http.createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }
    res.writeHead(404);
    res.end();
});

const wss = new WebSocket.Server({
    server,
    perMessageDeflate: false,
    maxPayload: 64 * 1024, // 64 KB — prevents DoS via oversized messages
    verifyClient: (info, cb) => {
        if (ALLOWED_ORIGINS.length === 0) {
            if (process.env.NODE_ENV === 'production') {
                logger.error('[Security] No ALLOWED_ORIGINS configured in production. Rejecting connection.');
                return cb(false, 503, 'Origin configuration required');
            }
            return cb(true);
        }

        const origin = info.origin;
        if (ALLOWED_ORIGINS.includes(origin)) {
            return cb(true);
        }

        logger.info(`[Security] Blocked connection from unauthorized origin: ${origin}`);
        return cb(false, 403, 'Forbidden');
    }
});
wss.on('error', (err) => {
    logger.error('[WSS] WebSocket server error:', err);
});

server.listen(process.env.PORT || 8080, '0.0.0.0');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

async function verifyGoogleToken(token) {
    try {
        const tokenInfoRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
        );
        if (!tokenInfoRes.ok) {
            throw new Error('Invalid or expired access token');
        }
        const tokenInfo = await tokenInfoRes.json();
        if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
            throw new Error('Token was not issued for this application');
        }

        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user info');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        logger.error("Token verification failed:", error);
        throw error;
    }
}

const Room = require('./Room');
const schemas = require('./schemas');

// Room Manager
const rooms = new Map();

// Default rooms removed

// Initialize system user (rooms are loaded on-demand via JOIN_ROOM)
function loadRooms() {
    try {
        db.upsertUser({
            id: 'system',
            email: 'system@cuevote.com',
            name: 'System',
            picture: ''
        });
    } catch (e) { logger.error("System user init failed", e); }
}

loadRooms();

const clients = new Set();

logger.info("WebSocket server started on port", process.env.PORT || 8080);

const connectionAttempts = new Map();

// Helper to cleanup old rate limit entries
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of connectionAttempts.entries()) {
        if (now - data.timestamp > 60000) { // Clear after 1 minute
            connectionAttempts.delete(ip);
        }
    }
}, 60000);

wss.on("connection", (ws, req) => {
    const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Rate Limiting (Simple: 30 connections per minute per IP)
    if (ip) {
        const now = Date.now();
        const limitData = connectionAttempts.get(ip) || { count: 0, timestamp: now };

        // Reset if older than 1 minute
        if (now - limitData.timestamp > 60000) {
            limitData.count = 0;
            limitData.timestamp = now;
        }

        limitData.count++;
        connectionAttempts.set(ip, limitData);

        if (limitData.count > 30) {
            logger.warn(`[RATE LIMIT] Blocking connection from ${ip}`);
            ws.close(1008, 'Rate Limit Exceeded');
            return;
        }
    }

    logger.info("Client connected");

    // Parse Client ID
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const clientId = urlParams.get('clientId');

    if (clientId) {
        ws.id = clientId;
        for (const existing of clients) {
            if (existing.id === clientId && existing !== ws) {
                logger.info(`[Reconnect] Evicting stale socket for clientId: ${clientId}`);
                if (existing.roomId) {
                    ws.lastRoomId = existing.roomId;
                    if (rooms.has(existing.roomId)) {
                        rooms.get(existing.roomId).removeClient(existing);
                    }
                }
                if (existing.user) ws.user = existing.user;
                clients.delete(existing);
                existing.terminate();
            }
        }
    } else {
        ws.id = crypto.randomUUID();
    }

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws._msgCount = 0;
    ws._msgWindowStart = Date.now();

    clients.add(ws);

    // Default Join (Lobby or specific room)
    // REMOVED: Do not auto-join "synthwave". Wait for explicit JOIN_ROOM.
    /*
    const defaultRoomId = "synthwave";
    const room = rooms.get(defaultRoomId);
    if (room) {
        ws.roomId = defaultRoomId;
        room.addClient(ws);
    }
    */

    ws.on("message", async (message) => {
        try {
            // Per-message rate limit: 60 messages per 10 seconds per socket
            const now = Date.now();
            if (now - ws._msgWindowStart > 10000) {
                ws._msgCount = 0;
                ws._msgWindowStart = now;
            }
            ws._msgCount++;
            if (ws._msgCount > 60) {
                ws.send(JSON.stringify({ type: "error", message: "Rate limit exceeded. Please slow down." }));
                return;
            }

            const raw = JSON.parse(message);
            const envelopeResult = schemas.WebSocketMessage.safeParse(raw);
            if (!envelopeResult.success) {
                ws.send(JSON.stringify({ type: "error", message: "Invalid message format." }));
                return;
            }
            const parsedMessage = envelopeResult.data;
            const msgId = parsedMessage.msgId;

            const sendAck = () => {
                if (msgId && ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: "ACK", msgId }));
                }
            };

            // Handle Global Messages (Auth, Routing)
            switch (parsedMessage.type) {
                case "LOGIN": {
                    const loginResult = schemas.LoginPayload.safeParse(parsedMessage.payload);
                    if (!loginResult.success) {
                        ws.send(JSON.stringify({ type: "error", message: "Invalid login payload." }));
                        return;
                    }
                    const { token } = loginResult.data;
                        logger.info("[LOGIN TRACE] Processing login request...");
                        try {
                            const payload = await verifyGoogleToken(token);
                            logger.info(`[LOGIN TRACE] Token verified for Google Subject: ${redactForLog(payload.sub)}`);

                        const userData = {
                            id: payload.sub,
                            email: payload.email,
                            name: payload.name,
                            picture: payload.picture
                        };

                        // Generate Session Token
                        const sessionToken = crypto.randomBytes(32).toString('hex');
                        const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours

                        // Atomic: upsert user + create session in one transaction
                        logger.info("[LOGIN TRACE] Creating user and session...");
                        try {
                            ws.user = db.loginUser(userData, sessionToken, expiresAt);
                            logger.info("[LOGIN TRACE] Login transaction successful.");
                        } catch (dbErr) {
                            logger.error("[LOGIN CRITICAL] Login transaction failed:", dbErr);
                            throw dbErr;
                        }

                        logger.info("[LOGIN TRACE] Sending LOGIN_SUCCESS");
                        ws.send(JSON.stringify({
                            type: "LOGIN_SUCCESS",
                            payload: { user: ws.user, sessionToken }
                        }));
                    } catch (e) {
                        logger.error("[LOGIN FAILURE] Error Details:", e);
                        ws.send(JSON.stringify({ type: "error", message: "Login failed: " + e.message }));
                    }
                    return;
                }
                case "RESUME_SESSION": {
                    const resumeResult = schemas.ResumeSessionPayload.safeParse(parsedMessage.payload);
                    if (!resumeResult.success) {
                        ws.send(JSON.stringify({ type: "SESSION_INVALID" }));
                        return;
                    }
                    const { token } = resumeResult.data;
                    const session = db.getSession(token);
                    if (session) {
                        const user = db.getUser(session.user_id);
                        if (user) {
                            ws.user = user;
                            const resumePayload = { user: ws.user, sessionToken: token };
                            if (ws.lastRoomId) resumePayload.lastRoomId = ws.lastRoomId;
                            ws.send(JSON.stringify({
                                type: "LOGIN_SUCCESS",
                                payload: resumePayload
                            }));
                        } else {
                            // Session exists but user is gone (deleted?)
                            logger.warn(`[Resume Session] Session found but user ${redactForLog(session.user_id)} is missing. Invalidating.`);
                            db.deleteSession(token);
                            ws.send(JSON.stringify({ type: "SESSION_INVALID" }));
                        }
                    } else {
                        ws.send(JSON.stringify({ type: "SESSION_INVALID" }));
                    }
                    return;
                }
                case "LOGOUT": {
                    const logoutResult = schemas.LogoutPayload.safeParse(parsedMessage.payload);
                    if (logoutResult.success) db.deleteSession(logoutResult.data.token);
                    ws.user = null;
                    return;
                }


                // ... existing code ...

                case "DELETE_ACCOUNT": {
                    logger.info("[SERVER TRACE] DELETE_ACCOUNT received");
                    if (!ws.user) {
                        logger.info(`[GDPR] DELETE_ACCOUNT failed: No user attached to socket. WS ID: ${ws.id}`);
                        ws.send(JSON.stringify({ type: "error", message: "Not logged in." }));
                        return;
                    }
                    const userId = ws.user.id;
                    logger.info(`[GDPR] Deleting account for user: ${redactForLog(userId)}`);

                    // 1. Delete from DB (Synchronous Transaction)
                    try {
                        logger.info(`[GDPR TRACE] Starting DB Deletion for ${redactForLog(userId)}...`);

                        // Debug: Count before
                        const beforeRooms = db.listUserRooms(userId);
                        logger.info(`[GDPR PRE-CHECK] User owns ${beforeRooms.length} rooms in DB.`);

                        const success = db.deleteUser(userId);
                        logger.info(`[GDPR TRACE] DB Deletion execution success: ${success}`);

                        // Debug: Count after
                        // If delete worked, this should be empty list (wait, listUserRooms uses user ID)
                        // But user is deleted! So listUserRooms(userId) might return empty just because user is gone?
                        // No, listUserRooms queries 'rooms' table by owner_id. It doesn't join 'users' necessarily.
                        // Let's check listUserRooms implementation.
                        // "SELECT * FROM rooms WHERE owner_id = ?"
                        const afterRooms = db.listUserRooms(userId);
                        logger.info(`[GDPR POST-CHECK] User owns ${afterRooms.length} rooms in DB. (Should be 0)`);

                    } catch (e) {
                        logger.info(`[GDPR ERROR] Failed to delete user from DB: ${e.message}`);
                        logger.error("Failed to delete user from DB", e);
                        ws.send(JSON.stringify({ type: "error", message: "Failed to delete account data." }));
                        return;
                    }

                    // 2. Destroy Memory
                    const roomsToDestroy = [];
                    logger.info(`[GDPR DEBUG] Checking ${rooms.size} active memory rooms for ownership...`);
                    const targetId = String(userId).trim();

                    for (const [id, room] of rooms.entries()) {
                        const owner = String(room.metadata.owner_id || '').trim();
                        if (owner === targetId) {
                            logger.info(`[GDPR DEBUG] Marking memory room ${id} for destruction.`);
                            roomsToDestroy.push(id);
                        }
                    }

                    roomsToDestroy.forEach(id => {
                        const room = rooms.get(id);
                        if (room) {
                            logger.info(`[GDPR] Destroying room ${id} from memory.`);
                            try {
                                room.broadcast({ type: "error", code: "ROOM_DELETED", message: "Room has been deleted by owner." });
                                room.destroy();
                                rooms.delete(id);
                            } catch (err) {
                                logger.info(`[GDPR ERROR] Failed to destroy room ${id}: ${err.message}`);
                            }
                        }
                    });

                    // 2b. GDPR: Scrub deleted user's PII from all other rooms (voters, suggestedBy, suggestedByUsername)
                    for (const [id, room] of rooms.entries()) {
                        try {
                            room.scrubDeletedUser(userId);
                        } catch (err) {
                            logger.info(`[GDPR ERROR] Failed to scrub user from room ${id}: ${err.message}`);
                        }
                    }

                    // 3. Success
                    logger.info("[GDPR TRACE] Sending DELETE_ACCOUNT_SUCCESS");
                    ws.send(JSON.stringify({ type: "DELETE_ACCOUNT_SUCCESS" }));
                    ws.user = null;
                    return;
                }
                case "STATE_ACK": {
                    logger.info(`[SERVER TRACE] Client ${ws.id} ACKNOWLEDGED state for room: ${parsedMessage.payload.roomId}`);
                    return;
                }
                case "JOIN_ROOM": {
                    const joinResult = schemas.JoinRoomPayload.safeParse(parsedMessage.payload);
                    if (!joinResult.success) {
                        ws.send(JSON.stringify({ type: "error", message: "Invalid room ID." }));
                        return;
                    }
                    const { roomId, password } = joinResult.data;
                    logger.info(`[SERVER TRACE] Client ${ws.id} requesting to join room: ${roomId}`);

                    // Leave ALL rooms to ensure no duplicate subscriptions
                    for (const [id, room] of rooms.entries()) {
                        if (room.clients.has(ws)) {
                            logger.info(`[SERVER TRACE] Client ${ws.id} leaving room (forced cleanup): ${id}`);
                            room.removeClient(ws);
                        }
                    }

                    // Try to resolve room
                    let room = rooms.get(roomId) || rooms.get(roomId.toLowerCase()) || rooms.get(roomId.toUpperCase());

                    if (!room) {
                        try {
                            const roomData = db.getRoom(roomId) || db.getRoom(roomId.toLowerCase()) || db.getRoom(roomId.toUpperCase());
                            if (roomData) {
                                const resolvedId = roomData.id;
                                logger.info(`Waking up idle room: ${roomData.name} (${resolvedId})`);
                                room = new Room(resolvedId, roomData.name, YOUTUBE_API_KEY, roomData);
                                rooms.set(resolvedId, room);
                            }
                        } catch (e) {
                            logger.error("DB Lookup failed", e);
                        }
                    }

                    if (room) {
                        // Password Check
                        if (room.metadata.password) {
                            const isOwner = ws.user && ws.user.id === room.metadata.owner_id;
                            if (!isOwner && (!password || !bcrypt.compareSync(password, room.metadata.password))) {
                                ws.send(JSON.stringify({ type: "error", code: "PASSWORD_REQUIRED", message: "Password required" }));
                                return;
                            }
                        }

                        logger.info(`Client ${ws.id} joining room: ${room.id}`);
                        ws.roomId = room.id;
                        room.addClient(ws);
                        db.updateRoomActivity(room.id);
                        sendAck();
                    } else {
                        ws.send(JSON.stringify({ type: "error", code: "ROOM_NOT_FOUND", message: "Room not found" }));
                    }
                    return;
                }
                case "CREATE_ROOM": {
                    if (!ws.user) {
                        ws.send(JSON.stringify({ type: "error", message: "You must be logged in to create a room." }));
                        return;
                    }
                    const createResult = schemas.CreateRoomPayload.safeParse(parsedMessage.payload);
                    if (!createResult.success) {
                        ws.send(JSON.stringify({ type: "error", message: "Invalid room data. Name is required (max 100 chars)." }));
                        return;
                    }
                    const { name, description, color, isPrivate, password, captionsEnabled, languageFlag } = createResult.data;

                    let attempts = 0;
                    let success = false;
                    while (attempts < 3 && !success) {
                        attempts++;
                        const id = slugify(name, { lowercase: true, separator: '-' }) + '-' + crypto.randomBytes(8).toString('hex');

                        try {
                            const roomData = {
                                id,
                                name,
                                description: description || "Community Station",
                                owner_id: ws.user.id,
                                color: color || "from-gray-700 to-black",
                                is_public: isPrivate ? 0 : 1,
                                password: (isPrivate && password) ? bcrypt.hashSync(password, 10) : null,
                                captions_enabled: captionsEnabled ? 1 : 0,
                                language_flag: languageFlag || 'international'
                            };

                            db.createRoom(roomData);
                            rooms.set(id, new Room(id, name, YOUTUBE_API_KEY, roomData));

                            const { password: _hash, ...safeRoomData } = roomData;
                            ws.send(JSON.stringify({ type: "ROOM_CREATED", payload: safeRoomData }));
                            success = true;
                        } catch (err) {
                            if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                                logger.warn(`[Create Room] ID Collision for ${id}. Retrying... (${attempts}/3)`);
                                continue;
                            }
                            logger.error("Create Room Error:", err);
                            ws.send(JSON.stringify({ type: "error", message: "Failed to create room." }));
                            return; // Exit on non-collision error
                        }
                    }

                    if (!success) {
                        ws.send(JSON.stringify({ type: "error", message: "Failed to generate a unique channel ID. Please try again." }));
                    }
                    return;
                }
                case "LIST_ROOMS": {
                    const listResult = schemas.ListRoomsPayload.safeParse(parsedMessage.payload);
                    const listPayload = listResult.success ? (listResult.data || {}) : {};
                    const showPrivate = listPayload.type === 'private';
                    const showMyChannels = listPayload.type === 'my_channels';
                    const pageSize = listPayload.limit || 50;
                    const page = listPayload.page || 1;
                    const offset = (page - 1) * pageSize;

                    if (showMyChannels) {
                        logger.info(`[DEBUG_MARATHON] LIST_ROOMS (My Channels) requested by: ${redactForLog(ws.user?.id)}`);
                    }

                    if (showMyChannels && !ws.user) {
                        ws.send(JSON.stringify({ type: "ROOM_LIST", payload: [], page: 1, totalPages: 0, total: 0 }));
                        return;
                    }

                    const roomList = [];
                    // 1. Get from Memory (Active)
                    for (const room of rooms.values()) {
                        if (room.deleted) continue;
                        if (showMyChannels) {
                            if (room.metadata.owner_id === ws.user.id) {
                                roomList.push(room.getSummary());
                            }
                        } else {
                            const isPublic = room.metadata.is_public === 1;
                            if ((showPrivate && !isPublic) || (!showPrivate && isPublic)) {
                                if (showPrivate && !room.metadata.password) {
                                    continue;
                                }
                                roomList.push(room.getSummary());
                            }
                        }
                    }

                    // 2. Get from DB (idle rooms not in memory)
                    let dbRooms = [];
                    if (showMyChannels) {
                        dbRooms = db.listUserRooms(ws.user.id);
                        logger.info(`[DEBUG_MARATHON] DB returned ${dbRooms.length} rooms for user ${redactForLog(ws.user?.id)}. IDs: ${dbRooms.map(r => r.id).join(', ')}`);
                    } else {
                        dbRooms = showPrivate ? db.listPrivateRooms() : db.listPublicRooms();
                    }

                    const activeIds = new Set(roomList.map(r => r.id));

                    dbRooms.forEach(dbr => {
                        if (!showMyChannels && showPrivate && !dbr.password) {
                            return;
                        }

                        if (!activeIds.has(dbr.id)) {
                            let lobbyPreview = null;
                            if (dbr.lobby_preview) {
                                const dormantSeconds = Math.floor(Date.now() / 1000) - (dbr.last_active_at || 0);
                                const TWENTY_EIGHT_DAYS_S = 28 * 24 * 60 * 60;
                                if (dormantSeconds <= TWENTY_EIGHT_DAYS_S) {
                                    try { lobbyPreview = JSON.parse(dbr.lobby_preview); } catch (e) { /* ignore */ }
                                }
                            }
                            roomList.push({
                                id: dbr.id,
                                name: dbr.name,
                                description: dbr.description,
                                color: dbr.color,
                                listeners: 0,
                                currentTrack: lobbyPreview,
                                is_protected: !!dbr.password,
                                isActive: false,
                                language_flag: dbr.language_flag || 'international'
                            });
                        }
                    });

                    // Patch active rooms with protection status
                    for (const roomItem of roomList) {
                        const activeRoom = rooms.get(roomItem.id);
                        if (activeRoom && activeRoom.metadata.password) {
                            roomItem.is_protected = true;
                        }
                    }

                    // Sort: active rooms first (by listener count desc), then idle rooms (by name)
                    roomList.sort((a, b) => {
                        if (a.isActive !== false && b.isActive === false) return -1;
                        if (a.isActive === false && b.isActive !== false) return 1;
                        return (b.listeners || 0) - (a.listeners || 0);
                    });

                    // Paginate the merged result
                    const total = roomList.length;
                    const totalPages = Math.ceil(total / pageSize);
                    const paginatedList = roomList.slice(offset, offset + pageSize);

                    ws.send(JSON.stringify({
                        type: "ROOM_LIST",
                        payload: paginatedList,
                        page,
                        totalPages,
                        total
                    }));
                    return;
                }
                case "DEBUG": {
                    if (process.env.NODE_ENV !== 'production') {
                        logger.info("[CLIENT DEBUG]", typeof parsedMessage.payload === 'string'
                            ? parsedMessage.payload.slice(0, 200)
                            : '[object]');
                    }
                    return;
                }
                case "PING": {
                    ws.send(JSON.stringify({ type: "PONG" }));
                    return;
                }
            }

            // Delegate Room-Specific Messages
            if (ws.roomId && rooms.has(ws.roomId)) {
                await rooms.get(ws.roomId).handleMessage(ws, parsedMessage);
            } else {
                logger.warn(`[SERVER] Unrouted message type="${parsedMessage.type}" from client ${ws.id} (roomId=${ws.roomId})`);
                ws.send(JSON.stringify({ type: "error", message: "Not connected to a channel. Please rejoin." }));
            }

        } catch (error) {
            logger.error("Failed to handle message:", error);
        }
    });

    ws.on("error", (err) => {
        logger.error(`[WS Error] Client ${ws.id}:`, err.message);
        clients.delete(ws);
        if (ws.roomId && rooms.has(ws.roomId)) {
            rooms.get(ws.roomId).removeClient(ws);
        }
    });

    ws.on("close", () => {
        logger.info("Client disconnected");
        clients.delete(ws);
        if (ws.roomId && rooms.has(ws.roomId)) {
            rooms.get(ws.roomId).removeClient(ws);
        }
    });
});

// Server-side WebSocket heartbeat: detect and terminate dead connections that
// never sent a clean close (e.g. network drop, OS killed the app).
const WS_HEARTBEAT_INTERVAL = 30000;
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            logger.info(`[Heartbeat] Terminating dead connection: ${ws.id}`);
            clients.delete(ws);
            if (ws.roomId && rooms.has(ws.roomId)) {
                rooms.get(ws.roomId).removeClient(ws);
            }
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, WS_HEARTBEAT_INTERVAL);

// Periodic sweep: remove clients that are no longer in OPEN state
setInterval(() => {
    let cleaned = 0;
    for (const ws of clients) {
        if (ws.readyState !== WebSocket.OPEN) {
            clients.delete(ws);
            if (ws.roomId && rooms.has(ws.roomId)) {
                rooms.get(ws.roomId).removeClient(ws);
            }
            cleaned++;
        }
    }
    if (cleaned > 0) logger.info(`[Sweep] Cleaned ${cleaned} stale client entries.`);
}, 60000);

// Cleanup Idle Rooms (Every 5 minutes)
setInterval(() => {
    logger.info("Running cleanup task...");
    for (const [id, room] of rooms.entries()) {
        if (room.clients.size === 0) {
            logger.info(`Unloading idle room: ${room.name} (${id})`);
            room.destroy(); // Stop the timer
            rooms.delete(id);
        }
    }
}, 5 * 60 * 1000);

// Cleanup Old Room History, expired sessions, and stale API caches (Once a day)
setInterval(() => {
    logger.info("Running daily cleanup task...");
    dbAsync.runDailyCleanup();
}, 24 * 60 * 60 * 1000);

// Run all cleanups once on startup as well
dbAsync.runDailyCleanup();

function gracefulShutdown(signal) {
    logger.info(`[Shutdown] ${signal} received. Closing ${wss.clients.size} connections...`);
    const shutdownMsg = JSON.stringify({ type: "error", code: "SERVER_RESTARTING", message: "Server is restarting. Reconnecting..." });
    wss.clients.forEach((ws) => {
        try {
            ws.send(shutdownMsg);
            ws.close(1012, 'Server restarting');
        } catch (e) { /* ignore */ }
    });
    for (const [id, room] of rooms.entries()) {
        room.destroy();
    }
    rooms.clear();
    dbAsync.shutdown();
    wss.close(() => {
        server.close(() => {
            logger.info('[Shutdown] Server closed.');
            process.exit(0);
        });
    });
    setTimeout(() => process.exit(0), 3000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
