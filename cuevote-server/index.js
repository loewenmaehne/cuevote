console.log("Server starting...");
require('dotenv').config();
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
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
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const db = require('./db');
const fs = require('fs');
const backupScheduler = require('./backup_scheduler');
backupScheduler.start();

// Ensure global fetch is available (Node 18+ or polyfilled).
if (typeof fetch !== 'function') {
    console.error('[Startup] global.fetch is not available. Require Node.js 18+ or a fetch polyfill.');
    process.exit(1);
}

const logFile = 'debug_server.log';
// GDPR: avoid persisting user identifiers to log file; use this for any PII in messages
function redactForLog(value) {
    if (value === undefined || value === null || value === '') return '[REDACTED]';
    return '[REDACTED]';
}
function logToFile(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    try {
        fs.appendFileSync(logFile, line);
    } catch (e) { console.error("Log failed", e); }
    console.log(msg);
}

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

const server = http.createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ status: 'ok', clients: clients.size, rooms: rooms.size, uptime: process.uptime() }));
        return;
    }
    res.writeHead(404);
    res.end();
});

const wss = new WebSocket.Server({
    server,
    perMessageDeflate: false,
    verifyClient: (info, cb) => {
        if (ALLOWED_ORIGINS.length === 0) {
            if (process.env.NODE_ENV === 'production') {
                console.error('[Security] No ALLOWED_ORIGINS configured in production. Rejecting connection.');
                return cb(false, 503, 'Origin configuration required');
            }
            return cb(true);
        }

        const origin = info.origin;
        if (ALLOWED_ORIGINS.includes(origin)) {
            return cb(true);
        }

        console.log(`[Security] Blocked connection from unauthorized origin: ${origin}`);
        return cb(false, 403, 'Forbidden');
    }
});
wss.on('error', (err) => {
    console.error('[WSS] WebSocket server error:', err);
});

server.listen(process.env.PORT || 8080, '0.0.0.0');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

async function verifyGoogleToken(token) {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user info');
        }

        const data = await response.json();
        return data; // Returns object with sub, name, email, picture
    } catch (error) {
        console.error("Token verification failed:", error);
        throw error;
    }
}

const Room = require('./Room');

// Room Manager
const rooms = new Map();

// Default rooms removed

// Initialize Rooms from DB
function loadRooms() {
    // Ensure System User
    try {
        db.upsertUser({
            id: 'system',
            email: 'system@cuevote.com',
            name: 'System',
            picture: ''
        });
    } catch (e) { console.error("System user init failed", e); }

    if (process.env.LOAD_ACTIVE_CHANNELS !== 'false') {
        const publicRooms = db.listPublicRooms();
        publicRooms.forEach(roomData => {
            if (!rooms.has(roomData.id)) {
                rooms.set(roomData.id, new Room(roomData.id, roomData.name, YOUTUBE_API_KEY, roomData));
                console.log(`Loaded room: ${roomData.name} (${roomData.id})`);
            }
        });
    }

}

loadRooms();

const clients = new Set();

console.log("WebSocket server started on port", process.env.PORT || 8080);

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
            console.warn(`[RATE LIMIT] Blocking connection from ${ip}`);
            ws.close(1008, 'Rate Limit Exceeded');
            return;
        }
    }

    console.log("Client connected");

    // Parse Client ID
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const clientId = urlParams.get('clientId');

    if (clientId) {
        ws.id = clientId;
        for (const existing of clients) {
            if (existing.id === clientId && existing !== ws) {
                console.log(`[Reconnect] Evicting stale socket for clientId: ${clientId}`);
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
            const parsedMessage = JSON.parse(message);
            const msgId = parsedMessage.msgId;

            const sendAck = () => {
                if (msgId && ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: "ACK", msgId }));
                }
            };

            // Handle Global Messages (Auth, Routing)
            switch (parsedMessage.type) {
                case "LOGIN": {
                    const { token } = parsedMessage.payload;
                        console.log("[LOGIN TRACE] Processing login request...");
                        try {
                            const payload = await verifyGoogleToken(token);
                            console.log(`[LOGIN TRACE] Token verified for Google Subject: ${redactForLog(payload.sub)}`);

                        let user = db.getUser(payload.sub);
                        console.log(`[LOGIN TRACE] User found in DB? ${!!user}`);

                        if (!user) {
                            console.log("[LOGIN TRACE] Creating new user record...");
                            user = {
                                id: payload.sub,
                                email: payload.email,
                                name: payload.name,
                                picture: payload.picture
                            };
                            try {
                                db.upsertUser(user);
                                console.log("[LOGIN TRACE] Upsert successful.");
                            } catch (dbErr) {
                                console.error("[LOGIN CRITICAL] UpsertUser failed:", dbErr);
                                throw dbErr;
                            }
                        }
                        ws.user = user;

                        // Generate Session Token
                        console.log("[LOGIN TRACE] Creating session...");
                        const sessionToken = crypto.randomBytes(32).toString('hex');
                        const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
                        db.createSession(sessionToken, user.id, expiresAt);

                        console.log("[LOGIN TRACE] Sending LOGIN_SUCCESS");
                        ws.send(JSON.stringify({
                            type: "LOGIN_SUCCESS",
                            payload: { user: ws.user, sessionToken }
                        }));
                    } catch (e) {
                        console.error("[LOGIN FAILURE] Error Details:", e);
                        ws.send(JSON.stringify({ type: "error", message: "Login failed: " + e.message }));
                    }
                    return;
                }
                case "RESUME_SESSION": {
                    const { token } = parsedMessage.payload;
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
                            console.warn(`[Resume Session] Session found but user ${redactForLog(session.user_id)} is missing. Invalidating.`);
                            db.deleteSession(token);
                            ws.send(JSON.stringify({ type: "SESSION_INVALID" }));
                        }
                    } else {
                        ws.send(JSON.stringify({ type: "SESSION_INVALID" }));
                    }
                    return;
                }
                case "LOGOUT": {
                    const { token } = parsedMessage.payload;
                    if (token) db.deleteSession(token);
                    ws.user = null;
                    return;
                }


                // ... existing code ...

                case "DELETE_ACCOUNT": {
                    logToFile("[SERVER TRACE] DELETE_ACCOUNT received");
                    if (!ws.user) {
                        logToFile(`[GDPR] DELETE_ACCOUNT failed: No user attached to socket. WS ID: ${ws.id}`);
                        ws.send(JSON.stringify({ type: "error", message: "Not logged in." }));
                        return;
                    }
                    const userId = ws.user.id;
                    logToFile(`[GDPR] Deleting account for user: ${redactForLog(userId)}`);

                    // 1. Delete from DB (Synchronous Transaction)
                    try {
                        logToFile(`[GDPR TRACE] Starting DB Deletion for ${redactForLog(userId)}...`);

                        // Debug: Count before
                        const beforeRooms = db.listUserRooms(userId);
                        logToFile(`[GDPR PRE-CHECK] User owns ${beforeRooms.length} rooms in DB.`);

                        const success = db.deleteUser(userId);
                        logToFile(`[GDPR TRACE] DB Deletion execution success: ${success}`);

                        // Debug: Count after
                        // If delete worked, this should be empty list (wait, listUserRooms uses user ID)
                        // But user is deleted! So listUserRooms(userId) might return empty just because user is gone?
                        // No, listUserRooms queries 'rooms' table by owner_id. It doesn't join 'users' necessarily.
                        // Let's check listUserRooms implementation.
                        // "SELECT * FROM rooms WHERE owner_id = ?"
                        const afterRooms = db.listUserRooms(userId);
                        logToFile(`[GDPR POST-CHECK] User owns ${afterRooms.length} rooms in DB. (Should be 0)`);

                    } catch (e) {
                        logToFile(`[GDPR ERROR] Failed to delete user from DB: ${e.message}`);
                        console.error("Failed to delete user from DB", e);
                        ws.send(JSON.stringify({ type: "error", message: "Failed to delete account data." }));
                        return;
                    }

                    // 2. Destroy Memory
                    const roomsToDestroy = [];
                    logToFile(`[GDPR DEBUG] Checking ${rooms.size} active memory rooms for ownership...`);
                    const targetId = String(userId).trim();

                    for (const [id, room] of rooms.entries()) {
                        const owner = String(room.metadata.owner_id || '').trim();
                        if (owner === targetId) {
                            logToFile(`[GDPR DEBUG] Marking memory room ${id} for destruction.`);
                            roomsToDestroy.push(id);
                        }
                    }

                    roomsToDestroy.forEach(id => {
                        const room = rooms.get(id);
                        if (room) {
                            logToFile(`[GDPR] Destroying room ${id} from memory.`);
                            try {
                                room.broadcast({ type: "error", code: "ROOM_DELETED", message: "Room has been deleted by owner." });
                                room.destroy();
                                rooms.delete(id);
                            } catch (err) {
                                logToFile(`[GDPR ERROR] Failed to destroy room ${id}: ${err.message}`);
                            }
                        }
                    });

                    // 2b. GDPR: Scrub deleted user's PII from all other rooms (voters, suggestedBy, suggestedByUsername)
                    for (const [id, room] of rooms.entries()) {
                        try {
                            room.scrubDeletedUser(userId);
                        } catch (err) {
                            logToFile(`[GDPR ERROR] Failed to scrub user from room ${id}: ${err.message}`);
                        }
                    }

                    // 3. Success
                    logToFile("[GDPR TRACE] Sending DELETE_ACCOUNT_SUCCESS");
                    ws.send(JSON.stringify({ type: "DELETE_ACCOUNT_SUCCESS" }));
                    ws.user = null;
                    return;
                }
                case "STATE_ACK": {
                    console.log(`[SERVER TRACE] Client ${ws.id} ACKNOWLEDGED state for room: ${parsedMessage.payload.roomId}`);
                    return;
                }
                case "JOIN_ROOM": {
                    const { roomId, password } = parsedMessage.payload;
                    console.log(`[SERVER TRACE] Client ${ws.id} requesting to join room: ${roomId}`);

                    // Leave ALL rooms to ensure no duplicate subscriptions
                    for (const [id, room] of rooms.entries()) {
                        if (room.clients.has(ws)) {
                            console.log(`[SERVER TRACE] Client ${ws.id} leaving room (forced cleanup): ${id}`);
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
                                console.log(`Waking up idle room: ${roomData.name} (${resolvedId})`);
                                room = new Room(resolvedId, roomData.name, YOUTUBE_API_KEY, roomData);
                                rooms.set(resolvedId, room);
                            }
                        } catch (e) {
                            console.error("DB Lookup failed", e);
                        }
                    }

                    if (room) {
                        // Password Check
                        if (room.metadata.password) {
                            const isOwner = ws.user && ws.user.id === room.metadata.owner_id;
                            if (!isOwner && (!password || password !== room.metadata.password)) {
                                ws.send(JSON.stringify({ type: "error", code: "PASSWORD_REQUIRED", message: "Password required" }));
                                return;
                            }
                        }

                        console.log(`Client ${ws.id} joining room: ${room.id}`);
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
                    const { name, description, color, isPrivate, password, captionsEnabled, languageFlag } = parsedMessage.payload;
                    if (!ws.user) {
                        ws.send(JSON.stringify({ type: "error", message: "You must be logged in to create a room." }));
                        return;
                    }

                    if (name.length > 100) {
                        ws.send(JSON.stringify({ type: "error", message: "Channel name must be 100 characters or less." }));
                        return;
                    }

                    let attempts = 0;
                    let success = false;
                    while (attempts < 3 && !success) {
                        attempts++;
                        // Generate ID (4 bytes = 8 hex chars)
                        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + crypto.randomBytes(4).toString('hex');

                        try {
                            const roomData = {
                                id,
                                name,
                                description: description || "Community Station",
                                owner_id: ws.user.id,
                                color: color || "from-gray-700 to-black",
                                is_public: isPrivate ? 0 : 1,
                                password: (isPrivate && password) ? password : null,
                                captions_enabled: captionsEnabled ? 1 : 0,
                                language_flag: languageFlag || 'international'
                            };

                            db.createRoom(roomData);
                            rooms.set(id, new Room(id, name, YOUTUBE_API_KEY, roomData));

                            ws.send(JSON.stringify({ type: "ROOM_CREATED", payload: roomData }));
                            success = true;
                        } catch (err) {
                            if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                                console.warn(`[Create Room] ID Collision for ${id}. Retrying... (${attempts}/3)`);
                                continue;
                            }
                            console.error("Create Room Error:", err);
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
                    const { type } = parsedMessage.payload || {}; // 'public', 'private', or 'my_channels'
                    const showPrivate = type === 'private';
                    const showMyChannels = type === 'my_channels';

                    if (showMyChannels) {
                        console.log(`[DEBUG_MARATHON] LIST_ROOMS (My Channels) requested by: ${redactForLog(ws.user?.id)}`);
                    }

                    if (showMyChannels && !ws.user) {
                        // If requesting my channels but not logged in, return empty or error?
                        // Frontend should handle UI, but backend should be safe.
                        ws.send(JSON.stringify({ type: "ROOM_LIST", payload: [] }));
                        return;
                    }

                    const roomList = [];
                    // 1. Get from Memory (Active)
                    for (const room of rooms.values()) {
                        if (room.deleted) continue; // Skip deleted rooms
                        if (showMyChannels) {
                            if (room.metadata.owner_id === ws.user.id) {
                                roomList.push(room.getSummary());
                            } else {
                                // console.log(`[DEBUG] Skipping room ${room.id} owned by ${room.metadata.owner_id} (Me: ${ws.user.id})`);
                            }
                        } else {
                            const isPublic = room.metadata.is_public === 1;
                            if ((showPrivate && !isPublic) || (!showPrivate && isPublic)) {
                                // Link-Only Access: Private rooms without password are hidden from lobby
                                if (showPrivate && !room.metadata.password) {
                                    continue;
                                }
                                roomList.push(room.getSummary());
                            }
                        }
                    }

                    // 2. Get from DB (To ensure we show searchable rooms that are idle)
                    // The memory list is only active rooms. We want searchable.
                    // But we don't want duplicates.

                    let dbRooms = [];
                    if (showMyChannels) {
                        dbRooms = db.listUserRooms(ws.user.id);
                        console.log(`[DEBUG_MARATHON] DB returned ${dbRooms.length} rooms for user ${redactForLog(ws.user?.id)}. IDs: ${dbRooms.map(r => r.id).join(', ')}`);
                    } else {
                        dbRooms = showPrivate ? db.listPrivateRooms() : db.listPublicRooms();
                    }

                    const activeIds = new Set(roomList.map(r => r.id));

                    dbRooms.forEach(dbr => {
                        // Link-Only Access: Private rooms without password are hidden from lobby
                        // UNLESS it is "My Channels" - I should see my own link-only links?
                        // User request: "My Channels, which are all channels created by me"
                        // So we should show them even if they are link-only/hidden from public lobby.
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

                    // Add is_protected flag to active rooms too (for UI lock icon)
                    roomList.forEach(r => {
                        const roomObj = rooms.get(r.id);
                        if (roomObj && roomObj.metadata.password) {
                            r.is_protected = true;
                        } else if (!roomObj) {
                            // Already handled in db loop?
                            // Actually active rooms summary comes from room.getSummary()
                            // room.getSummary doesn't include is_protected.
                            // We should add it to getSummary or patch it here.
                        }
                    });

                    // Patch active rooms with protection status
                    for (const roomItem of roomList) {
                        const activeRoom = rooms.get(roomItem.id);
                        if (activeRoom && activeRoom.metadata.password) {
                            roomItem.is_protected = true;
                        }
                    }

                    ws.send(JSON.stringify({ type: "ROOM_LIST", payload: roomList }));
                    return;
                }
                case "DEBUG": {
                    console.log("[CLIENT DEBUG]", parsedMessage.payload);
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
                console.warn(`[SERVER] Unrouted message type="${parsedMessage.type}" from client ${ws.id} (roomId=${ws.roomId})`);
                ws.send(JSON.stringify({ type: "error", message: "Not connected to a channel. Please rejoin." }));
            }

        } catch (error) {
            console.error("Failed to handle message:", error);
        }
    });

    ws.on("error", (err) => {
        console.error(`[WS Error] Client ${ws.id}:`, err.message);
        clients.delete(ws);
        if (ws.roomId && rooms.has(ws.roomId)) {
            rooms.get(ws.roomId).removeClient(ws);
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
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
            console.log(`[Heartbeat] Terminating dead connection: ${ws.id}`);
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
    if (cleaned > 0) console.log(`[Sweep] Cleaned ${cleaned} stale client entries.`);
}, 60000);

// Cleanup Idle Rooms (Every 5 minutes)
setInterval(() => {
    console.log("Running cleanup task...");
    for (const [id, room] of rooms.entries()) {
        if (room.clients.size === 0) {
            console.log(`Unloading idle room: ${room.name} (${id})`);
            room.destroy(); // Stop the timer
            rooms.delete(id);
        }
    }
}, 5 * 60 * 1000);

// Cleanup Old Room History, expired sessions, and stale API caches (Once a day)
setInterval(() => {
    console.log("Running daily cleanup task...");
    try { db.cleanupRoomHistory(); } catch (e) { console.error("Failed to cleanup room history", e); }
    try { db.cleanupExpiredSessions(); } catch (e) { console.error("Failed to cleanup expired sessions", e); }
    try { db.cleanupStaleVideoMetadata(); } catch (e) { console.error("Failed to cleanup stale video metadata", e); }
    try { db.cleanupSearchCache(); } catch (e) { console.error("Failed to cleanup search cache", e); }
    try { db.cleanupRelatedVideosCache(); } catch (e) { console.error("Failed to cleanup related videos cache", e); }
    try { db.cleanupEmptyRooms(); } catch (e) { console.error("Failed to cleanup empty rooms", e); }
}, 24 * 60 * 60 * 1000);

// Run all cleanups once on startup as well
try { db.cleanupRoomHistory(); } catch (e) { console.error("Failed to cleanup room history on startup", e); }
try { db.cleanupExpiredSessions(); } catch (e) { console.error("Failed to cleanup expired sessions on startup", e); }
try { db.cleanupStaleVideoMetadata(); } catch (e) { console.error("Failed to cleanup stale video metadata on startup", e); }
try { db.cleanupSearchCache(); } catch (e) { console.error("Failed to cleanup search cache on startup", e); }
try { db.cleanupRelatedVideosCache(); } catch (e) { console.error("Failed to cleanup related videos cache on startup", e); }
try { db.cleanupEmptyRooms(); } catch (e) { console.error("Failed to cleanup empty rooms on startup", e); }

function gracefulShutdown(signal) {
    console.log(`[Shutdown] ${signal} received. Closing ${wss.clients.size} connections...`);
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
    wss.close(() => {
        server.close(() => {
            console.log('[Shutdown] Server closed.');
            process.exit(0);
        });
    });
    setTimeout(() => process.exit(0), 3000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
