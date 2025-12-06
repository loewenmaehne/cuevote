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

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; 

const Room = require('./Room');

// Room Manager
const rooms = new Map();

// Initialize Rooms from DB
function loadRooms() {
    const publicRooms = db.listPublicRooms();
    publicRooms.forEach(roomData => {
        if (!rooms.has(roomData.id)) {
            rooms.set(roomData.id, new Room(roomData.id, roomData.name, YOUTUBE_API_KEY));
            console.log(`Loaded room: ${roomData.name} (${roomData.id})`);
        }
    });

    // Ensure Default Rooms exist
    const defaultRooms = ["Synthwave", "Lofi", "Pop", "Hip Hop", "R&B", "Techno", "Trap", "House", "Indie"];
    defaultRooms.forEach(name => {
        const id = name.toLowerCase().replace(/\s+/g, '-');
        if (!rooms.has(id)) {
            // Check if it exists in DB but fell out of cache?
            // Ideally, we upsert them into DB as 'system' owned.
            // For simplicity, we just create them in memory if missing, and maybe persist them later.
            // Let's insert them into DB if missing so they appear in the listPublicRooms query next time.
            try {
                const existing = db.getRoom(id);
                if (!existing) {
                    db.createRoom({
                        id, 
                        name, 
                        description: `Official ${name} Channel`, 
                        owner_id: 'system', 
                        color: 'from-gray-700 to-black' // Default color, lobby handles specifics
                    });
                }
                rooms.set(id, new Room(id, name, YOUTUBE_API_KEY));
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
  // For now, we put them in "synthwave" to maintain existing behavior until Client Routing is ready
  const defaultRoomId = "synthwave";
  const room = rooms.get(defaultRoomId);
  if (room) {
      ws.roomId = defaultRoomId;
      room.addClient(ws);
  }

  ws.on("message", async (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      
      // Handle Global Messages (Auth, Routing)
      switch (parsedMessage.type) {
        case "LOGIN": {
            const { token } = parsedMessage.payload;
            try {
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                
                if (!userInfoResponse.ok) throw new Error("Invalid Google Token");
                const userData = await userInfoResponse.json();
                
                const user = db.upsertUser({
                    id: userData.sub,
                    email: userData.email,
                    name: userData.name,
                    picture: userData.picture
                });

                const sessionToken = crypto.randomUUID();
                const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
                db.createSession(sessionToken, user.id, expiresAt);

                ws.user = user;
                ws.send(JSON.stringify({ 
                    type: "LOGIN_SUCCESS", 
                    payload: { user, sessionToken } 
                }));
            } catch (err) {
                console.error("Login Error:", err);
                ws.send(JSON.stringify({ type: "error", message: "Login Failed" }));
            }
            return;
        }
        case "RESUME_SESSION": {
            const { token } = parsedMessage.payload;
            const session = db.getSession(token);
            if (session) {
                ws.user = {
                    id: session.user_id,
                    name: session.name,
                    email: session.email,
                    picture: session.picture,
                    role: session.role
                };
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
        case "JOIN_ROOM": {
            const { roomId } = parsedMessage.payload;
            // Leave current room
            if (ws.roomId && rooms.has(ws.roomId)) {
                rooms.get(ws.roomId).removeClient(ws);
            }
            // Join new room
            if (rooms.has(roomId)) {
                ws.roomId = roomId;
                rooms.get(roomId).addClient(ws);
                // Update activity timestamp in DB so it doesn't rot
                db.updateRoomActivity(roomId);
            } else {
                ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
            }
            return;
        }
        case "CREATE_ROOM": {
            const { name, description, color } = parsedMessage.payload;
            if (!ws.user) {
                ws.send(JSON.stringify({ type: "error", message: "You must be logged in to create a room." }));
                return;
            }
            
            const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + crypto.randomBytes(2).toString('hex');
            
            try {
                const roomData = {
                    id,
                    name,
                    description: description || "Community Station",
                    owner_id: ws.user.id,
                    color: color || "from-gray-700 to-black"
                };
                
                db.createRoom(roomData);
                rooms.set(id, new Room(id, name, YOUTUBE_API_KEY));
                
                ws.send(JSON.stringify({ type: "ROOM_CREATED", payload: roomData }));
            } catch (err) {
                console.error("Create Room Error:", err);
                ws.send(JSON.stringify({ type: "error", message: "Failed to create room." }));
            }
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
