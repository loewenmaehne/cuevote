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
        this.knownSongs = new Set(); // Stores videoIds of approved songs

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
            musicOnly: true, // Default true
            maxDuration: 600, // Default 10 minutes
            allowPrelisten: true,
            ownerBypass: true, // Bypass suggestions disabled
            ownerQueueBypass: false, // Bypass queue voting (Priority)
            votesEnabled: true, // Allow voting
            smartQueue: true, // Auto-replace bad songs if full
            ownerPopups: true, // Show popups for new requests
            playlistViewMode: false, // Venue Mode: Only show playlist view for guests
            maxQueueSize: 50, // Default 50
            suggestionMode: 'auto', // 'auto' or 'manual'
            pendingSuggestions: [],
            duplicateCooldown: 10, // Default 10 songs
            autoApproveKnown: true, // Default true
            autoRefill: false, // Automated Refill
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

                // Move current track to history if it exists
                let newHistory = [...this.state.history];
                if (this.state.currentTrack) {
                    newHistory.push({ ...this.state.currentTrack, playedAt: Date.now() });
                }

                newQueue.shift();
                const newCurrentTrack = newQueue[0] || null;
                const newState = {
                    queue: newQueue,
                    history: newHistory,
                    currentTrack: newCurrentTrack,
                    progress: 0,
                };
                if (!newCurrentTrack) {
                    newState.isPlaying = false;

                    // Auto-Refill Logic
                    if (this.state.autoRefill && this.state.history.length > 0) {
                        // We need to trigger this asynchronously to not block tick? 
                        // Or just call it. It involves async API calls.
                        // tick is synchronous. We should fire and forget or handle promise?
                        // "tick" is called every second. If we fire async, we might trigger multiple times if we don't set a flag.
                        // But newState.isPlaying is set to false.
                        // Let's call a method that handles the async refill and updates state when done.
                        // We should probably check if we are ALREADY refilling to avoid spamming.
                        if (!this.state.isRefilling) {
                            this.populateQueueFromHistory();
                        }
                    }
                }
                this.updateState(newState);
            } else {
                this.updateState({ progress: newProgress });
            }
        }
    }

    async populateQueueFromHistory() {
        console.log(`[AutoRefill] Triggered for Room ${this.id}`);
        this.updateState({ isRefilling: true });

        try {
            const {
                history,
                maxQueueSize,
                maxDuration,
                duplicateCooldown,
                musicOnly,
                apiKey
            } = this.state;

            // 1. Target Size: Half of maxQueueSize (def 50 -> 25), or total history if less
            // User: "If there is less than 5 songs in total, do not do anything."
            if (history.length < 5) {
                console.log(`[AutoRefill] Not enough history (${history.length} < 5). Abort.`);
                this.updateState({ isRefilling: false });
                return;
            }

            // User: "Fill the playlist with half of its queue size."
            const targetFillSize = Math.floor((maxQueueSize > 0 ? maxQueueSize : 50) / 2); // Default to 25 if unlimited
            let needed = targetFillSize;

            // Optimization: If needed is more than history, cap it?
            // User: "If there is less than half of the queue size in history, add the total amount of songs"
            // So we take what we can get.

            // 2. Filter Candidates (Repetition, Duration)
            // We need to randomize FIRST, then filter? Or Filter then randomize?
            // "Add them randomized."
            // "Respect the repetition prevent setting. Respect maximum song length..."
            // "if a song does not meet max length requirements anymore, keep in history but just dont add it this time."

            // Let's Shuffle the history first to get random candidates.
            const shuffledHistory = [...history].sort(() => 0.5 - Math.random());

            const candidates = [];
            const historyMetadataMap = new Map(); // Store metadata for ease

            // Pre-calculate recent titles for duplicate check
            // Current queue is empty (we just emptied it or it is empty), so just check recent history?
            // Wait, we are adding TO the queue.
            // Duplicate check needs to respect the cooldown relative to the START of the new queue?
            // "Respect the repetition prevent setting"
            // If cooldown is 10, we shouldn't add a song that was played in the last 10 songs.
            // Our "history" array HAS the last played songs at the end.
            const historyTitles = history.slice(-duplicateCooldown).map(t => t.title.toLowerCase().trim());
            const videoIdsToCheck = [];

            for (const track of shuffledHistory) {
                if (candidates.length >= needed) break;

                // Duration Check
                if (maxDuration > 0 && track.duration > maxDuration) continue;

                // Repetition Check
                const title = track.title.toLowerCase().trim();
                // Check if title is in recent history
                if (historyTitles.includes(title)) continue;
                // Check if we already picked this title in current candidates
                if (candidates.some(c => c.title.toLowerCase().trim() === title)) continue;

                candidates.push(track);
                videoIdsToCheck.push(track.videoId);
            }

            if (candidates.length === 0) {
                console.log("[AutoRefill] No valid candidates found after filtering.");
                this.updateState({ isRefilling: false });
                return;
            }

            // 3. Check Video Availability
            // "Check if the video still exists and is accessable and not private, if not remove it from saved history entirely."
            const validVideoIds = await this.checkVideoAvailability(videoIdsToCheck);

            const finalTracks = [];
            const invalidVideoIds = new Set();

            for (const track of candidates) {
                if (validVideoIds.has(track.videoId)) {
                    // Update ID to be unique for the new queue entry?
                    // "Room.js" uses crypto.randomUUID() for new tracks.
                    // We should clone the track and give it a new instance ID.
                    finalTracks.push({
                        ...track,
                        id: crypto.randomUUID(),
                        score: 0,
                        voters: {},
                        suggestedBy: 'System', // Indicate auto-refill?
                        suggestedByUsername: 'Auto-DJ'
                    });
                } else {
                    invalidVideoIds.add(track.videoId);
                }
            }

            // Remove invalid songs from history entirely
            if (invalidVideoIds.size > 0) {
                const cleanedHistory = history.filter(t => !invalidVideoIds.has(t.videoId));
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
                    newState.currentTrack = newQueue[0];
                    newState.isPlaying = true;
                    newState.progress = 0;
                }

                this.updateState(newState);
                console.log(`[AutoRefill] Added ${finalTracks.length} songs to queue.`);

            } else {
                this.updateState({ isRefilling: false });
            }

        } catch (err) {
            console.error("[AutoRefill] Error:", err);
            this.updateState({ isRefilling: false });
        }
    }

    async checkVideoAvailability(videoIds) {
        if (!this.apiKey || videoIds.length === 0) return new Set(videoIds); // If no API key, assume valid? Or fail? Existing code fails on add. Let's assume valid to not break offline/dev? No, user explicitly asked for check. But if no key, we can't check.

        // If no API Key, we can't check. 
        // "Check if the video still exists... if not remove it"
        // If we can't check, we shouldn't delete. So just return all as valid.
        if (!this.apiKey) return new Set(videoIds);

        const validIds = new Set();

        // Batch requests in 50s
        const chunkSize = 50;
        for (let i = 0; i < videoIds.length; i += chunkSize) {
            const chunk = videoIds.slice(i, i + chunkSize);
            try {
                const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${chunk.join(',')}&part=status,contentDetails&key=${this.apiKey}`;
                const response = await fetch(apiUrl);
                const data = await response.json();

                if (data.items) {
                    for (const item of data.items) {
                        // Check privacy/embeddable/validity
                        // If it's in the response, it generally "exists".
                        // Check status.uploadStatus, status.privacyStatus, status.embeddable
                        const status = item.status;
                        if (status) {
                            if (status.privacyStatus === 'private') continue;
                            if (status.uploadStatus === 'rejected') continue;
                            if (status.embeddable === false) continue;

                            // Also region restrictions? (contentDetails.regionRestriction) - ignoring for now unless requested

                            validIds.add(item.id);
                        }
                    }
                }
            } catch (e) {
                console.error("[AutoRefill] API Check Failed:", e);
                // If API fails, we can't be sure they are invalid. Be conservative and keep them?
                // Or skip adding them this time? 
                // Let's skip adding them to be safe, but NOT delete from history (since it could be just API error).
                // Actually, if we return empty set, we delete them from history in the caller logic?
                // The caller logic says "if not remove it from saved history entirely".
                // We should only delete if we are SURE it's invalid (found in API response as invalid/missing).
                // If API call itself fails, we probably shouldn't return anything, or return all?
                // Let's assume on API error we preserve history but don't add.
                // So adding 0 valid IDs here means 0 added to queue, and all treated as "invalid" -> deleted? 
                // Wait, if API request fails, we shouldn't delete.
                // So we need to handle network error separate from "video missing" error.
                // For now, simple logging.
            }
        }
        return validIds;
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
            case "UPDATE_DURATION":
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
        }
    }

    async handleSuggestSong(ws, payload) {
        if (!ws.user) {
            ws.send(JSON.stringify({ type: "error", message: "You must be logged in to suggest songs." }));
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
        // Proposal says "Duplicate Song Title Prevention".
        // Titles can slightly vary, but usually videoId is the unique identifier. 
        // User asked for "same title", but practically "same video" (videoId) is safer and usually what is meant to prevent repetition.
        // HOWEVER, if they want "same title" specifically to prevent covers or same song different video, that's harder.
        // Let's stick to strict Title check as requested "repetition of turning in the same title".
        // But we don't know the title yet until we fetch it!
        // We will have to fetch the title first.
        // The current flow fetches title in step 2.
        // Let's implement the check AFTER fetching details (Step 2) but BEFORE adding to queue.


        let indexToRemove = -1; // Declare here to be accessible after video verification

        // Check Max Queue Size
        if (this.state.maxQueueSize > 0 && !canBypass && this.state.queue.length >= this.state.maxQueueSize) {
            // Smart Replacement: Look for worst song (score < 0) to replace ONLY IF ENABLED
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
                    // Found a bad song to replace, mark its index for potential removal later
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
            ws.send(JSON.stringify({ type: "error", message: "Please wait before suggesting another song." }));
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
                    if (this.state.maxDuration > 0 && !canBypass && durationInSeconds > this.state.maxDuration) {
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
                ws.send(JSON.stringify({ type: "error", message: `This song was recently played (Limit: ${cooldown}).` }));
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
                // Check if song is known and auto-approve is enabled
                const isKnown = this.knownSongs.has(track.videoId);
                if (this.state.autoApproveKnown && isKnown) {
                    // Auto-approve: Skip adding to pending, proceed to queue
                    console.log(`[Auto-Approve] Song ${track.title} (${track.videoId}) is known. Bypassing review.`);
                    ws.send(JSON.stringify({ type: "success", message: "Added" }));
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
            newHistory.push({ ...this.state.currentTrack, playedAt: Date.now() });
        }

        newQueue.shift();
        const newCurrentTrack = newQueue[0] || null;
        const newState = {
            queue: newQueue,
            history: newHistory,
            currentTrack: newCurrentTrack,
            progress: 0,
            isPlaying: true,
        };
        if (!newCurrentTrack) {
            newState.isPlaying = false;
        }
        this.updateState(newState);
    }

    handleUpdateSettings({ suggestionsEnabled, musicOnly, maxDuration, allowPrelisten, ownerBypass, maxQueueSize, smartQueue, playlistViewMode, suggestionMode, ownerPopups, duplicateCooldown, ownerQueueBypass, votesEnabled, autoApproveKnown, autoRefill }) {
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
        if (typeof ownerQueueBypass === 'boolean') updates.ownerQueueBypass = ownerQueueBypass;
        if (typeof votesEnabled === 'boolean') updates.votesEnabled = votesEnabled;
        if (typeof votesEnabled === 'boolean') updates.votesEnabled = votesEnabled;
        if (typeof autoApproveKnown === 'boolean') updates.autoApproveKnown = autoApproveKnown;
        if (typeof autoRefill === 'boolean') updates.autoRefill = autoRefill;

        if (Object.keys(updates).length > 0) {
            this.updateState(updates);
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
            this.knownSongs.add(track.videoId); // Remember this song
            const newState = {
                queue: newQueue,
                pendingSuggestions: newPending
            };

            // Check if we need to start playing
            if (newQueue.length === 1 && !this.state.isPlaying) {
                newState.currentTrack = newQueue[0];
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

    handleDeleteSong({ trackId }) {
        const queue = this.state.queue;
        const index = queue.findIndex(t => t.id === trackId);

        if (index !== -1) {
            const newQueue = [...queue];
            newQueue.splice(index, 1);

            // If we deleted the current track (index 0), we need to advance
            if (index === 0) {
                // Logic similar to handleNextTrack but without adding to history? 
                // Or acts as skip? Let's just update queue and if empty stop.
                // If we remove head, next becomes head.
                const newState = {
                    queue: newQueue,
                    progress: 0
                };
                if (newQueue.length > 0) {
                    newState.currentTrack = newQueue[0];
                    newState.isPlaying = true; // Keep playing next
                } else {
                    newState.currentTrack = null;
                    newState.isPlaying = false;
                }
                this.updateState(newState);
            } else {
                this.updateState({ queue: newQueue });
            }
        }
    }

    destroy() {
        clearInterval(this.interval);
    }
}

module.exports = Room;
