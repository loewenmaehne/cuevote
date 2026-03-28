const crypto = require("crypto");
const db = require("./db");

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

// Fisher-Yates shuffle for unbiased randomization
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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
            is_public: metadata.is_public !== undefined ? metadata.is_public : 1,
            password: metadata.password || null,
            captions_enabled: metadata.captions_enabled !== undefined ? metadata.captions_enabled : 0,
            language_flag: metadata.language_flag || 'international'
        };
        this.clients = new Set();
        this.knownVideos = new Set(); // Stores videoIds of approved videos
        this.ipBlockedVideos = new Map(); // videoId -> { failCount, lastFailedAt } for IP-blocked cooldown
        this.consecutiveIPErrors = 0;    // Consecutive confirmed IP-block events
        this.networkThrottleUntil = 0;   // Timestamp: suppress API calls and pause queue during throttle window
        this.videoStatusCache = new Map(); // videoId -> { reason, checkedAt } to avoid redundant API calls

        this.state = {
            roomId: id, // Send ID to client for validation
            queue: [],
            history: [],
            currentTrack: null,
            isPlaying: false,
            progress: 0,
            activeChannel: name,
            ownerId: metadata.owner_id,
            suggestionsEnabled: true,
            musicOnly: false, // Default false
            maxDuration: 600, // Default 10 minutes
            allowPrelisten: true,
            ownerBypass: true, // Bypass suggestions disabled
            ownerQueueBypass: false, // Bypass queue voting (Priority)
            votesEnabled: true, // Allow voting
            smartQueue: true, // Auto-replace bad videos if full
            ownerPopups: true, // Show popups for new requests
            playlistViewMode: false, // Venue Mode: Only show playlist view for guests
            maxQueueSize: 50, // Default 50
            suggestionMode: 'auto', // 'auto' or 'manual'
            pendingSuggestions: [],
            duplicateCooldown: 10, // Default 10 songs
            autoApproveKnown: true, // Default true
            autoRefill: metadata.auto_refill !== undefined ? !!metadata.auto_refill : true,
            captionsEnabled: !!(metadata.captions_enabled), // Initialize from metadata
            bannedVideos: [], // List of banned videos { videoId, title, artist, ... }
        };

        // Start the Room Timer
        this.interval = setInterval(() => this.tick(), 1000);

        this.stateSaveCounter = 0;
        this.stateSaveInterval = setInterval(() => {
            if (this.state.currentTrack || this.state.queue.length > 0) {
                try { db.saveRoomState(this.id, this.state); } catch (e) { /* ignore */ }
            }
        }, 30000);

        // Load History from Database (Persistent Library)
        try {
            const savedHistory = db.getRoomHistory(this.id);
            if (savedHistory && savedHistory.length > 0) {
                this.state.history = savedHistory.slice(-200);
            }
        } catch (error) {
            console.error(`[Room ${this.id}] Failed to load history from DB:`, error);
        }

        // Restore saved playback state (crash recovery)
        try {
            const saved = db.loadRoomState(this.id);
            if (saved) {
                if (saved.queue && saved.queue.length > 0) this.state.queue = saved.queue;
                if (saved.currentTrack) this.state.currentTrack = saved.currentTrack;
                if (saved.progress) this.state.progress = saved.progress;
                if (saved.isPlaying) this.state.isPlaying = saved.isPlaying;
                console.log(`[Room ${this.id}] Restored saved state (queue: ${this.state.queue.length}, playing: ${this.state.isPlaying})`);
            }
        } catch (error) {
            console.error(`[Room ${this.id}] Failed to restore saved state:`, error);
        }

        // 28-day freshness: if room was dormant for > 28 days, clear stale preview
        // and discard restored queue so metadata is re-fetched on first interaction
        const TWENTY_EIGHT_DAYS_S = 28 * 24 * 60 * 60;
        if (metadata.last_active_at) {
            const dormantSeconds = Math.floor(Date.now() / 1000) - metadata.last_active_at;
            if (dormantSeconds > TWENTY_EIGHT_DAYS_S) {
                console.log(`[Room ${this.id}] Dormant for ${Math.floor(dormantSeconds / 86400)} days. Clearing stale state.`);
                this.state.queue = [];
                this.state.currentTrack = null;
                this.state.isPlaying = false;
                this.state.progress = 0;
                try { db.updateLobbyPreview(this.id, null); } catch (e) { /* ignore */ }
            }
        }

        // TV station auto-start: populate queue from history on wake-up
        if (this.state.autoRefill && !this.state.currentTrack && this.state.history.length > 0) {
            this.populateQueueFromHistory();
        }
    }

    hasViewers() {
        return this.clients.size > 0;
    }

    getSummary() {
        const track = this.state.currentTrack;
        return {
            id: this.id,
            name: this.name,
            description: this.metadata.description,
            color: this.metadata.color,
            listeners: this.clients.size,
            currentTrack: track ? {
                thumbnail: track.thumbnail,
                title: track.title,
                artist: track.artist,
            } : null,
            isActive: true,
            language_flag: this.metadata.language_flag
        };
    }

    addClient(ws) {
        if (this.deleted) {
            ws.send(JSON.stringify({ type: "error", message: "This channel has been deleted." }));
            ws.close();
            return;
        }
        console.log(`[SERVER TRACE] Room ${this.id}: Adding client. Total clients: ${this.clients.size + 1}`);
        this.clients.add(ws);

        // Safety: if a room has no owner_id, do not silently assign ownership
        if (!this.metadata.owner_id && ws.user) {
            console.warn(`[Room ${this.id}] Missing owner_id in metadata; treating as ownerless for this session.`);
            this.state.ownerId = null;
        }

        try {
            const payload = JSON.stringify({ type: "state", payload: this.state });
            if (ws.readyState === 1) {
                ws.send(payload);
            }
        } catch (e) {
            console.error(`ERROR sending state to client ${ws.id}:`, e);
        }

        // TV station: refill queue with API-validated content when a viewer joins an idle station
        if (this.state.autoRefill && !this.state.isRefilling
            && this.state.queue.length === 0 && this.state.history.length > 0) {
            this.populateQueueFromHistory();
        }
    }

    removeClient(ws) {
        this.clients.delete(ws);
    }

    broadcastState() {
        const message = JSON.stringify({ type: "state", payload: this.state });
        this.broadcast(message);
    }

    broadcast(message) {
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        for (const client of this.clients) {
            if (client.readyState === 1) { // OPEN
                client.send(payload);
            }
        }
    }

    updateState(newState) {
        const trackChanged = 'currentTrack' in newState
            && newState.currentTrack !== this.state.currentTrack;
        this.state = { ...this.state, ...newState };
        if (trackChanged) this.persistLobbyPreview();
        this.broadcastState();
    }

    persistLobbyPreview() {
        const track = this.state.currentTrack;
        const newKey = track ? `${track.thumbnail}\0${track.title}\0${track.artist}` : '';
        if (newKey === this._lastLobbyPreviewKey) return;
        this._lastLobbyPreviewKey = newKey;
        try {
            db.updateLobbyPreview(this.id, track ? {
                thumbnail: track.thumbnail,
                title: track.title,
                artist: track.artist,
            } : null);
        } catch (e) {
            console.error(`[Room ${this.id}] Failed to persist lobby preview:`, e);
        }
    }

    tick() {
        if (this.state.isPlaying && this.state.currentTrack) {
            // FIX: Timestamp Stability
            // If startedAt is missing (legacy track or server restart), back-fill it
            if (!this.state.currentTrack.startedAt) {
                // Assume current progress is correct relative to now
                this.state.currentTrack.startedAt = Date.now() - (this.state.progress * 1000);
            }

            // Calculate progress based on wall-clock time diff
            const elapsed = Math.floor((Date.now() - this.state.currentTrack.startedAt) / 1000);
            const newProgress = elapsed >= 0 ? elapsed : 0;
            const duration = this.state.currentTrack.duration || 200;

            if (newProgress >= duration) {
                // Auto-Advance
                const newQueue = [...this.state.queue];

                // Move current track to history if it exists
                let newHistory = [...this.state.history];
                if (this.state.currentTrack) {
                    const trackToSave = { ...this.state.currentTrack, playedAt: Date.now() };
                    newHistory.push(trackToSave);

                    // Persist history addition to Database
                    try {
                        db.addToRoomHistory(this.id, trackToSave);
                    } catch (err) {
                        console.error(`[Room ${this.id}] Failed to save track to DB history:`, err);
                    }
                }

                // Cap memory history
                if (newHistory.length > 200) {
                    newHistory = newHistory.slice(-200);
                }

                newQueue.shift();
                const newCurrentTrack = newQueue[0] || null;

                // Initialize timestamp for new track
                if (newCurrentTrack) {
                    newCurrentTrack.startedAt = Date.now();
                }

                const newState = {
                    queue: newQueue,
                    history: newHistory,
                    currentTrack: newCurrentTrack,
                    progress: 0,
                };
                if (!newCurrentTrack) {
                    newState.isPlaying = false;

                    this.updateState(newState);

                    // Auto-Refill Logic
                    if (!newCurrentTrack && this.state.autoRefill && this.state.history.length > 0) {
                        if (!this.state.isRefilling) {
                            this.populateQueueFromHistory();
                        }
                    }
                } else {
                    this.updateState(newState);
                }
            } else {
                if (newProgress !== this.state.progress) {
                    this.state.progress = newProgress;
                    if (!this._lastProgressBroadcast || (Date.now() - this._lastProgressBroadcast >= 5000)) {
                        this._lastProgressBroadcast = Date.now();
                        this.broadcast({ type: "progress", payload: newProgress });
                    }
                }
            }

            // Suggestion Check Trigger is now REMOVED to save API Quota (Option 4).
            // Suggestions are now only fetched explicitly via the FETCH_SUGGESTIONS message triggered by the client.
        }
    }

    async updateSuggestions(videoId) {
        this.lastSuggestionSourceVideoId = videoId; // Prevent loop

        try {
            // 1. Check Cache
            const cached = db.getRelatedVideos(videoId);
            if (cached) {
                const age = Math.floor(Date.now() / 1000) - cached.fetched_at;
                // 30 Days cache validity
                if (age < 2592000) {
                    this.broadcast({ type: "SUGGESTION_UPDATE", payload: cached.data });
                    return;
                }
            }

            if (!this.apiKey) return;

            // 2. Fetch from API
            const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${videoId}&type=video&videoCategoryId=10&maxResults=6&key=${this.apiKey}`;
            const response = await fetch(apiUrl, {
                headers: { 'Referer': process.env.URL || 'https://cuevote.com' }
            });
            const data = await response.json();

            if (data.items) {
                const suggestions = data.items.map(item => ({
                    videoId: item.id.videoId,
                    title: item.snippet.title,
                    artist: item.snippet.channelTitle,
                    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url
                }));

                // Save to Cache
                db.saveRelatedVideos(videoId, suggestions);

                // Broadcast
                this.broadcast({ type: "SUGGESTION_UPDATE", payload: suggestions });
            }

        } catch (e) {
            console.error("[Suggestions] Error:", e);
        }
    }

    async populateQueueFromHistory() {
        if (this.state.isRefilling) {
            console.log(`[AutoRefill] Already refilling, skip.`);
            return;
        }
        console.log(`[AutoRefill] Triggered for Room ${this.id}`);
        this.updateState({ isRefilling: true });

        try {
            const {
                history,
                maxQueueSize,
                maxDuration,
                duplicateCooldown,
                musicOnly
            } = this.state;

            // 1. Target Size: Half of maxQueueSize (def 50 -> 25), or total history if less
            if (history.length < 1) {
                console.log(`[AutoRefill] No history. Abort.`);
                this.updateState({ isRefilling: false });
                return;
            }

            // User: "Fill the playlist with half of its queue size."
            const targetFillSize = Math.floor((maxQueueSize > 0 ? maxQueueSize : 50) / 2); // Default to 25 if unlimited
            let needed = targetFillSize;

            // 2. Filter Candidates (Repetition, Duration)

            // Deduplicate history for the candidate pool to avoid frequency bias
            const uniqueHistoryMap = new Map();
            history.forEach(track => uniqueHistoryMap.set(track.videoId, track));
            const uniqueHistory = Array.from(uniqueHistoryMap.values());

            // Check if we have enough unique history?
            // If unique history is small, we might just re-add same songs?
            // "If there is less than half of the queue size in history, add the total amount of songs"

            const shuffledHistory = shuffleArray([...uniqueHistory]);

            const candidates = [];

            const historyTitles = (duplicateCooldown > 0)
                ? history.slice(-duplicateCooldown)
                    .filter(t => t.title)
                    .map(t => t.title.toLowerCase().trim())
                : [];
            const videoIdsToCheck = [];

            // Perform strict duplicate check against CURRENT QUEUE + Recent History
            const queueVideoIds = new Set(this.state.queue.map(t => t.videoId));

            for (const track of shuffledHistory) {
                if (candidates.length >= needed) break;

                // Skip tracks whose metadata was cleared by the 28-day TOS cleanup
                if (!track.title || !track.videoId) continue;

                // Duration Check
                if (maxDuration > 0 && track.duration > maxDuration) continue;

                // Music-only filter
                if (musicOnly && track.category_id && track.category_id !== '10') continue;

                // IP Cooldown Check — skip videos that recently failed due to IP blocks (30 min cooldown)
                const ipEntry = this.ipBlockedVideos.get(track.videoId);
                if (ipEntry && (Date.now() - ipEntry.lastFailedAt) < 1800000) continue;

                // Repetition Check (History cooldown)
                const title = track.title.toLowerCase().trim();
                // Check if title is in recent history
                if (historyTitles.includes(title)) continue;

                // FIX: Check if video is ALREADY IN QUEUE (prevent immediate duplicate)
                if (queueVideoIds.has(track.videoId)) continue;

                // Check if we already picked this title in current candidates
                if (candidates.some(c => c.title.toLowerCase().trim() === title)) continue;

                candidates.push(track);
                videoIdsToCheck.push(track.videoId);
            }

            // Fallback: when library is very small, relax duplicate/cooldown checks to allow looping
            if (candidates.length === 0 && uniqueHistory.length > 0) {
                console.log(`[AutoRefill] No candidates after strict filtering. Relaxing checks for small library (${uniqueHistory.length} unique videos).`);
                for (const track of shuffledHistory) {
                    if (candidates.length >= needed) break;
                    if (!track.title || !track.videoId) continue;
                    if (maxDuration > 0 && track.duration > maxDuration) continue;
                    const ipEntry = this.ipBlockedVideos.get(track.videoId);
                    if (ipEntry && (Date.now() - ipEntry.lastFailedAt) < 1800000) continue;
                    candidates.push(track);
                    videoIdsToCheck.push(track.videoId);
                }
            }

            if (candidates.length === 0) {
                console.log("[AutoRefill] No valid candidates found after filtering.");
                this.updateState({ isRefilling: false });
                return;
            }

            // 3. Check Video Availability
            // Skip API validation when no viewers to save quota — DB 28-day history already filters stale entries.
            // Full API validation runs when viewers are present (e.g. on first join).
            const validVideos = this.hasViewers()
                ? await this.checkVideoAvailability(videoIdsToCheck)
                : new Map(videoIdsToCheck.map(id => [id, null]));

            const finalTracks = [];
            const invalidVideoIds = new Set();

            for (const track of candidates) {
                if (validVideos.has(track.videoId)) {
                    const fresh = validVideos.get(track.videoId);
                    finalTracks.push({
                        ...track,
                        ...(fresh || {}),
                        id: crypto.randomUUID(),
                        score: 0,
                        voters: {},
                        suggestedBy: 'System',
                        suggestedByUsername: 'Channel Mix'
                    });
                } else {
                    invalidVideoIds.add(track.videoId);
                }
            }

            // Remove invalid videos from history entirely (use current state so we don't drop entries added during async work)
            if (invalidVideoIds.size > 0) {
                const cleanedHistory = this.state.history.filter(t => !invalidVideoIds.has(t.videoId));
                this.updateState({ history: cleanedHistory });
                console.log(`[AutoRefill] Removed ${invalidVideoIds.size} invalid videos from history.`);
            }

            if (finalTracks.length > 0) {
                // User: "Make sure that half of the queue size get succesfully added."
                // We tried our best.

                // Add to Queue
                const newQueue = [...this.state.queue, ...finalTracks];

                // If queue was empty and we added songs, we should start playing?
                // The tick logic sets isPlaying = false if queue is empty.
                // We are async here. Tick might have finished.
                // We need to wake it up.
                const newState = {
                    queue: newQueue,
                    isRefilling: false
                };

                if (!this.state.isPlaying && newQueue.length > 0) {
                    newState.currentTrack = { ...newQueue[0], startedAt: Date.now() };
                    newQueue[0] = newState.currentTrack;
                    newState.queue = newQueue;
                    newState.isPlaying = true;
                    newState.progress = 0;
                }

                this.updateState(newState);
                console.log(`[AutoRefill] Added ${finalTracks.length} videos to queue.`);

            } else {
                this.updateState({ isRefilling: false });
            }

        } catch (err) {
            console.error("[AutoRefill] Error:", err);
            this.updateState({ isRefilling: false });
        }
    }

    async checkVideoAvailability(videoIds) {
        if (!this.apiKey || videoIds.length === 0) return new Map(videoIds.map(id => [id, null]));

        const validVideos = new Map();

        const chunkSize = 50;
        for (let i = 0; i < videoIds.length; i += chunkSize) {
            const chunk = videoIds.slice(i, i + chunkSize);
            try {
                const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${chunk.join(',')}&part=status,snippet,contentDetails&key=${this.apiKey}`;
                const response = await fetch(apiUrl);

                if (!response.ok) {
                    const errorBody = await response.text().catch(() => '');
                    console.error(`[AutoRefill] API returned HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
                    for (const id of chunk) validVideos.set(id, null);
                    continue;
                }

                const data = await response.json();

                if (data.items) {
                    const returnedIds = new Set(data.items.map(item => item.id));
                    for (const item of data.items) {
                        const status = item.status;
                        if (status) {
                            if (status.privacyStatus === 'private') continue;
                            if (status.uploadStatus === 'rejected') continue;
                            if (status.embeddable === false) continue;

                            const snippet = item.snippet;
                            const freshData = snippet ? {
                                thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
                                title: snippet.title,
                                artist: snippet.channelTitle,
                            } : null;

                            validVideos.set(item.id, freshData);

                            if (snippet) {
                                try {
                                    db.upsertVideo({
                                        id: item.id,
                                        title: snippet.title,
                                        artist: snippet.channelTitle,
                                        thumbnail: freshData.thumbnail,
                                        duration: item.contentDetails ? parseISO8601Duration(item.contentDetails.duration) : null,
                                        category_id: snippet.categoryId || null,
                                        language: snippet.defaultAudioLanguage || snippet.defaultLanguage || null,
                                    });
                                } catch (e) { /* ignore cache refresh errors */ }
                            }
                        }
                    }
                    // IDs not returned by the API are genuinely deleted/private — leave them out of validVideos
                }
            } catch (e) {
                console.error("[AutoRefill] API Check Failed:", e);
                for (const id of chunk) validVideos.set(id, null);
            }
        }
        return validVideos;
    }

    async handleMessage(ws, message) {
        const sendAck = () => {
            if (message.msgId && ws.readyState === 1) {
                ws.send(JSON.stringify({ type: "ACK", msgId: message.msgId }));
            }
        };

        switch (message.type) {
            case "SUGGEST_SONG":
                await this.handleSuggestSong(ws, message.payload);
                sendAck();
                break;
            case "VOTE":
                this.handleVote(ws, message.payload);
                sendAck();
                break;
            case "PLAY_PAUSE":
                if (isOwner(this, ws)) {
                    if (message.payload === true) {
                        // Owner explicitly resuming — treat as manual retry after throttle
                        this.networkThrottleUntil = 0;
                        this.consecutiveIPErrors = 0;
                    }
                    this.updateState({ isPlaying: message.payload });
                }
                break;
            case "NEXT_TRACK":
                if (isOwner(this, ws)) {
                    this.handleNextTrack();
                }
                break;
            case "PLAYBACK_ERROR":
                if (isOwner(this, ws)) {
                    await this.handlePlaybackError(ws, message.payload);
                }
                break;
            case "UPDATE_DURATION":
                if (isOwner(this, ws) && this.state.currentTrack) {
                    // A duration update means the video is actually playing — reset IP error counters
                    this.consecutiveIPErrors = 0;
                    this.networkThrottleUntil = 0;
                    this.updateState({
                        currentTrack: { ...this.state.currentTrack, duration: message.payload },
                    });
                }
                break;
            case "SEEK_TO":
                if (isOwner(this, ws) && this.state.currentTrack) {
                    const newProgress = Number(message.payload);
                    if (!Number.isFinite(newProgress) || newProgress < 0) break;
                    const duration = this.state.currentTrack.duration || 0;
                    const clamped = duration > 0 ? Math.min(newProgress, duration) : newProgress;
                    this.state.currentTrack = { ...this.state.currentTrack, startedAt: Date.now() - (clamped * 1000) };
                    this.updateState({ progress: clamped });
                }
                break;
            case "UPDATE_SETTINGS":
                if (isOwner(this, ws)) {
                    this.handleUpdateSettings(message.payload);
                }
                break;
            case "APPROVE_SUGGESTION":
                if (isOwner(this, ws)) {
                    this.handleApproveSuggestion(message.payload);
                }
                break;
            case "REJECT_SUGGESTION":
                if (isOwner(this, ws)) {
                    this.handleRejectSuggestion(message.payload);
                }
                break;

            case "DELETE_SONG":
                if (isOwner(this, ws)) {
                    this.handleDeleteSong(message.payload);
                }
                break;
            case "BAN_SUGGESTION":
                if (isOwner(this, ws)) {
                    this.handleBanSuggestion(message.payload);
                }
                break;
            case "UNBAN_SONG":
                if (isOwner(this, ws)) {
                    this.handleUnbanSong(message.payload);
                }
                break;
            case "REMOVE_FROM_LIBRARY":
                if (isOwner(this, ws)) {
                    this.handleRemoveFromLibrary(message.payload);
                }
                break;
            case "DELETE_ROOM":
                if (isOwner(this, ws)) {
                    this.handleDeleteRoom(ws);
                } else {
                    ws.send(JSON.stringify({ type: "error", message: "Unauthorized to delete room. Are you the owner?" }));
                }
                break;
            case "DELETE_ACCOUNT":
                // Delegate back to main server handler or handle here?
                // Returning a specific flag or emitting an event would be ideal, 
                // but since we are in `Room.js`, we can just implement the destruction logic or 
                // rely on the fact that `index.js` might be checking this message type BEFORE calling room.handleMessage?
                // ERROR: I suspect index.js logic forwards it blindly.
                // Let's force a "return false" or similar if we want parent to handle it?
                // Or simply `return` and ensure index.js handles it?
                // Let's assume index.js needs to handle it.
                // If I modify index.js to check for DELETE_ACCOUNT *before* routing to room, that fixes it globally.
                // I will NOT edit Room.js yet. I will edit index.js.
                break;
            case "FETCH_SUGGESTIONS":
                this.handleFetchSuggestions(ws, message.payload);
                break;
        }
    }

    async handleFetchSuggestions(ws, { videoId, title, artist }) {
        if (!videoId) return;

        try {
            // 1. Check Cache
            const cached = db.getRelatedVideos(videoId);
            if (cached) {
                const age = Math.floor(Date.now() / 1000) - cached.fetched_at;
                if (age < 2592000) {
                    ws.send(JSON.stringify({ type: "SUGGESTION_RESULT", payload: { sourceVideoId: videoId, suggestions: cached.data } }));
                    return;
                }
            }

            if (!this.apiKey) {
                ws.send(JSON.stringify({ type: "error", message: "Suggestions unavailable (No API Key)." }));
                return;
            }

            // 2. Fetch from API (Search by keyword)
            // Strategy: Search for the ARTIST to get "More from this artist".
            //Searching for "Title + Artist" mostly returns covers/versions of the same video.
            let query = "";
            if (artist && artist.toLowerCase() !== "unknown artist") {
                query = artist; // Best for variety (other videos by same artist)
            } else {
                query = title; // Fallback
            }

            const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=6&key=${this.apiKey}`;
            console.log("[Suggestions] Fetching Search:", apiUrl);

            const response = await fetch(apiUrl, {
                headers: { 'Referer': process.env.URL || 'https://cuevote.com' }
            });
            const data = await response.json();
            console.log("[Suggestions] YouTube Response:", JSON.stringify(data, null, 2));

            if (data.items) {
                const suggestions = data.items
                    .filter(item => item.id.videoId !== videoId) // Exclude self
                    .map(item => ({
                        videoId: item.id.videoId,
                        title: item.snippet.title,
                        artist: item.snippet.channelTitle,
                        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url
                    }));

                // Save to Cache
                db.saveRelatedVideos(videoId, suggestions);

                // Send to Client
                ws.send(JSON.stringify({ type: "SUGGESTION_RESULT", payload: { sourceVideoId: videoId, suggestions } }));
            } else {
                console.error("[Suggestions] No items found in response:", data);
                ws.send(JSON.stringify({ type: "error", message: "No suggestions found." }));
            }
        } catch (e) {
            console.error("Manual Fetch Error:", e);
            ws.send(JSON.stringify({ type: "error", message: "Failed to fetch suggestions." }));
        }
    }

    async handleSuggestSong(ws, payload) {
        if (!ws.user) {
            ws.send(JSON.stringify({ type: "error", message: "You must be logged in to suggest videos." }));
            return;
        }

        const isUserOwner = isOwner(this, ws);
        const canBypass = isUserOwner && this.state.ownerBypass;

        if (!this.state.suggestionsEnabled && !canBypass) {
            ws.send(JSON.stringify({ type: "error", message: "Suggestions are currently disabled by the room owner." }));
            return;
        }

        const { query } = payload; // Moved up for title check

        // Duplicate Title Check
        // We need to resolve the video first to get the title, OR we check videoId if we have it?
        // Proposal says "Duplicate Video Title Prevention".
        // Titles can slightly vary, but usually videoId is the unique identifier. 
        // User asked for "same title", but practically "same video" (videoId) is safer and usually what is meant to prevent repetition.
        // HOWEVER, if they want "same title" specifically to prevent covers or same video different video, that's harder.
        // Let's stick to strict Title check as requested "repetition of turning in the same title".
        // But we don't know the title yet until we fetch it!
        // We will have to fetch the title first.
        // The current flow fetches title in step 2.
        // Let's implement the check AFTER fetching details (Step 2) but BEFORE adding to queue.


        let indexToRemove = -1; // Declare here to be accessible after video verification

        // Check Max Queue Size
        if (this.state.maxQueueSize > 0 && !canBypass && this.state.queue.length >= this.state.maxQueueSize) {
            // Smart Replacement: Look for worst video (score < 0) to replace ONLY IF ENABLED
            if (this.state.smartQueue) {
                // Skip index 0 (current track)
                const upcomingQueue = this.state.queue.slice(1);
                let worstTrackIndex = -1;
                let minScore = 0; // Must be strictly less than 0 to be considered

                upcomingQueue.forEach((track, index) => {
                    const score = track.score || 0;
                    if (score < 0) {
                        if (worstTrackIndex === -1 || score < minScore) {
                            minScore = score;
                            worstTrackIndex = index + 1; // Adjust for slice offset
                        }
                    }
                });

                if (worstTrackIndex !== -1) {
                    // Found a bad video to replace, mark its index for potential removal later
                    indexToRemove = worstTrackIndex;
                } else {
                    ws.send(JSON.stringify({ type: "error", message: `Queue is full. Max size is ${this.state.maxQueueSize}.` }));
                    return;
                }
            } else {
                ws.send(JSON.stringify({ type: "error", message: `Queue is full. Max size is ${this.state.maxQueueSize}.` }));
                return;
            }
        }

        // Rate Limiting (5 seconds) - Bypass for owner
        const now = Date.now();
        if (!canBypass && ws.lastSuggestionTime && (now - ws.lastSuggestionTime < 5000)) {
            ws.send(JSON.stringify({ type: "error", message: "Please wait before suggesting another video." }));
            return;
        }
        ws.lastSuggestionTime = now;

        // const { query } = payload; // Already destructured above
        const userId = ws.user.id; // Trust server-side user object
        let videoId = null;

        // 1. Resolve Video ID (URL or Search)
        const urlMatch = query.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);

        if (urlMatch) {
            videoId = urlMatch[1];
        } else {
            // Check Search Cache
            const cachedSearchId = db.getSearchTermVideo(query);
            if (cachedSearchId) {
                console.log(`[Search Cache] Hit for "${query}" -> ${cachedSearchId}`);
                videoId = cachedSearchId;
            } else if (this.apiKey) {
                // Search via API
                try {
                    // Fetch up to 5 results to find a non-livestream
                    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${this.apiKey}`;
                    const searchRes = await fetch(searchUrl, {
                        headers: {
                            'Referer': process.env.URL || 'https://cuevote.com'
                        }
                    });
                    const searchData = await searchRes.json();

                    if (searchData.items && searchData.items.length > 0) {
                        // Find first non-livestream
                        const validVideo = searchData.items.find(item => item.snippet && item.snippet.liveBroadcastContent === 'none');

                        if (validVideo) {
                            videoId = validVideo.id.videoId;
                        } else {
                            videoId = searchData.items[0].id.videoId;
                        }

                        // Cache the result
                        if (videoId) {
                            db.cacheSearchTerm(query, videoId);
                        }
                    }
                } catch (err) {
                    console.error("Search failed:", err);
                }
            }
        }

        if (!videoId) {
            ws.send(JSON.stringify({ type: "error", message: "Could not find video." }));
            return;
        }

        // 2. Fetch Details & Validate
        let track = null;

        // Check if banned before anything else
        if (this.state.bannedVideos.some(b => b.videoId === videoId)) {
            ws.send(JSON.stringify({ type: "error", message: "This video has been banned from this channel." }));
            return;
        }

        // Check Video DB Cache
        let cachedVideo = db.getVideo(videoId);
        if (cachedVideo) {
            const nowSeconds = Math.floor(Date.now() / 1000);
            // 28 Days = 2419200 seconds
            if (nowSeconds - cachedVideo.fetched_at > 2419200) {
                console.log(`[Video Cache] Stale for ${videoId}. Refetching.`);
                cachedVideo = null;
            }
        }

        if (cachedVideo) {
            console.log(`[Video Cache] Hit for ${videoId} (Fresh)`);

            // Validate Cached Data against Room Rules
            // Max Duration
            if (this.state.maxDuration > 0 && !canBypass && cachedVideo.duration > this.state.maxDuration) {
                const maxMinutes = Math.floor(this.state.maxDuration / 60);
                ws.send(JSON.stringify({ type: "error", message: `Video is too long. Max duration is ${maxMinutes} minutes.` }));
                return;
            }
            // Music Only
            if (this.state.musicOnly && cachedVideo.category_id !== '10') {
                ws.send(JSON.stringify({ type: "error", message: "Only music videos are allowed in this channel." }));
                return;
            }

            track = {
                id: crypto.randomUUID(),
                videoId: cachedVideo.id,
                title: cachedVideo.title,
                artist: cachedVideo.artist,
                thumbnail: cachedVideo.thumbnail,
                duration: cachedVideo.duration,
                score: 0,
                voters: {},
                suggestedBy: userId,
                suggestedByUsername: ws.user.name,
                language: cachedVideo.language // Restore language from cache
            };

        } else if (this.apiKey) {
            try {
                const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails,snippet,status&key=${this.apiKey}`;
                const response = await fetch(apiUrl, {
                    headers: {
                        'Referer': process.env.URL || 'https://cuevote.com'
                    }
                });
                const data = await response.json();

                if (data.items && data.items.length > 0) {
                    const videoData = data.items[0];

                    // Check Embeddable Status
                    if (videoData.status && videoData.status.embeddable === false) {
                        ws.send(JSON.stringify({ type: "error", message: "This video playback is restricted by the owner (Not Embeddable)." }));
                        return;
                    }

                    // Check Age Restriction
                    if (videoData.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted') {
                        ws.send(JSON.stringify({ type: "error", message: "Age-restricted videos are not allowed." }));
                        return;
                    }

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
                    if (this.state.maxDuration > 0 && !canBypass && durationInSeconds > this.state.maxDuration) {
                        const maxMinutes = Math.floor(this.state.maxDuration / 60);
                        ws.send(JSON.stringify({ type: "error", message: `Video is too long. Max duration is ${maxMinutes} minutes.` }));
                        return;
                    }

                    // Music Only Check
                    if (this.state.musicOnly) {
                        const categoryId = videoData.snippet.categoryId;
                        if (categoryId !== '10') { // 10 is Music
                            ws.send(JSON.stringify({ type: "error", message: "Only music videos are allowed in this channel." }));
                            return;
                        }
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
                        suggestedByUsername: ws.user.name,
                        language: videoData.snippet.defaultAudioLanguage || videoData.snippet.defaultLanguage
                    };

                    // Cache to DB
                    db.upsertVideo({
                        id: videoId,
                        title: track.title,
                        artist: track.artist,
                        thumbnail: track.thumbnail,
                        duration: track.duration,
                        category_id: videoData.snippet.categoryId,
                        language: track.language
                    });
                } else {
                    console.log(`[DEBUG API] Video Details Response Missing Items. Status: ${response.status}. Body:`, JSON.stringify(data));
                }
            } catch (apiError) {
                console.error("YouTube API Check failed:", apiError);
            }
        }

        // Duplicate Title Check (After we have track details)
        if (track && this.state.duplicateCooldown > 0 && !canBypass) {
            const cooldown = this.state.duplicateCooldown;
            const titleToCheck = track.title.toLowerCase().trim();

            // Check Queue
            const queueTitles = this.state.queue.map(t => t.title.toLowerCase().trim());
            // Check History (limit to needed amount)
            const historyToCheck = this.state.history.slice(-cooldown).map(t => t.title.toLowerCase().trim());

            // Logic: Check combined list of recent history + current queue
            const combinedList = [...historyToCheck, ...queueTitles];
            const recentTracks = combinedList.slice(-cooldown);

            const isDuplicate = recentTracks.some(t => t === titleToCheck);

            if (isDuplicate) {
                ws.send(JSON.stringify({ type: "error", message: `This video was recently played (Limit: ${cooldown}).` }));
                return;
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
            // Apply Smart Replacement if needed
            if (indexToRemove !== -1) {
                // Ensure index is still valid (it should be, synchronous flow)
                if (indexToRemove < this.state.queue.length) {
                    this.state.queue.splice(indexToRemove, 1);
                }
            }

            // Manual Review Check
            if (this.state.suggestionMode === 'manual' && !canBypass) {
                // Check if video is known and auto-approve is enabled
                const isKnown = this.knownVideos.has(track.videoId);
                if (this.state.autoApproveKnown && isKnown) {
                    // Auto-approve: Skip adding to pending, proceed to queue
                    console.log(`[Auto-Approve] Video ${track.title} (${track.videoId}) is known. Bypassing review.`);
                    // Fallthrough to add to queue and send success at the end
                } else {
                    const newPending = [...(this.state.pendingSuggestions || []), track];
                    this.updateState({ pendingSuggestions: newPending });
                    ws.send(JSON.stringify({ type: "info", message: "Submitted" }));
                    return;
                }
            }

            // Priority Check
            if (this.state.ownerQueueBypass && isUserOwner) {
                track.isOwnerPriority = true;
            }

            const newQueue = [...this.state.queue, track];
            const newState = { queue: newQueue };
            if (newQueue.length === 1) {
                newState.currentTrack = newQueue[0];
                newState.currentTrack.startedAt = Date.now(); // Init Timestamp
                newState.isPlaying = true;
                newState.progress = 0;
            } else {
                // Trigger auto-sort if we added to a non-empty queue
                // We need to resort because this new track might be priority

                const current = newQueue[0];
                let upcoming = newQueue.slice(1);

                upcoming.sort((a, b) => {
                    // 1. Owner Priority
                    if (a.isOwnerPriority && !b.isOwnerPriority) return -1;
                    if (!a.isOwnerPriority && b.isOwnerPriority) return 1;

                    // 2. Score
                    const scoreDiff = (b.score || 0) - (a.score || 0);
                    if (scoreDiff !== 0) return scoreDiff;

                    // 3. Time added (implicit by stable sort or index if we had it, but generic sort is fine)
                    return 0;
                });

                newState.queue = [current, ...upcoming];
            }
            this.updateState(newState);

            // Send Success Message (For all successful queue additions: Owner Bypass, Auto-Approve, or Auto-Mode)
            ws.send(JSON.stringify({ type: "success", message: "Added" }));
        }

    }

    handleVote(ws, { trackId, voteType }) {
        if (!ws.user) {
            ws.send(JSON.stringify({ type: "error", message: "You must be logged in to vote." }));
            return;
        }

        const isUserOwner = isOwner(this, ws);
        const canBypass = isUserOwner && this.state.ownerBypass;

        if (!this.state.votesEnabled && !canBypass) {
            ws.send(JSON.stringify({ type: "error", message: "Voting is currently disabled." }));
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
                // 1. Owner Priority
                if (a.isOwnerPriority && !b.isOwnerPriority) return -1;
                if (!a.isOwnerPriority && b.isOwnerPriority) return 1;

                // 2. Score
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

        // Move current track to history
        let newHistory = [...this.state.history];
        if (this.state.currentTrack) {
            const trackToSave = { ...this.state.currentTrack, playedAt: Date.now() };
            newHistory.push(trackToSave);

            try {
                db.addToRoomHistory(this.id, trackToSave);
            } catch (err) {
                console.error(`[Room ${this.id}] Failed to save track to DB history:`, err);
            }
        }

        // Cap memory history
        if (newHistory.length > 200) {
            newHistory = newHistory.slice(-200);
        }

        newQueue.shift();
        const newCurrentTrack = newQueue[0] || null;

        if (newCurrentTrack) {
            newCurrentTrack.startedAt = Date.now(); // Init Timestamp
        }

        const newState = {
            queue: newQueue,
            history: newHistory,
            currentTrack: newCurrentTrack,
            progress: 0,
            isPlaying: true,
        };
        if (!newCurrentTrack) {
            newState.isPlaying = false;
            this.updateState(newState);

            if (this.state.autoRefill && this.state.history.length > 0 && !this.state.isRefilling) {
                this.populateQueueFromHistory();
            }
        } else {
            this.updateState(newState);
        }
    }

    async handlePlaybackError(ws, { videoId, errorCode }) {
        if (!videoId || !this.state.currentTrack || this.state.currentTrack.videoId !== videoId) return;

        const now = Date.now();
        const THROTTLE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours — IP blocks typically last hours, not minutes
        const CACHE_TTL_MS = 5 * 60 * 1000;            // Re-check same video after 5 min

        let isGenuinelyUnavailable = true;
        let reason = 'unavailable';

        // If the network is already in throttle mode, skip the API call entirely and pause.
        if (now < this.networkThrottleUntil) {
            console.log(`[PlaybackError] Network throttle active. Pausing playback instead of skipping.`);
            this.updateState({ isPlaying: false });
            this.broadcast({ type: "NETWORK_THROTTLE", payload: { until: this.networkThrottleUntil } });
            return;
        }

        // Check per-video cache to avoid burning quota for the same video
        const cached = this.videoStatusCache.get(videoId);
        if (cached && (now - cached.checkedAt) < CACHE_TTL_MS) {
            reason = cached.reason;
            isGenuinelyUnavailable = (reason !== 'ip_blocked' && reason !== 'check_failed' && reason !== 'no_api_key');
            console.log(`[PlaybackError] Using cached status for ${videoId}: ${reason}`);
        } else if (this.apiKey) {
            try {
                const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=status,contentDetails&key=${this.apiKey}`;
                const response = await fetch(apiUrl);
                const data = await response.json();

                if (!response.ok || data.error) {
                    console.error("[PlaybackError] YouTube API returned error:", data.error?.message || `HTTP ${response.status}`);
                    isGenuinelyUnavailable = false;
                    reason = 'check_failed';
                } else if (data.items && data.items.length > 0) {
                    const status = data.items[0].status;
                    if (status) {
                        if (status.privacyStatus === 'private') {
                            reason = 'private';
                        } else if (status.uploadStatus === 'rejected') {
                            reason = 'rejected';
                        } else if (status.embeddable === false) {
                            reason = 'not_embeddable';
                        } else {
                            isGenuinelyUnavailable = false;
                            reason = 'ip_blocked';
                        }
                    }
                    // If items exists but status is fine, video is playable from server's IP → IP block
                } else {
                    // No items: video deleted or private (not returned by API)
                    reason = 'unavailable';
                }
            } catch (e) {
                console.error("[PlaybackError] API check failed:", e);
                isGenuinelyUnavailable = false;
                reason = 'check_failed';
            }
            this.videoStatusCache.set(videoId, { reason, checkedAt: now });
        } else {
            isGenuinelyUnavailable = false;
            reason = 'no_api_key';
        }

        this.broadcast({ type: "VIDEO_STATUS", payload: { videoId, status: reason } });

        if (isGenuinelyUnavailable) {
            console.log(`[PlaybackError] Video ${videoId} genuinely unavailable (${reason}). Skipping with history.`);
            this.consecutiveIPErrors = 0;
            this.handleNextTrack();
        } else {
            console.log(`[PlaybackError] Video ${videoId} likely IP-blocked (${reason}). Consecutive: ${this.consecutiveIPErrors + 1}`);
            this.ipBlockedVideos.set(videoId, {
                failCount: (this.ipBlockedVideos.get(videoId)?.failCount || 0) + 1,
                lastFailedAt: now
            });
            this.consecutiveIPErrors += 1;

            // Any confirmed IP block: stop immediately and warn. IP blocks are all-or-nothing —
            // every subsequent video on the same network will also fail.
            this.networkThrottleUntil = now + THROTTLE_WINDOW_MS;
            console.warn(`[PlaybackError] IP block confirmed. Entering network throttle mode (6h). Consecutive: ${this.consecutiveIPErrors}`);
            this.updateState({ isPlaying: false });
            this.broadcast({ type: "NETWORK_THROTTLE", payload: { until: this.networkThrottleUntil } });
        }
    }

    handleUpdateSettings({ suggestionsEnabled, musicOnly, maxDuration, allowPrelisten, ownerBypass, maxQueueSize, smartQueue, playlistViewMode, suggestionMode, ownerPopups, duplicateCooldown, ownerQueueBypass, votesEnabled, autoApproveKnown, autoRefill, captionsEnabled }) {
        const updates = {};
        if (typeof suggestionsEnabled === 'boolean') updates.suggestionsEnabled = suggestionsEnabled;
        if (typeof musicOnly === 'boolean') updates.musicOnly = musicOnly;
        if (typeof maxDuration === 'number') updates.maxDuration = maxDuration;
        if (typeof allowPrelisten === 'boolean') updates.allowPrelisten = allowPrelisten;
        if (typeof ownerBypass === 'boolean') updates.ownerBypass = ownerBypass;
        if (typeof smartQueue === 'boolean') updates.smartQueue = smartQueue;
        if (typeof playlistViewMode === 'boolean') updates.playlistViewMode = playlistViewMode;
        if (typeof maxQueueSize === 'number') updates.maxQueueSize = maxQueueSize;
        if (typeof ownerPopups === 'boolean') updates.ownerPopups = ownerPopups;
        if (suggestionMode === 'auto' || suggestionMode === 'manual') updates.suggestionMode = suggestionMode;
        if (typeof duplicateCooldown === 'number') updates.duplicateCooldown = duplicateCooldown;
        if (typeof ownerQueueBypass === 'boolean') updates.ownerQueueBypass = ownerQueueBypass;
        if (typeof votesEnabled === 'boolean') updates.votesEnabled = votesEnabled;
        if (typeof autoApproveKnown === 'boolean') updates.autoApproveKnown = autoApproveKnown;
        if (typeof autoRefill === 'boolean') updates.autoRefill = autoRefill;
        if (typeof captionsEnabled === 'boolean') updates.captionsEnabled = captionsEnabled;

        if (Object.keys(updates).length > 0) {
            this.updateState(updates);

            // Persist DB Settings (captions_enabled)
            if (updates.captionsEnabled !== undefined) {
                this.metadata.captions_enabled = updates.captionsEnabled ? 1 : 0; // Update memory metadata
                try {
                    db.updateRoomSettings(this.id, { captions_enabled: updates.captionsEnabled });
                } catch (e) { console.error("Failed to persist room settings", e); }
            }

            // Persist autoRefill to DB
            if (updates.autoRefill !== undefined) {
                try {
                    db.updateRoomSettings(this.id, { auto_refill: updates.autoRefill });
                } catch (e) { console.error("Failed to persist auto_refill", e); }
            }

            // Trigger Auto-Refill if enabled and queue is empty
            if (updates.autoRefill === true && this.state.queue.length === 0
                && this.state.history.length >= 1 && !this.state.isRefilling) {
                this.populateQueueFromHistory();
            }
        }
    }

    handleApproveSuggestion({ trackId }) {
        const pending = this.state.pendingSuggestions || [];
        const index = pending.findIndex(t => t.id === trackId);
        if (index !== -1) {
            const track = pending[index];
            const newPending = [...pending];
            newPending.splice(index, 1);

            // Add to queue logic (simplified version of handleSuggestSong end)
            const newQueue = [...this.state.queue, track];
            this.knownVideos.add(track.videoId); // Remember this video
            const newState = {
                queue: newQueue,
                pendingSuggestions: newPending
            };

            // Check if we need to start playing
            if (newQueue.length === 1 && !this.state.isPlaying) {
                newState.currentTrack = newQueue[0];
                newState.currentTrack.startedAt = Date.now(); // Init timestamp for proper progress tracking
                newState.isPlaying = true;
                newState.progress = 0;
            }

            this.updateState(newState);
        }
    }

    handleRejectSuggestion({ trackId }) {
        const pending = this.state.pendingSuggestions || [];
        const index = pending.findIndex(t => t.id === trackId);
        if (index !== -1) {
            const newPending = [...pending];
            newPending.splice(index, 1);
            this.updateState({ pendingSuggestions: newPending });
        }
    }

    handleBanSuggestion({ trackId }) {
        const pending = this.state.pendingSuggestions || [];
        const index = pending.findIndex(t => t.id === trackId);

        if (index !== -1) {
            const track = pending[index];
            const newPending = [...pending];
            newPending.splice(index, 1);

            // Add to banned list
            if (!this.state.bannedVideos.some(b => b.videoId === track.videoId)) {
                const newBanned = [
                    ...this.state.bannedVideos,
                    {
                        videoId: track.videoId,
                        title: track.title,
                        artist: track.artist,
                        thumbnail: track.thumbnail,
                        bannedAt: Date.now()
                    }
                ];
                this.updateState({
                    pendingSuggestions: newPending,
                    bannedVideos: newBanned
                });
            } else {
                this.updateState({ pendingSuggestions: newPending });
            }
        }
    }

    handleUnbanSong({ videoId }) {
        const banned = this.state.bannedVideos || [];
        const newBanned = banned.filter(t => t.videoId !== videoId);
        this.updateState({ bannedVideos: newBanned });
    }

    handleRemoveFromLibrary({ videoId }) {
        if (!videoId) return;
        const initialCount = this.state.history.length;
        // Filter out all instances of this videoId
        const newHistory = this.state.history.filter(t => t.videoId !== videoId);

        // Also remove from knownSongs cache
        if (this.knownVideos.has(videoId)) {
            this.knownVideos.delete(videoId);
        }

        if (newHistory.length !== initialCount) {
            console.log(`[Room ${this.id}] Removed video ${videoId} from history.`);
            this.updateState({ history: newHistory });

            // Delete from persistent database as well
            try {
                db.removeFromRoomHistory(this.id, videoId);
            } catch (err) {
                console.error(`[Room ${this.id}] Failed to remove track from DB history:`, err);
            }
        }
    }

    handleDeleteSong({ trackId }) {
        const queue = this.state.queue;
        const index = queue.findIndex(t => t.id === trackId);

        if (index !== -1) {
            const newQueue = [...queue];
            newQueue.splice(index, 1);

            if (index === 0) {
                // Preserve deleted current track in history for Auto-DJ pool
                let newHistory = [...this.state.history];
                if (this.state.currentTrack) {
                    const trackToSave = { ...this.state.currentTrack, playedAt: Date.now() };
                    newHistory.push(trackToSave);
                    try {
                        db.addToRoomHistory(this.id, trackToSave);
                    } catch (err) {
                        console.error(`[Room ${this.id}] Failed to save deleted track to DB history:`, err);
                    }
                }
                if (newHistory.length > 200) {
                    newHistory = newHistory.slice(-200);
                }

                const newState = {
                    queue: newQueue,
                    history: newHistory,
                    progress: 0
                };
                if (newQueue.length > 0) {
                    newState.currentTrack = { ...newQueue[0], startedAt: Date.now() };
                    newQueue[0] = newState.currentTrack;
                    newState.queue = newQueue;
                    newState.isPlaying = true;
                } else {
                    newState.currentTrack = null;
                    newState.isPlaying = false;
                    this.updateState(newState);

                    if (this.state.autoRefill && this.state.history.length > 0 && !this.state.isRefilling) {
                        this.populateQueueFromHistory();
                    }
                    return;
                }
                this.updateState(newState);
            } else {
                this.updateState({ queue: newQueue });
            }
        }
    }

    handleDeleteRoom(ws) {
        console.log(`[Room ${this.id}] DELETING ROOM initiated by owner.`);
        ws.send(JSON.stringify({ type: "info", message: "Processing deletion..." }));
        try {
            const result = db.deleteRoom(this.id);
            console.log(`[Delete Room] DB Result:`, result);

            if (result.changes > 0) {
                this.deleted = true;
                ws.send(JSON.stringify({ type: "success", message: `Channel deleted. Goodbye!` }));
                this.broadcast(JSON.stringify({ type: "ROOM_DELETED" }));

                // Force close connections
                setTimeout(() => {
                    this.clients.forEach(c => {
                        try { c.close(); } catch (e) { }
                    });
                    this.clients.clear();
                }, 500);
            } else {
                ws.send(JSON.stringify({ type: "error", message: "Database deletion returned 0 changes. Room ID mismatch?" }));
            }
        } catch (err) {
            console.error("Delete room failed", err);
            ws.send(JSON.stringify({ type: "error", message: `Failed to delete room: ${err.message}` }));
        }
    }

    /**
     * GDPR: Remove a deleted user's PII from this room's in-memory state.
     * Call this for every active room when a user account is deleted so their
     * id/name are not broadcast in voters or suggestedBy/suggestedByUsername.
     */
    scrubDeletedUser(userId) {
        const id = String(userId).trim();
        const scrubTrack = (track) => {
            if (!track) return track;
            const next = { ...track };
            if (next.voters && next.voters[id] !== undefined) {
                const { [id]: _, ...rest } = next.voters;
                next.voters = rest;
            }
            if (next.suggestedBy === id) {
                next.suggestedBy = null;
                next.suggestedByUsername = '[deleted]';
            }
            return next;
        };

        const newQueue = (this.state.queue || []).map(scrubTrack);
        const newHistory = (this.state.history || []).map(scrubTrack);
        const newPending = (this.state.pendingSuggestions || []).map(scrubTrack);
        const newCurrentTrack = this.state.currentTrack ? scrubTrack(this.state.currentTrack) : null;

        this.state = {
            ...this.state,
            queue: newQueue,
            history: newHistory,
            pendingSuggestions: newPending,
            currentTrack: newCurrentTrack
        };
        this.broadcastState();
    }

    destroy() {
        clearInterval(this.interval);
        clearInterval(this.stateSaveInterval);
        try { db.saveRoomState(this.id, this.state); } catch (e) { /* ignore */ }
    }
}

module.exports = Room;
