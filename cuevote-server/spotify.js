const logger = require('./logger');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

// In-memory token storage: userId -> { accessToken, refreshToken, expiresAt }
const tokenStore = new Map();

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
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: SPOTIFY_CLIENT_ID,
        scope: SCOPES,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        state: userId,
        show_dialog: 'false',
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
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

    try {
        const tokenData = await refreshAccessToken(stored.refreshToken);
        storeTokens(userId, tokenData);
        return tokenData.access_token;
    } catch (err) {
        logger.error('[Spotify] Failed to refresh token:', err.message);
        tokenStore.delete(userId);
        return null;
    }
}

function hasTokens(userId) {
    return tokenStore.has(userId);
}

async function searchSpotify(query, accessToken, limit = 5) {
    const params = new URLSearchParams({
        q: query,
        type: 'track',
        limit: String(limit),
    });
    const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        const text = await res.text();
        logger.error('[Spotify] Search failed:', text);
        throw new Error(`Search failed: ${res.status}`);
    }
    const data = await res.json();
    const tracks = data.tracks?.items;
    if (!tracks || tracks.length === 0) return [];

    return tracks.map(t => ({
        trackId: t.id,
        title: t.name,
        artist: t.artists.map(a => a.name).join(', '),
        thumbnail: t.album?.images?.[0]?.url || null,
        duration: Math.round(t.duration_ms / 1000),
        previewUrl: t.preview_url || null,
        source: 'spotify',
    }));
}

async function getTrackDetails(trackId, accessToken) {
    const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        const text = await res.text();
        logger.error('[Spotify] Track details failed:', text);
        throw new Error(`Track details failed: ${res.status}`);
    }
    const t = await res.json();
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

async function getRecommendations(trackId, accessToken, limit = 6) {
    const params = new URLSearchParams({
        seed_tracks: trackId,
        limit: String(limit),
    });
    const res = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        const text = await res.text();
        logger.error('[Spotify] Recommendations failed:', text);
        throw new Error(`Recommendations failed: ${res.status}`);
    }
    const data = await res.json();
    const tracks = data.tracks;
    if (!tracks || tracks.length === 0) return [];

    return tracks.map(t => ({
        trackId: t.id,
        title: t.name,
        artist: t.artists.map(a => a.name).join(', '),
        thumbnail: t.album?.images?.[0]?.url || null,
        duration: Math.round(t.duration_ms / 1000),
        previewUrl: t.preview_url || null,
        source: 'spotify',
    }));
}

module.exports = {
    isConfigured,
    getAuthUrl,
    exchangeCode,
    storeTokens,
    getAccessToken,
    hasTokens,
    searchSpotify,
    getTrackDetails,
    getRecommendations,
};
