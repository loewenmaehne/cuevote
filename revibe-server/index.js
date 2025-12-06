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

// Initialize Default Rooms
const defaultRooms = [
    "Synthwave", 
    "Lofi", 
    "Pop", 
    "The Super Long Synthwave Station for Testing Marquee Effect"
];

defaultRooms.forEach(name => {
    const id = name.toLowerCase().replace(/\s+/g, '-');
    rooms.set(id, new Room(id, name, YOUTUBE_API_KEY));
    console.log(`Created room: ${name} (${id})`);
});

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
            } else {
                ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
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
