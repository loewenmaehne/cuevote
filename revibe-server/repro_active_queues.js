const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

let activeRoom = null;
let switchCount = 0;
let synthwaveAdded = false;
let popAdded = false;

ws.on('open', function open() {
	console.log('Connected');
	ws.send(JSON.stringify({ type: 'DEBUG_LOGIN' }));
});

ws.on('message', function message(data) {
	const msg = JSON.parse(data);
	// console.log('Received:', msg.type);

	if (msg.type === 'LOGIN_SUCCESS') {
		console.log('Logged in. Joining Synthwave...');
		activeRoom = 'synthwave';
		ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId: 'synthwave' } }));
	}

	if (msg.type === 'state') {
		const { roomId, queue } = msg.payload;
		console.log(`[SCRIPT] Received State. Room: ${roomId}, Queue: ${queue.length}`);

		// 1. Add to Synthwave
		if (roomId === 'synthwave' && !synthwaveAdded) {
			console.log('Suggesting lofi to Synthwave...');
			ws.send(JSON.stringify({ type: 'SUGGEST_SONG', payload: { query: 'lofi' } }));
			synthwaveAdded = true;
		}
		// 2. Wait for Synthwave Song -> Switch to Pop
		else if (roomId === 'synthwave' && synthwaveAdded && queue.length > 0 && !popAdded) {
			console.log('Synthwave has song. Waiting 5s then Switching to Pop...');
			setTimeout(() => {
				activeRoom = 'pop';
				ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId: 'pop' } }));
			}, 5000);
		}
		// 3. Add to Pop
		else if (roomId === 'pop' && !popAdded) {
			console.log('Suggesting pop to Pop...');
			ws.send(JSON.stringify({ type: 'SUGGEST_SONG', payload: { query: 'pop' } }));
			popAdded = true;
		}
		// 4. Wait for Pop Song -> Switch Back
		else if (roomId === 'pop' && popAdded && queue.length > 0 && switchCount === 0) {
			console.log(`Pop has song. Switching back to Synthwave (Cycle 1)...`);
			activeRoom = 'synthwave';
			ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId: 'synthwave' } }));
			switchCount++;
		}
		// 5. Cycle Back and Forth
		else if (activeRoom === 'synthwave' && roomId === 'synthwave' && popAdded && switchCount > 0 && switchCount < 10) {
			console.log(`Back in Synthwave. Switching to Pop (Cycle ${switchCount})...`);
			activeRoom = 'pop';
			ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId: 'pop' } }));
			switchCount++;
		}
		else if (activeRoom === 'pop' && roomId === 'pop' && popAdded && switchCount > 0 && switchCount < 10) {
			console.log(`Back in Pop. Switching to Synthwave (Cycle ${switchCount})...`);
			activeRoom = 'synthwave';
			ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId: 'synthwave' } }));
			switchCount++;
		}
	}

	if (msg.type === 'error') {
		console.error('[SCRIPT] Error:', msg.message);
	}
});

ws.on('error', function error(err) {
	console.error('Error:', err);
});
