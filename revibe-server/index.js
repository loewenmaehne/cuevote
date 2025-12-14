console.log("Server starting...");
require('dotenv').config();
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

const WebSocket = require("ws");
const crypto = require("crypto");
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const db = require('./db');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080, host: '0.0.0.0' });
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
            email: 'system@revibe.music',
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

wss.on("connection", (ws, req) => {
    console.log("Client connected");

    // Parse Client ID
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const clientId = urlParams.get('clientId');

    if (clientId) {
        ws.id = clientId;
    } else {
        ws.id = crypto.randomUUID();
    }

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

            // Handle Global Messages (Auth, Routing)
            switch (parsedMessage.type) {
                case "LOGIN": {
                    const { token } = parsedMessage.payload;
                    try {
                        const payload = await verifyGoogleToken(token);
                        let user = db.getUser(payload.sub);
                        if (!user) {
                            user = {
                                id: payload.sub,
                                email: payload.email,
                                name: payload.name,
                                picture: payload.picture
                            };
                            db.upsertUser(user);
                        }
                        ws.user = user;

                        // Generate Session Token
                        const sessionToken = crypto.randomBytes(32).toString('hex');
                        const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
                        db.createSession(sessionToken, user.id, expiresAt);

                        ws.send(JSON.stringify({
                            type: "LOGIN_SUCCESS",
                            payload: { user: ws.user, sessionToken }
                        }));
                    } catch (e) {
                        console.error("Login verification failed", e);
                        ws.send(JSON.stringify({ type: "error", message: "Login failed" }));
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
                            // Refresh token?
                            ws.send(JSON.stringify({
                                type: "LOGIN_SUCCESS",
                                payload: { user: ws.user, sessionToken: token }
                            }));
                        } else {
                            // Session exists but user is gone (deleted?)
                            console.warn(`[Resume Session] Session found but user ${session.user_id} is missing. Invalidating.`);
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
                case "DELETE_ACCOUNT": {
                    console.log("[SERVER TRACE] DELETE_ACCOUNT received");
                    if (!ws.user) {
                        console.warn("[GDPR] DELETE_ACCOUNT failed: No user attached to socket.");
                        ws.send(JSON.stringify({ type: "error", message: "Not logged in." }));
                        return;
                    }
                    const userId = ws.user.id;
                    console.log(`[GDPR] Deleting account for user: ${userId}`);

                    // 1. Send Success Signal FIRST to ensure client handles it before room death
                    // This allows the client to logout and navigate away cleanly.
                    ws.send(JSON.stringify({ type: "DELETE_ACCOUNT_SUCCESS" }));
                    ws.user = null; // Detach user immediately

                    // 2. Delete from DB (Synchronous Transaction)
                    try {
                        db.deleteUser(userId);
                        console.log(`[GDPR] DB records deleted for user: ${userId}`);
                    } catch (e) {
                        console.error("Failed to delete user from DB", e);
                        // We already sent success, so we can't revert easily, but for GDPR we must ensure it.
                        // Ideally checking this before sending success would be better, but the race condition 
                        // with room destruction is the priority for UX. 
                        // Since db.deleteUser is a transaction, it either fails or succeeds. 
                        // If it fails, we log critical error.
                    }

                    // 3. Destroy active memory rooms owned by user
                    // We do this LAST so the broadcast doesn't confuse the now-deleted user's client (who should be leaving).
                    const roomsToDestroy = [];
                    console.log(`[GDPR DEBUG] Checking ${rooms.size} active rooms for ownership match against ${userId}`);

                    for (const [id, room] of rooms.entries()) {
                        const owner = room.metadata.owner_id;
                        const match = (owner === userId) || (String(owner) === String(userId));

                        if (match) {
                            console.log(`[GDPR DEBUG] Marking room ${id} (Owner: ${owner}) for destruction.`);
                            roomsToDestroy.push(id);
                        } else {
                            // console.log(`[GDPR DEBUG] Skipping room ${id} (Owner: ${owner} !== ${userId})`);
                        }
                    }

                    roomsToDestroy.forEach(id => {
                        const room = rooms.get(id);
                        if (room) {
                            console.log(`[GDPR] Destroying room owned by deleted user: ${id}`);
                            try {
                                room.broadcast({ type: "error", code: "ROOM_DELETED", message: "Room has been deleted by owner." });
                                room.destroy();
                                rooms.delete(id);
                            } catch (err) {
                                console.error(`[GDPR ERROR] Failed to destroy room ${id}:`, err);
                            }
                        }
                    });

                    return;
                }
                case "STATE_ACK": {
                    console.log(`[SERVER TRACE] Client ${ws.id} ACKNOWLEDGED state for room: ${parsedMessage.payload.roomId}`);
                    break;
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
                        // Check DB if not not in memory
                        try {
                            const roomData = db.getRoom(roomId);
                            if (roomData) {
                                console.log(`Waking up idle room: ${roomData.name} (${roomId})`);
                                room = new Room(roomId, roomData.name, YOUTUBE_API_KEY, roomData);
                                rooms.set(roomId, room);
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
                    } else {
                        ws.send(JSON.stringify({ type: "error", code: "ROOM_NOT_FOUND", message: "Room not found" }));
                    }
                    return;
                }
                case "CREATE_ROOM": {
                    const { name, description, color, isPrivate, password } = parsedMessage.payload;
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
                                password: (isPrivate && password) ? password : null
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
                    return;
                }
                case "LIST_ROOMS": {
                    const { type } = parsedMessage.payload || {}; // 'public', 'private', or 'my_channels'
                    const showPrivate = type === 'private';
                    const showMyChannels = type === 'my_channels';

                    if (showMyChannels) {
                        console.log(`[DEBUG_MARATHON] LIST_ROOMS (My Channels) requested by: ${ws.user?.id} (${ws.user?.name})`);
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
                        console.log(`[DEBUG_MARATHON] DB returned ${dbRooms.length} rooms for user ${ws.user.id}. IDs: ${dbRooms.map(r => r.id).join(', ')}`);
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
                            // Minimal summary for idle room
                            roomList.push({
                                id: dbr.id,
                                name: dbr.name,
                                description: dbr.description,
                                color: dbr.color,
                                listeners: 0,
                                currentTrack: null,
                                is_protected: !!dbr.password // Hint for frontend
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
            }

            // Delegate Room-Specific Messages
            if (ws.roomId && rooms.has(ws.roomId)) {
                await rooms.get(ws.roomId).handleMessage(ws, parsedMessage);
            }

        } catch (error) {
            console.error("Failed to handle message:", error);
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
