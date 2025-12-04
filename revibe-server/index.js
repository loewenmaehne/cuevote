console.log("Server starting...");
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

const store = (() => {
  let state = {
    queue: [],
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    activeChannel: "Synthwave",
  };

  return {
    getState: () => state,
    updateState: (newState) => {
      console.log("Updating state:", newState);
      state = { ...state, ...newState };
      broadcastState();
    },
  };
})();

const clients = new Set();

console.log("WebSocket server started on port 8080");

wss.on("connection", (ws) => {
  console.log("Client connected");
  clients.add(ws);

  // Send the current state to the newly connected client
  try {
    ws.send(JSON.stringify({ type: "state", payload: store.getState() }));
  } catch (error) {
    console.error("Failed to send initial state to client:", error);
  }

  ws.on("message", (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      console.log("Received message:", parsedMessage);
      const state = store.getState();

      switch (parsedMessage.type) {
        case "SUGGEST_SONG": {
          const newQueue = [...state.queue, parsedMessage.payload];
          const newState = { queue: newQueue };
          if (newQueue.length === 1) {
            newState.currentTrack = newQueue[0];
            newState.isPlaying = true;
            newState.progress = 0;
          }
          store.updateState(newState);
          break;
        }
        case "PLAY_PAUSE":
          store.updateState({ isPlaying: parsedMessage.payload });
          break;
        case "NEXT_TRACK": {
          const newQueue = [...state.queue];
          newQueue.shift();
          const newCurrentTrack = newQueue[0] || null;
          const newState = {
            queue: newQueue,
            currentTrack: newCurrentTrack,
            progress: 0,
            isPlaying: true, // Explicitly set isPlaying to true for the next song
          };
          if (!newCurrentTrack) {
            newState.isPlaying = false;
          }
          store.updateState(newState);
          break;
        }
        default:
          console.log("Unknown message type:", parsedMessage.type);
      }
    } catch (error) {
      console.error("Failed to parse message or update state:", error);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    clients.delete(ws);
  });
});

function broadcastState() {
  const state = store.getState();
  const message = JSON.stringify({ type: "state", payload: state });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

setInterval(() => {
  const state = store.getState();
  if (state.isPlaying && state.currentTrack) {
    const newProgress = state.progress + 1;
    const duration = 200; // dummy duration
    if (newProgress > duration) {
      const newQueue = [...state.queue];
      newQueue.shift();
      const newCurrentTrack = newQueue[0] || null;
      const newState = {
        queue: newQueue,
        currentTrack: newCurrentTrack,
        progress: 0,
      };
      if (!newCurrentTrack) {
        newState.isPlaying = false;
      }
      store.updateState(newState);
    } else {
        store.updateState({ progress: newProgress });
    }
  }
}, 1000);
