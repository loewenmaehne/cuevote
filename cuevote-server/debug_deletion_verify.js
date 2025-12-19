const db = require('./db.js');
const crypto = require('crypto');

console.log("=== STARTING DB DEBUG MARATHON ===");

// 1. Setup Test Data
const testUser = {
	id: 'debug-marathon-user-' + Date.now(),
	email: 'debug-' + Date.now() + '@example.com',
	name: 'Debug User',
	picture: 'http://example.com/pic.jpg'
};

console.log("[STEP 1] Upserting User:", testUser.id);
try {
	const u = db.upsertUser(testUser);
	console.log("Upsert Result:", u);
} catch (e) {
	console.error("Upsert Failed:", e);
	process.exit(1);
}

// 2. Create Session
const sessionToken = 'session-' + Date.now();
console.log("[STEP 2] Creating Session:", sessionToken);
try {
	db.createSession(sessionToken, testUser.id, Math.floor(Date.now() / 1000) + 3600);
	const s = db.getSession(sessionToken);
	console.log("Session Verified:", !!s);
} catch (e) {
	console.error("Session Create Failed:", e);
}

// 3. Create Room (as Owner)
const roomId = 'room-' + Date.now();
console.log("[STEP 3] Creating Room:", roomId);
try {
	const room = {
		id: roomId,
		name: 'Debug Room',
		description: 'Test',
		owner_id: testUser.id, // THE KEY LINK
		color: 'red',
		is_public: 1,
		password: null
	};
	db.createRoom(room);
	const r = db.getRoom(roomId);
	console.log("Room Verified:", !!r, "Owner:", r ? r.owner_id : 'N/A');
} catch (e) {
	console.error("Room Create Failed:", e);
}

// 4. Verify Linkage
console.log("[STEP 4] Verifying Linkage before deletion...");
const userRooms = db.listUserRooms(testUser.id);
console.log(`User owns ${userRooms.length} rooms. (Expected 1)`);
if (userRooms.length !== 1) console.error("CRITICAL: Room linkage failed!");

// 5. Execute Delete
console.log("[STEP 5] EXECUTING deleteUser (The Function Under Test)...");
try {
	const result = db.deleteUser(testUser.id);
	console.log("DeleteUser Returned:", result);
} catch (e) {
	console.error("deleteUser THREW Error:", e);
}

// 6. Post-Mortem Verification
console.log("[STEP 6] Post-Mortem Check...");
const checkUser = db.getUser(testUser.id);
const checkSession = db.getSession(sessionToken);
const checkRoom = db.getRoom(roomId);
const checkByEmail = db.getUserByEmail(testUser.email);

console.log("User Exists?", !!checkUser);
console.log("Session Exists?", !!checkSession);
console.log("Room Exists?", !!checkRoom);
console.log("User (by Email) Exists?", !!checkByEmail);

if (!checkUser && !checkSession && !checkRoom && !checkByEmail) {
	console.log("\n=== SUCCESS: CLEAN DELETION CONFIRMED ===");
} else {
	console.error("\n=== FAILURE: ARTIFACTS REMAIN ===");
	if (checkUser) console.error(" - User record remains!");
	if (checkSession) console.error(" - Session record remains!");
	if (checkRoom) console.error(" - Room record remains! (This explains 'Channel stays')");
	if (checkByEmail) console.error(" - User email record remains! (This explains 'Cannot login')");
}
