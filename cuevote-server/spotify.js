const crypto = require('crypto');
const logger = require('./logger');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

// In-memory token storage: userId -> { accessToken, refreshToken, expiresAt }
const tokenStore = new Map();

// CSRF state store: stateToken -> { userId, createdAt } (expires after 10 minutes)
const oauthStateStore = new Map();

const SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-modify-playback-state',
    'user-read-playback-state',
].join(' ');

function isConfigured() {
    return !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && SPOTIFY_REDIRECT_URI);
}

function getAuthUrl(userId) {
    if (!isConfigured()) return null;
    const stateToken = crypto.randomBytes(32).toString('hex');
    oauthStateStore.set(stateToken, { userId, createdAt: Date.now() });
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: SPOTIFY_CLIENT_ID,
        scope: SCOPES,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        state: stateToken,
        show_dialog: 'false',
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function validateState(stateToken) {
    const entry = oauthStateStore.get(stateToken);
    if (!entry) return null;
    oauthStateStore.delete(stateToken);
    // Expire after 10 minutes
    if (Date.now() - entry.createdAt > 600000) return null;
    return entry.userId;
}

async function exchangeCode(code) {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
    });
    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
        },
        body: body.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        logger.error('[Spotify] Token exchange failed:', text);
        throw new Error(`Token exchange failed: ${res.status}`);
    }
    return res.json();
}

async function refreshAccessToken(refreshToken) {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });
    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
        },
        body: body.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        logger.error('[Spotify] Token refresh failed:', text);
        throw new Error(`Token refresh failed: ${res.status}`);
    }
    return res.json();
}

function storeTokens(userId, tokenData) {
    tokenStore.set(userId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || tokenStore.get(userId)?.refreshToken,
        expiresAt: Date.now() + (tokenData.expires_in * 1000) - 300000, // 5 min buffer
    });
    logger.info(`[Spotify] Tokens stored for user ${userId.substring(0, 8)}...`);
}

// Callback for token invalidation events (set by Room to trigger SPOTIFY_REAUTH)
let onTokenInvalidated = null;
function setOnTokenInvalidated(callback) {
    onTokenInvalidated = callback;
}

// Prevent concurrent refresh requests for the same user
const refreshInFlight = new Map();

async function getAccessToken(userId) {
    const stored = tokenStore.get(userId);
    if (!stored) return null;

    if (Date.now() < stored.expiresAt) {
        return stored.accessToken;
    }

    // Token expired — refresh
    if (!stored.refreshToken) {
        tokenStore.delete(userId);
        return null;
    }

    // Deduplicate concurrent refresh calls for the same user
    if (refreshInFlight.has(userId)) {
        return refreshInFlight.get(userId);
    }

    const refreshPromise = (async () => {
        try {
            const tokenData = await refreshAccessToken(stored.refreshToken);
            storeTokens(userId, tokenData);
            return tokenData.access_token;
        } catch (err) {
            logger.error('[Spotify] Failed to refresh token:', err.message);
            tokenStore.delete(userId);
            if (onTokenInvalidated) onTokenInvalidated(userId);
            return null;
        } finally {
            refreshInFlight.delete(userId);
        }
    })();

    refreshInFlight.set(userId, refreshPromise);
    return refreshPromise;
}

function hasTokens(userId) {
    return tokenStore.has(userId);
}

// Map Spotify API track object to our internal format
function mapTrack(t) {
    return {
        trackId: t.id,
        title: t.name,
        artist: t.artists.map(a => a.name).join(', '),
        thumbnail: t.album?.images?.[0]?.url || null,
        duration: Math.round(t.duration_ms / 1000),
        previewUrl: t.preview_url || null,
        source: 'spotify',
    };
}

// Spotify API fetch with 429 rate-limit handling and per-request timeout
async function spotifyFetch(url, accessToken, label) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.status === 429) {
            const retryAfter = Math.min(parseInt(res.headers.get('Retry-After') || '2', 10), 5);
            logger.warn(`[Spotify] Rate limited on ${label}, retrying after ${retryAfter}s`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            const retryController = new AbortController();
            const retryTimeout = setTimeout(() => retryController.abort(), 8000);
            try {
                const retry = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    signal: retryController.signal,
                });
                clearTimeout(retryTimeout);
                if (!retry.ok) {
                    const text = await retry.text();
                    logger.error(`[Spotify] ${label} failed after retry:`, text);
                    throw new Error(`${label} failed: ${retry.status}`);
                }
                return retry.json();
            } catch (err) {
                clearTimeout(retryTimeout);
                throw err;
            }
        }
        if (!res.ok) {
            const text = await res.text();
            logger.error(`[Spotify] ${label} failed:`, text);
            throw new Error(`${label} failed: ${res.status}`);
        }
        return res.json();
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            logger.warn(`[Spotify] ${label} timed out after 8s`);
            throw new Error(`${label} timed out`);
        }
        throw err;
    }
}

async function searchSpotify(query, accessToken, limit = 5) {
    const params = new URLSearchParams({
        q: query,
        type: 'track',
        limit: String(limit),
    });
    const data = await spotifyFetch(`https://api.spotify.com/v1/search?${params.toString()}`, accessToken, 'Search');
    const tracks = data.tracks?.items;
    if (!tracks || tracks.length === 0) return [];
    return tracks.map(mapTrack);
}

async function getTrackDetails(trackId, accessToken) {
    const t = await spotifyFetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`, accessToken, 'Track details');
    return mapTrack(t);
}

async function getRecommendations(trackId, accessToken, limit = 6, artist = null, title = null) {
    // Overall timeout: abort if recommendations take longer than 20s
    const deadline = Date.now() + 20000;
    const checkDeadline = () => {
        if (Date.now() > deadline) throw new Error('Recommendations overall timeout');
    };

    // Resolve artist/title upfront if not provided (needed by multiple strategies)
    let artistName = artist;
    let trackTitle = title;
    if (!artistName || !trackTitle) {
        try {
            const details = await getTrackDetails(trackId, accessToken);
            if (!artistName) artistName = details?.artist;
            if (!trackTitle) trackTitle = details?.title;
        } catch (err) {
            logger.warn('[Spotify] Failed to fetch track details for recommendations:', err.message);
        }
    }

    // Strategy 1: Get artist's top tracks (most relevant "similar" results)
    try {
        checkDeadline();
        if (artistName) {
            const primaryArtist = artistName.split(',')[0].trim();
            // Search for artist to get their Spotify ID
            const artistSearchParams = new URLSearchParams({ q: primaryArtist, type: 'artist', limit: '1' });
            const artistData = await spotifyFetch(`https://api.spotify.com/v1/search?${artistSearchParams}`, accessToken, 'Artist search');
            const spotifyArtist = artistData.artists?.items?.[0];
            if (spotifyArtist) {
                // Get artist's top tracks
                const topTracks = await spotifyFetch(`https://api.spotify.com/v1/artists/${spotifyArtist.id}/top-tracks`, accessToken, 'Artist top tracks');
                if (topTracks.tracks && topTracks.tracks.length > 0) {
                    const mapped = topTracks.tracks.map(mapTrack).filter(t => t.trackId !== trackId);
                    if (mapped.length > 0) {
                        logger.info(`[Spotify] Artist top tracks returned ${mapped.length} tracks for "${primaryArtist}"`);
                        return mapped.slice(0, limit);
                    }
                }

                // Get related artists and their top tracks for more variety
                try {
                    const related = await spotifyFetch(`https://api.spotify.com/v1/artists/${spotifyArtist.id}/related-artists`, accessToken, 'Related artists');
                    if (related.artists && related.artists.length > 0) {
                        // Pick top 2 related artists and get a track from each
                        const relatedTracks = [];
                        for (const relArtist of related.artists.slice(0, 3)) {
                            try {
                                const relTop = await spotifyFetch(`https://api.spotify.com/v1/artists/${relArtist.id}/top-tracks`, accessToken, 'Related artist top tracks');
                                if (relTop.tracks?.[0]) relatedTracks.push(relTop.tracks[0]);
                                if (relTop.tracks?.[1]) relatedTracks.push(relTop.tracks[1]);
                            } catch { /* skip this related artist */ }
                        }
                        if (relatedTracks.length > 0) {
                            logger.info(`[Spotify] Related artists returned ${relatedTracks.length} tracks`);
                            return relatedTracks.map(mapTrack).filter(t => t.trackId !== trackId).slice(0, limit);
                        }
                    }
                } catch (err) {
                    logger.warn('[Spotify] Related artists lookup failed:', err.message);
                }
            }
        }
    } catch (err) {
        logger.warn('[Spotify] Artist-based recommendations failed:', err.message);
    }

    // Strategy 2: Search by "artist genre" keywords for variety
    try {
        checkDeadline();
        if (artistName) {
            const primaryArtist = artistName.split(',')[0].trim();
            const results = await searchSpotify(primaryArtist, accessToken, limit + 2);
            const filtered = results.filter(r => r.trackId !== trackId).slice(0, limit);
            if (filtered.length > 0) {
                logger.info(`[Spotify] Artist search returned ${filtered.length} tracks for "${primaryArtist}"`);
                return filtered;
            }
        }
    } catch (err) {
        logger.warn('[Spotify] Artist search fallback failed:', err.message);
    }

    // Strategy 3: Search by track title keywords (strips parenthetical suffixes)
    try {
        checkDeadline();
        const titleQuery = (trackTitle || '').replace(/\s*[\(\[].*[\)\]].*$/g, '').trim();
        if (titleQuery && titleQuery.length > 2) {
            const results = await searchSpotify(titleQuery, accessToken, limit + 2);
            const filtered = results.filter(r => r.trackId !== trackId).slice(0, limit);
            if (filtered.length > 0) {
                logger.info(`[Spotify] Title search returned ${filtered.length} tracks for "${titleQuery}"`);
                return filtered;
            }
        }
    } catch (err) {
        logger.warn('[Spotify] Title search fallback also failed:', err.message);
    }

    // Strategy 4: Try the deprecated recommendations API as last resort
    try {
        checkDeadline();
        const params = new URLSearchParams({ seed_tracks: trackId, limit: String(limit) });
        const data = await spotifyFetch(`https://api.spotify.com/v1/recommendations?${params}`, accessToken, 'Recommendations');
        if (data.tracks && data.tracks.length > 0) {
            logger.info(`[Spotify] Recommendations API returned ${data.tracks.length} tracks`);
            return data.tracks.map(mapTrack);
        }
    } catch (err) {
        logger.warn('[Spotify] Recommendations API failed (deprecated):', err.message);
    }

    return [];
}

module.exports = {
    isConfigured,
    getAuthUrl,
    validateState,
    exchangeCode,
    storeTokens,
    getAccessToken,
    hasTokens,
    setOnTokenInvalidated,
    searchSpotify,
    getTrackDetails,
    getRecommendations,
};
