
const WebSocket = require('ws');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(__dirname, 'revibe.db');
const db = new Database(dbPath);

const TEST_USER_ID = 'test-security-user';
const TEST_TOKEN = 'test-security-token';

try {
	db.prepare('INSERT OR REPLACE INTO users (id, email, name) VALUES (?, ?, ?)').run(TEST_USER_ID, 'test@security.com', 'Test User');
	const expiresAt = Math.floor(Date.now() / 1000) + 3600;
	db.prepare('INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(TEST_TOKEN, TEST_USER_ID, expiresAt);
} catch (e) {
	console.error("Failed to seed DB:", e);
	process.exit(1);
}

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', async () => {
	console.log('Connected to server.');
	console.log('\n[Test 1] Anonymous Voting (Expect Fail)...');
	ws.send(JSON.stringify({ type: 'VOTE', payload: { trackId: 'fake', voteType: 'up' } }));

	console.log('[Test 2] Anonymous Suggestion (Expect Fail)...');
	ws.send(JSON.stringify({ type: 'SUGGEST_SONG', payload: { query: 'Rick' } }));

	console.log('[Setup] Logging in...');
	ws.send(JSON.stringify({ type: 'RESUME_SESSION', payload: { token: TEST_TOKEN } }));
});

ws.on('message', (data) => {
	const msg = JSON.parse(data);

	if (msg.type === 'error') {
		if (msg.message.includes('logged in')) console.log('✅ Auth check passed.');
		else if (msg.message.includes('wait before suggesting')) console.log('✅ Rate limit check passed.');
	}

	if (msg.type === 'LOGIN_SUCCESS') {
		console.log('✅ Logged in.');

		// Test 3: Rate Limit
		console.log('\n[Test 3] Rate Limiting...');
		ws.send(JSON.stringify({ type: 'SUGGEST_SONG', payload: { query: 'Test 1' } }));
		setTimeout(() => {
			ws.send(JSON.stringify({ type: 'SUGGEST_SONG', payload: { query: 'Test 2' } }));
		}, 100);

		// Test 4: Access Control (after short delay)
		setTimeout(() => {
			console.log('\n[Test 4] Access Control (Griefing)...');

			// Monitor for State Changes JUST for this test
			const failListener = (data) => {
				const m = JSON.parse(data);
				if (m.type === 'state' && m.payload.isPlaying !== undefined) {
					console.error('❌ Security Fail: Received isPlaying update!', m.payload);
				}
			};
			ws.on('message', failListener);

			ws.send(JSON.stringify({ type: 'PLAY_PAUSE', payload: true })); // Try to play

			// Cleanup listener after 1s
			setTimeout(() => {
				ws.removeListener('message', failListener);
			}, 1000);

		}, 500);
	}

	// Global listener only for Error/Login (removed state check)

});

setTimeout(() => {
	console.log('\nTests finished.');
	process.exit(0);
}, 3000);
