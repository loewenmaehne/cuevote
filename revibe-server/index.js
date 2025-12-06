console.log("Server starting...");
require('dotenv').config();
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

const WebSocket = require("ws");
const crypto = require("crypto");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Helper to parse ISO 8601 duration (PT1H2M10S) into seconds
function parseISO8601Duration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;
  const hours = (parseInt(match[1]) || 0);
  const minutes = (parseInt(match[2]) || 0);
  const seconds = (parseInt(match[3]) || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

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

console.log("WebSocket server started on port", process.env.PORT || 8080);

wss.on("connection", (ws, req) => {
  console.log("Client connected");
  
  // Parse Client ID from URL query params
  const urlParams = new URLSearchParams(req.url.split('?')[1]);
  const clientId = urlParams.get('clientId');

  if (clientId) {
    ws.id = clientId;
    console.log(`Resumed session for client: ${ws.id}`);
  } else {
    ws.id = crypto.randomUUID();
    console.log(`New client assigned ID: ${ws.id}`);
  }

  clients.add(ws);

  // Send the current state to the newly connected client
  try {
    ws.send(JSON.stringify({ type: "state", payload: store.getState() }));
  } catch (error) {
    console.error("Failed to send initial state to client:", error);
  }

  ws.on("message", async (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      console.log("Received message:", parsedMessage);
      const state = store.getState();

      switch (parsedMessage.type) {
        case "SUGGEST_SONG": {
          const track = parsedMessage.payload;
          
          // 1. Verify with YouTube Data API if API Key is present
          if (YOUTUBE_API_KEY) {
            try {
                const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${track.videoId}&part=contentDetails,snippet&key=${YOUTUBE_API_KEY}`;
                const response = await fetch(apiUrl);
                const data = await response.json();

                if (data.items && data.items.length > 0) {
                    const videoData = data.items[0];
                    
                    // Check for Livestream
                    const broadcastContent = videoData.snippet.liveBroadcastContent;
                    if (broadcastContent === 'live') {
                        console.log(`Blocked Livestream suggestion: ${track.videoId}`);
                        ws.send(JSON.stringify({ type: "error", message: "Livestreams are not allowed." }));
                        return; // Stop execution
                    }

                    // Use official duration
                    const durationInSeconds = parseISO8601Duration(videoData.contentDetails.duration);
                    if (durationInSeconds === 0 && broadcastContent !== 'none') {
                         // Sometimes liveBroadcastContent is 'upcoming' or 'none' but duration is 0 for streams
                         console.log(`Blocked 0-duration video (likely stream): ${track.videoId}`);
                         ws.send(JSON.stringify({ type: "error", message: "Livestreams are not allowed." }));
                         return;
                    }

                    track.duration = durationInSeconds;
                    // Optional: Overwrite title/artist with official data for consistency
                    // track.title = videoData.snippet.title;
                }
            } catch (apiError) {
                console.error("YouTube API Check failed:", apiError);
                // Decide: Fail open (allow) or closed (block)?
                // Currently failing open to keep app usable if API fails
            }
          }

          // Initialize Voting Data
          track.score = 0;
          track.voters = {}; // userId -> 'up' | 'down'

          const newQueue = [...state.queue, track];
          const newState = { queue: newQueue };
          if (newQueue.length === 1) {
            newState.currentTrack = newQueue[0];
            newState.isPlaying = true;
            newState.progress = 0;
          }
          store.updateState(newState);
          break;
        }
        case "VOTE": {
          const { trackId, voteType } = parsedMessage.payload;
          const queue = [...state.queue];
          const trackIndex = queue.findIndex((t) => t.id === trackId);

          if (trackIndex !== -1) {
            const track = { ...queue[trackIndex] };
            const previousVote = track.voters[ws.id];

            // Calculate Score Change
            let scoreChange = 0;
            
            if (previousVote === voteType) {
              // Toggle OFF (Remove vote)
              scoreChange = voteType === 'up' ? -1 : 1;
              delete track.voters[ws.id];
            } else {
              // New Vote or Swap
              if (voteType === 'up') {
                scoreChange = previousVote === 'down' ? 2 : 1;
              } else {
                scoreChange = previousVote === 'up' ? -2 : -1;
              }
              track.voters[ws.id] = voteType;
            }

            track.score = (track.score || 0) + scoreChange;
            queue[trackIndex] = track;

            // Re-sort Queue: Score Descending, then Time Added (FIFO)
            queue.sort((a, b) => {
                const scoreDiff = b.score - a.score;
                return scoreDiff !== 0 ? scoreDiff : 0; // Keep original order if scores tied
            });

            store.updateState({ queue });
          }
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
        case "UPDATE_DURATION":
          if (state.currentTrack) {
            store.updateState({
              currentTrack: { ...state.currentTrack, duration: parsedMessage.payload },
            });
          }
          break;
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
    const duration = state.currentTrack.duration || 200;
    if (newProgress > duration) {
      console.log("Track finished, auto-advancing to next track");
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
