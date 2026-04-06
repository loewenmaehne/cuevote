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

// Spotify API fetch with 429 rate-limit handling (single retry after Retry-After delay)
async function spotifyFetch(url, accessToken, label) {
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
        logger.warn(`[Spotify] Rate limited on ${label}, retrying after ${retryAfter}s`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        const retry = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!retry.ok) {
            const text = await retry.text();
            logger.error(`[Spotify] ${label} failed after retry:`, text);
            throw new Error(`${label} failed: ${retry.status}`);
        }
        return retry.json();
    }
    if (!res.ok) {
        const text = await res.text();
        logger.error(`[Spotify] ${label} failed:`, text);
        throw new Error(`${label} failed: ${res.status}`);
    }
    return res.json();
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
    // Try the recommendations API first (deprecated for new/restricted apps since Nov 2024)
    try {
        const params = new URLSearchParams({
            seed_tracks: trackId,
            limit: String(limit),
        });
        const data = await spotifyFetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, accessToken, 'Recommendations');
        const tracks = data.tracks;
        if (tracks && tracks.length > 0) {
            logger.info(`[Spotify] Recommendations API returned ${tracks.length} tracks`);
            return tracks.map(mapTrack);
        }
        logger.info('[Spotify] Recommendations API returned empty, trying fallback');
    } catch (err) {
        logger.warn('[Spotify] Recommendations API failed (may be deprecated for this app), falling back:', err.message);
    }

    // Fallback 1: search by primary artist name
    let artistQuery = artist;
    try {
        if (!artistQuery) {
            const trackDetails = await getTrackDetails(trackId, accessToken);
            artistQuery = trackDetails?.artist;
        }
        if (artistQuery) {
            const primaryArtist = artistQuery.split(',')[0].trim();
            const results = await searchSpotify(primaryArtist, accessToken, limit);
            if (results.length > 0) {
                logger.info(`[Spotify] Artist search fallback returned ${results.length} tracks for "${primaryArtist}"`);
                return results;
            }
        }
    } catch (err) {
        logger.warn('[Spotify] Artist search fallback failed:', err.message);
    }

    // Fallback 2: search by track title keywords (strips parenthetical suffixes like "feat." or "remix")
    try {
        const titleQuery = (title || '').replace(/\s*[\(\[].*[\)\]].*$/g, '').trim();
        if (titleQuery && titleQuery.length > 2) {
            const results = await searchSpotify(titleQuery, accessToken, limit);
            if (results.length > 0) {
                logger.info(`[Spotify] Title search fallback returned ${results.length} tracks for "${titleQuery}"`);
                return results;
            }
        }
    } catch (err) {
        logger.warn('[Spotify] Title search fallback also failed:', err.message);
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
