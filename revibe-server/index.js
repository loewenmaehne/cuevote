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

const defaultRooms = ["Synthwave", "Lofi", "Pop", "Hip Hop", "R&B", "Techno", "Trap", "House", "Indie"];

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

    // Ensure Default Rooms exist
    defaultRooms.forEach(name => {
        const id = name.toLowerCase().replace(/\s+/g, '-');
        if (!rooms.has(id)) {
            try {
                let existing = db.getRoom(id);
                if (!existing) {
                    existing = {
                        id,
                        name,
                        description: `Official ${name} Channel`,
                        owner_id: 'system',
                        color: 'from-gray-700 to-black',
                        is_public: 1
                    };
                    db.createRoom(existing);
                }
                rooms.set(id, new Room(id, name, YOUTUBE_API_KEY, existing));
                console.log(`Created System Room: ${name}`);
            } catch (err) {
                console.error(`Failed to init room ${name}:`, err);
            }
        }
    });
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
                        ws.user = user;
                        // Refresh token?
                        ws.send(JSON.stringify({
                            type: "LOGIN_SUCCESS",
                            payload: { user: ws.user, sessionToken: token }
                        }));
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
                case "STATE_ACK": {
                    console.log(`[SERVER TRACE] Client ${ws.id} ACKNOWLEDGED state for room: ${parsedMessage.payload.roomId}`);
                    break;
                }
                case "JOIN_ROOM": {
                    const { roomId } = parsedMessage.payload;
                    console.log(`[SERVER TRACE] Client ${ws.id} requesting to join room: ${roomId}`);

                    // Leave ALL rooms to ensure no duplicate subscriptions
                    for (const [id, room] of rooms.entries()) {
                        if (room.clients.has(ws)) {
                            console.log(`[SERVER TRACE] Client ${ws.id} leaving room (forced cleanup): ${id}`);
                            room.removeClient(ws);
                            if (room.clients.size === 0 && !defaultRooms.includes(id)) {
                                // console.log(`Room ${id} is empty and not default. Scheduling cleanup.`);
                            }
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
                    const { name, description, color } = parsedMessage.payload;
                    if (!ws.user) {
                        ws.send(JSON.stringify({ type: "error", message: "You must be logged in to create a room." }));
                        return;
                    }

                    if (name.length > 100) {
                        ws.send(JSON.stringify({ type: "error", message: "Channel name must be 100 characters or less." }));
                        return;
                    }

                    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + crypto.randomBytes(2).toString('hex');

                    try {
                        const roomData = {
                            id,
                            name,
                            description: description || "Community Station",
                            owner_id: ws.user.id,
                            color: color || "from-gray-700 to-black",
                            is_public: 1
                        };

                        db.createRoom(roomData);
                        rooms.set(id, new Room(id, name, YOUTUBE_API_KEY, roomData));

                        ws.send(JSON.stringify({ type: "ROOM_CREATED", payload: roomData }));
                    } catch (err) {
                        console.error("Create Room Error:", err);
                        ws.send(JSON.stringify({ type: "error", message: "Failed to create room." }));
                    }
                    return;
                }
                case "LIST_ROOMS": {
                    const roomList = [];
                    for (const room of rooms.values()) {
                        if (room.metadata.is_public) {
                            roomList.push(room.getSummary());
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
            // Prevent deleting default rooms
            const defaultRooms = ["synthwave", "lofi", "pop", "hip-hop", "r-b", "techno", "trap", "house", "indie"];
            if (defaultRooms.includes(id)) {
                continue;
            }
            console.log(`Unloading idle room: ${room.name} (${id})`);
            room.destroy(); // Stop the timer
            rooms.delete(id);
        }
    }
}, 5 * 60 * 1000);
