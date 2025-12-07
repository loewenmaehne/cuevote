const crypto = require("crypto");

// Helper to parse ISO 8601 duration (PT1H2M10S) into seconds
function parseISO8601Duration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;
  const hours = (parseInt(match[1]) || 0);
  const minutes = (parseInt(match[2]) || 0);
  const seconds = (parseInt(match[3]) || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

class Room {
    constructor(id, name, apiKey, metadata = {}) {
        this.id = id;
        this.name = name;
        this.apiKey = apiKey;
        this.metadata = {
            description: metadata.description || "",
            color: metadata.color || "from-gray-700 to-black",
            owner_id: metadata.owner_id,
            is_public: metadata.is_public !== undefined ? metadata.is_public : 1
        };
        this.clients = new Set();
        
        this.state = {
            queue: [],
            currentTrack: null,
            isPlaying: false,
            progress: 0,
            activeChannel: name,
        };

        // Start the Room Timer
        this.interval = setInterval(() => this.tick(), 1000);
    }

    getSummary() {
        return {
            id: this.id,
            name: this.name,
            description: this.metadata.description,
            color: this.metadata.color,
            listeners: this.clients.size,
            currentTrack: this.state.currentTrack
        };
    }

    addClient(ws) {
        console.log(`Adding client to room ${this.name}. Clients: ${this.clients.size + 1}`);
        this.clients.add(ws);
        ws.send(JSON.stringify({ type: "state", payload: this.state }));
    }

    removeClient(ws) {
        this.clients.delete(ws);
    }

    broadcastState() {
        const message = JSON.stringify({ type: "state", payload: this.state });
        for (const client of this.clients) {
            if (client.readyState === 1) { // OPEN
                client.send(message);
            }
        }
    }

    updateState(newState) {
        this.state = { ...this.state, ...newState };
        this.broadcastState();
    }

    tick() {
        if (this.state.isPlaying && this.state.currentTrack) {
            const newProgress = this.state.progress + 1;
            const duration = this.state.currentTrack.duration || 200;
            
            if (newProgress > duration) {
                // Auto-Advance
                const newQueue = [...this.state.queue];
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
                this.updateState(newState);
            } else {
                this.updateState({ progress: newProgress });
            }
        }
    }

    async handleMessage(ws, message) {
        switch (message.type) {
            case "SUGGEST_SONG":
                await this.handleSuggestSong(ws, message.payload);
                break;
            case "VOTE":
                this.handleVote(ws, message.payload);
                break;
            case "PLAY_PAUSE":
                // Simple toggle for now (permission check later)
                this.updateState({ isPlaying: message.payload });
                break;
            case "NEXT_TRACK":
                this.handleNextTrack();
                break;
            case "UPDATE_DURATION":
                if (this.state.currentTrack) {
                    this.updateState({
                        currentTrack: { ...this.state.currentTrack, duration: message.payload },
                    });
                }
                break;
        }
    }

    async handleSuggestSong(ws, payload) {
        const { query, userId } = payload;
        let videoId = null;

        // 1. Resolve Video ID (URL or Search)
        const urlMatch = query.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        if (urlMatch) {
            videoId = urlMatch[1];
        } else if (this.apiKey) {
            // Search via API
            try {
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${this.apiKey}`;
                const searchRes = await fetch(searchUrl);
                const searchData = await searchRes.json();
                if (searchData.items && searchData.items.length > 0) {
                    videoId = searchData.items[0].id.videoId;
                }
            } catch (err) {
                console.error("Search failed:", err);
            }
        }

        if (!videoId) {
            ws.send(JSON.stringify({ type: "error", message: "Could not find video." }));
            return;
        }
        
        // 2. Fetch Details & Validate
        let track = null;
        if (this.apiKey) {
            try {
                const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails,snippet&key=${this.apiKey}`;
                const response = await fetch(apiUrl);
                const data = await response.json();

                if (data.items && data.items.length > 0) {
                    const videoData = data.items[0];
                    
                    const broadcastContent = videoData.snippet.liveBroadcastContent;
                    if (broadcastContent === 'live') {
                        ws.send(JSON.stringify({ type: "error", message: "Livestreams are not allowed." }));
                        return;
                    }

                    const durationInSeconds = parseISO8601Duration(videoData.contentDetails.duration);
                    if (durationInSeconds === 0 && broadcastContent !== 'none') {
                        ws.send(JSON.stringify({ type: "error", message: "Livestreams are not allowed." }));
                        return;
                    }

                    track = {
                        id: crypto.randomUUID(),
                        videoId: videoId,
                        title: videoData.snippet.title,
                        artist: videoData.snippet.channelTitle,
                        thumbnail: videoData.snippet.thumbnails.high?.url || videoData.snippet.thumbnails.default?.url,
                        duration: durationInSeconds,
                        score: 0,
                        voters: {},
                        suggestedBy: userId
                    };
                }
            } catch (apiError) {
                console.error("YouTube API Check failed:", apiError);
            }
        }

        // Fallback
        if (!track && videoId) {
            // If we rely on API key, we reject here. For now, fail safe reject or mocked track?
            // Let's reject to be safe/consistent with previous logic
            ws.send(JSON.stringify({ type: "error", message: "Server could not verify video details." }));
            return;
        }

        if (track) {
            const newQueue = [...this.state.queue, track];
            const newState = { queue: newQueue };
            if (newQueue.length === 1) {
                newState.currentTrack = newQueue[0];
                newState.isPlaying = true;
                newState.progress = 0;
            }
            this.updateState(newState);
        }
    }

    handleVote(ws, { trackId, voteType }) {
        const queue = [...this.state.queue];
        const trackIndex = queue.findIndex((t) => t.id === trackId);

        if (trackIndex !== -1) {
            const track = { ...queue[trackIndex] };
            const previousVote = track.voters[ws.id];

            let scoreChange = 0;
            if (previousVote === voteType) {
                scoreChange = voteType === 'up' ? -1 : 1;
                delete track.voters[ws.id];
            } else {
                if (voteType === 'up') {
                    scoreChange = previousVote === 'down' ? 2 : 1;
                } else {
                    scoreChange = previousVote === 'up' ? -2 : -1;
                }
                track.voters[ws.id] = voteType;
            }

            track.score = (track.score || 0) + scoreChange;
            queue[trackIndex] = track;

            // Exclude current track (index 0) from sorting?
            // If trackIndex is 0 (Current Track), we don't want to move it.
            // But if it's in the queue, we DO sort.
            // Fix: Only sort queue.slice(1).
            
            const current = queue[0];
            const upcoming = queue.slice(1);
            
            upcoming.sort((a, b) => {
                const scoreDiff = b.score - a.score;
                return scoreDiff !== 0 ? scoreDiff : 0; 
            });
            
            // Reassemble
            const newQueue = [current, ...upcoming];
            this.updateState({ queue: newQueue });
        }
    }

    handleNextTrack() {
        const newQueue = [...this.state.queue];
        newQueue.shift();
        const newCurrentTrack = newQueue[0] || null;
        const newState = {
            queue: newQueue,
            currentTrack: newCurrentTrack,
            progress: 0,
            isPlaying: true,
        };
        if (!newCurrentTrack) {
            newState.isPlaying = false;
        }
        this.updateState(newState);
    }
    
    destroy() {
        clearInterval(this.interval);
    }
}

module.exports = Room;
