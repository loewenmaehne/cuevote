const jwt = require('jsonwebtoken');
const fs = require('fs');

let cachedToken = null;
let tokenExpiresAt = 0;

function getPrivateKey() {
    if (process.env.APPLE_MUSIC_PRIVATE_KEY) {
        return process.env.APPLE_MUSIC_PRIVATE_KEY;
    }
    if (process.env.APPLE_MUSIC_PRIVATE_KEY_PATH) {
        return fs.readFileSync(process.env.APPLE_MUSIC_PRIVATE_KEY_PATH, 'utf8');
    }
    return null;
}

function isConfigured() {
    return !!(
        process.env.APPLE_MUSIC_TEAM_ID &&
        process.env.APPLE_MUSIC_KEY_ID &&
        getPrivateKey()
    );
}

function getDeveloperToken() {
    const now = Math.floor(Date.now() / 1000);

    // Return cached token if still valid (with 5-minute buffer)
    if (cachedToken && tokenExpiresAt > now + 300) {
        return cachedToken;
    }

    const privateKey = getPrivateKey();
    if (!privateKey) {
        console.error('[Apple Music] No private key configured');
        return null;
    }

    const teamId = process.env.APPLE_MUSIC_TEAM_ID;
    const keyId = process.env.APPLE_MUSIC_KEY_ID;

    // Apple allows up to 6 months; use 180 days
    const exp = now + (180 * 24 * 60 * 60);

    const token = jwt.sign({}, privateKey, {
        algorithm: 'ES256',
        expiresIn: '180d',
        issuer: teamId,
        header: {
            alg: 'ES256',
            kid: keyId
        }
    });

    cachedToken = token;
    tokenExpiresAt = exp;
    console.log('[Apple Music] Generated new developer token (expires in 180 days)');
    return token;
}

function getStorefront() {
    return process.env.APPLE_MUSIC_STOREFRONT || 'us';
}

/**
 * Replace Apple Music artwork URL template with actual dimensions.
 * Template format: "{w}x{h}bb.jpg" or similar
 */
function formatArtworkUrl(url, width = 300, height = 300) {
    if (!url) return null;
    return url.replace('{w}', width).replace('{h}', height);
}

/**
 * Parse an Apple Music song resource into our track-compatible format.
 */
function parseSongResource(song) {
    const attrs = song.attributes;
    return {
        trackId: song.id,
        title: attrs.name,
        artist: attrs.artistName,
        thumbnail: formatArtworkUrl(attrs.artwork?.url),
        duration: Math.round((attrs.durationInMillis || 0) / 1000),
        previewUrl: attrs.previews?.[0]?.url || null,
        source: 'apple_music'
    };
}

/**
 * Search Apple Music catalog for songs.
 * Returns an array of parsed track objects.
 */
async function searchAppleMusic(query, storefront, limit = 5) {
    const token = getDeveloperToken();
    if (!token) {
        throw new Error('Apple Music developer token not available');
    }

    const sf = storefront || getStorefront();
    const url = `https://api.music.apple.com/v1/catalog/${sf}/search?term=${encodeURIComponent(query)}&types=songs&limit=${limit}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const body = await response.text();
        console.error(`[Apple Music] Search API error ${response.status}:`, body);
        throw new Error(`Apple Music API error: ${response.status}`);
    }

    const data = await response.json();
    const songs = data.results?.songs?.data;

    if (!songs || songs.length === 0) {
        return [];
    }

    return songs.map(parseSongResource);
}

/**
 * Get details for a specific Apple Music track by catalog ID.
 */
async function getAppleMusicTrackDetails(trackId, storefront) {
    const token = getDeveloperToken();
    if (!token) {
        throw new Error('Apple Music developer token not available');
    }

    const sf = storefront || getStorefront();
    const url = `https://api.music.apple.com/v1/catalog/${sf}/songs/${trackId}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const body = await response.text();
        console.error(`[Apple Music] Track details API error ${response.status}:`, body);
        throw new Error(`Apple Music API error: ${response.status}`);
    }

    const data = await response.json();
    const song = data.data?.[0];
    if (!song) return null;

    return parseSongResource(song);
}

module.exports = {
    isConfigured,
    getDeveloperToken,
    searchAppleMusic,
    getAppleMusicTrackDetails,
    getStorefront,
    formatArtworkUrl
};
