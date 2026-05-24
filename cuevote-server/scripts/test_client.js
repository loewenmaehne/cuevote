// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
if (process.env.NODE_ENV === 'production') {
	console.error('Refusing to run dev script in production.');
	process.exit(1);
}

const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', function open() {
	console.log('Connected');
	ws.send(JSON.stringify({ type: 'LIST_ROOMS' }));
});

ws.on('message', function message(data) {
	console.log('received: %s', data);
	ws.close();
});

ws.on('error', function error(err) {
	console.error('Error:', err);
});
