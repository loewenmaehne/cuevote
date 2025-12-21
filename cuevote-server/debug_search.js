const WebSocket = require('ws');
const db = require('./db');
const crypto = require('crypto');
const fs = require('fs');

function log(msg, ...args) {
	const formatted = [msg, ...args].map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ');
	// fs.appendFileSync('client_debug.log', `[${new Date().toISOString()}] ${formatted}\n`);
	console.log(formatted);
}

// 1. Setup Session
const debugToken = 'debug-session-' + crypto.randomBytes(4).toString('hex');
const userId = 'system';
const expiresAt = Math.floor(Date.now() / 1000) + 3600;

console.log(`Creating debug session for user '${userId}' with token '${debugToken}'`);
try {
	db.upsertUser({
		id: userId,
		email: 'system@cuevote.com',
		name: 'System Debugger',
		picture: ''
	});
	db.createSession(debugToken, userId, expiresAt);
} catch (e) {
	console.error("DB Setup Failed:", e);
	process.exit(1);
}

const ws = new WebSocket('ws://localhost:8080');
const roomId = 'debug-room-search';

ws.on('open', function open() {
	console.log('Connected to server');
	ws.send(JSON.stringify({ type: 'RESUME_SESSION', payload: { token: debugToken } }));
});

ws.on('message', function message(data) {
	const msg = JSON.parse(data);

	if (msg.type === 'LOGIN_SUCCESS') {
		console.log('Login Successful. Creating Room...');
		ws.send(JSON.stringify({
			type: 'CREATE_ROOM',
			payload: { name: roomId, description: 'Debug Room', color: 'blue', isPrivate: false }
		}));
	}
	else if (msg.type === 'ROOM_CREATED') {
		console.log('Room Created. Joining...');
		const targetRoomId = msg.payload.id;
		ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId: targetRoomId } }));
	}
	else if (msg.type === 'state') {
		console.log('Joined Room. Sending SEARCH Query...');
		const query = "rick roll"; // Should trigger API Search
		ws.send(JSON.stringify({ type: 'SUGGEST_SONG', payload: { query } }));
	}
	else if (msg.type === 'error') {
		console.error('SERVER ERROR:', msg.message);
		// If we see "Only music videos" it means success (search worked, details worked)
		if (msg.message === 'Only music videos are allowed in this channel.') {
			console.log(">>> SUCCESS: Search and Fetch worked! <<<");
			ws.close(); process.exit(0);
		}
		ws.close(); process.exit(1);
	}
	else if (msg.type === 'info' && msg.message === 'Submitted') {
		console.log(">>> SUCCESS: Search Submitted! <<<");
		ws.close(); process.exit(0);
	}
});
