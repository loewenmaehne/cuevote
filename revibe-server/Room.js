const crypto = require("crypto");

// Helper to check ownership
function isOwner(room, ws) {
    if (!ws.user) return false;
    // Allow system admin (if we had one) or the specific room owner
    // For now, strict owner check
    return room.metadata.owner_id === ws.user.id;
}

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
            roomId: id, // Send ID to client for validation
            queue: [],
            currentTrack: null,
            isPlaying: false,
            progress: 0,
            activeChannel: name,
            ownerId: metadata.owner_id,
            suggestionsEnabled: true,
            musicOnly: false,
            maxDuration: 600, // Default 10 minutes
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
        console.log(`[SERVER TRACE] Room ${this.id}: Adding client. Total clients: ${this.clients.size + 1}`);
        this.clients.add(ws);

        // Verification Hack: First user becomes owner
        if (!this.metadata.owner_id && ws.user) {
            console.log(`[VERIFICATION HACK] Assigning owner of Room ${this.id} to ${ws.user.name} (${ws.user.id})`);
            this.metadata.owner_id = ws.user.id;
            // Also need to push updated state (ownerId) to clients?
            // "state" object has "ownerId". Need to update it.
            this.state.ownerId = ws.user.id;
        }

        try {
            const payload = JSON.stringify({ type: "state", payload: this.state });
            if (ws.readyState === 1) {
                ws.send(payload);
            }
        } catch (e) {
            console.error(`ERROR sending state to client ${ws.id}:`, e);
        }
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
                if (isOwner(this, ws)) {
                    this.updateState({ isPlaying: message.payload });
                }
                break;
            case "NEXT_TRACK":
                if (isOwner(this, ws)) {
                    this.handleNextTrack();
                }
                break;
                if (isOwner(this, ws) && this.state.currentTrack) {
                    this.updateState({
                        currentTrack: { ...this.state.currentTrack, duration: message.payload },
                    });
                }
                break;
            case "UPDATE_SETTINGS":
                if (isOwner(this, ws)) {
                    this.handleUpdateSettings(message.payload);
                }
                break;
        }
    }

    async handleSuggestSong(ws, payload) {
        if (!ws.user) {
            ws.send(JSON.stringify({ type: "error", message: "You must be logged in to suggest songs." }));
            return;
        }

        // Check Suggestions Enabled (Owner bypass)
        if (!this.state.suggestionsEnabled && !isOwner(this, ws)) {
            ws.send(JSON.stringify({ type: "error", message: "Suggestions are currently disabled by the room owner." }));
            return;
        }

        // Rate Limiting (5 seconds)
        const now = Date.now();
        if (ws.lastSuggestionTime && (now - ws.lastSuggestionTime < 5000)) {
            ws.send(JSON.stringify({ type: "error", message: "Please wait before suggesting another song." }));
            return;
        }
        ws.lastSuggestionTime = now;

        const { query } = payload;
        const userId = ws.user.id; // Trust server-side user object
        let videoId = null;

        // 1. Resolve Video ID (URL or Search)
        const urlMatch = query.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        if (urlMatch) {
            videoId = urlMatch[1];
        } else if (this.apiKey) {
            // Search via API
            try {
                // Fetch up to 5 results to find a non-livestream
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${this.apiKey}`;
                const searchRes = await fetch(searchUrl);
                const searchData = await searchRes.json();

                if (searchData.items && searchData.items.length > 0) {
                    // Find first non-livestream
                    const validVideo = searchData.items.find(item => item.snippet && item.snippet.liveBroadcastContent === 'none');

                    if (validVideo) {
                        videoId = validVideo.id.videoId;
                    } else {
                        // All results were livestreams? Fallback to first regular one even if live, handled by validation later?
                        // Or just let validation fail. Let's pick the first one if we can't find a filtered one, 
                        // so validation allows the user to see the specific error if needed, OR we just fail here.
                        // Better UX: Pick the first one and let validation reject it with the message, 
                        // OR (preferred) pick the first one and hope it's valid, but we already know we want to skip live.
                        // If ALL 5 are live, we probably can't help much.
                        videoId = searchData.items[0].id.videoId;
                    }
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

                    // Max Duration Check
                    if (this.state.maxDuration > 0 && durationInSeconds > this.state.maxDuration) {
                        const maxMinutes = Math.floor(this.state.maxDuration / 60);
                        ws.send(JSON.stringify({ type: "error", message: `Song is too long. Max duration is ${maxMinutes} minutes.` }));
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
                        suggestedBy: userId,
                        suggestedByUsername: ws.user.name
                    };

                    // Music Only Check
                    if (this.state.musicOnly) {
                        const categoryId = videoData.snippet.categoryId;
                        if (categoryId !== '10') { // 10 is Music
                            ws.send(JSON.stringify({ type: "error", message: "Only music videos are allowed in this channel." }));
                            return;
                        }
                    }
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
        if (!ws.user) {
            ws.send(JSON.stringify({ type: "error", message: "You must be logged in to vote." }));
            return;
        }

        const queue = [...this.state.queue];
        const trackIndex = queue.findIndex((t) => t.id === trackId);

        if (trackIndex !== -1) {
            const track = { ...queue[trackIndex] };
            const userId = ws.user.id;
            const previousVote = track.voters[userId];

            let scoreChange = 0;
            if (previousVote === voteType) {
                // Toggle off
                scoreChange = voteType === 'up' ? -1 : 1;
                delete track.voters[userId];
            } else {
                // Change vote or new vote
                if (voteType === 'up') {
                    scoreChange = previousVote === 'down' ? 2 : 1;
                } else {
                    scoreChange = previousVote === 'up' ? -2 : -1;
                }
                track.voters[userId] = voteType;
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

    handleUpdateSettings({ suggestionsEnabled, musicOnly, maxDuration }) {
        const updates = {};
        if (typeof suggestionsEnabled === 'boolean') updates.suggestionsEnabled = suggestionsEnabled;
        if (typeof musicOnly === 'boolean') updates.musicOnly = musicOnly;
        if (typeof maxDuration === 'number') updates.maxDuration = maxDuration;

        if (Object.keys(updates).length > 0) {
            this.updateState(updates);
        }
    }

    destroy() {
        clearInterval(this.interval);
    }
}

module.exports = Room;
