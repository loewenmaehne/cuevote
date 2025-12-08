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
