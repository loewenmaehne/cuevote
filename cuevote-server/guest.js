// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Guest identities.
//
// Voting and suggesting need a stable id per participant — `track.voters` is
// keyed by it, and without one a guest could vote a track up indefinitely. They
// do NOT need an account. A guest identity here is a random id the server signs
// and hands back; the client stores it and presents it on reconnect.
//
// Deliberately stateless: no row in `users`, no row in `sessions`, nothing to
// delete under GDPR because nothing personal is stored. The id is a random
// number with a signature, and it means nothing outside this server.
const crypto = require('crypto');
const db = require('./db');
const logger = require('./logger');

const CONFIG_KEY = 'guest_token_secret';
const ID_BYTES = 16;
const SIG_LENGTH = 43; // base64url of a full SHA-256 digest, minus padding

let cachedSecret = null;

// The secret must survive a restart, or every guest at a party in progress is
// signed out by a deploy. GUEST_TOKEN_SECRET wins when set (self-hosters can
// share one across instances); otherwise one is generated once and kept in the
// database, so a default install needs no configuration.
function getSecret() {
    if (cachedSecret) return cachedSecret;

    const configured = process.env.GUEST_TOKEN_SECRET;
    if (configured && configured.length >= 32) {
        cachedSecret = configured;
        return cachedSecret;
    }
    if (configured) {
        logger.warn('[Guest] GUEST_TOKEN_SECRET is shorter than 32 characters and was ignored. Falling back to the stored secret.');
    }

    const generated = crypto.randomBytes(32).toString('base64url');
    cachedSecret = db.setConfigIfAbsent(CONFIG_KEY, generated);
    if (cachedSecret === generated) {
        logger.info('[Guest] Generated and stored a new guest token secret.');
    }
    return cachedSecret;
}

function sign(id) {
    return crypto.createHmac('sha256', getSecret()).update(id).digest('base64url');
}

/** A fresh signed guest token: `<id>.<signature>`. */
function issueToken() {
    const id = crypto.randomBytes(ID_BYTES).toString('base64url');
    return `${id}.${sign(id)}`;
}

/**
 * The guest id carried by a token, or null if the token is malformed or the
 * signature does not match. Comparison is constant-time so a caller cannot
 * learn a valid signature byte by byte.
 */
function verifyToken(token) {
    if (typeof token !== 'string') return null;

    const dot = token.indexOf('.');
    if (dot <= 0) return null;

    const id = token.slice(0, dot);
    const providedSig = token.slice(dot + 1);
    if (providedSig.length !== SIG_LENGTH) return null;

    const expectedSig = sign(id);
    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;

    return id;
}

/**
 * The user object a guest socket carries. The `guest:` prefix keeps guest ids
 * out of the namespace of Google subject ids, so a guest can never collide with
 * — or be mistaken for — a room owner.
 *
 * `tag` is four characters derived from the id, shown next to the localised
 * word for "guest" so two guests in a room are distinguishable. `name` is the
 * English fallback for clients that do not understand `isGuest`.
 */
function userFromId(guestId) {
    const tag = crypto.createHash('sha256').update(guestId).digest('hex').slice(0, 4).toUpperCase();
    return {
        id: `guest:${guestId}`,
        name: `Guest ${tag}`,
        guestTag: tag,
        isGuest: true,
    };
}

function isGuestUser(user) {
    return !!(user && user.isGuest);
}

/**
 * Whether this socket is backed by a real account.
 *
 * `ws.user` carries two kinds of identity now, and most of the server's gates
 * were written when it carried one. A bare `!ws.user` check no longer means
 * "signed in" — it means "has any identity at all", which every guest does.
 * Anything that needs a row in `users` (owning a room, erasing an account,
 * granting an AI access in someone's name, spending Search quota) must ask
 * this instead.
 */
function hasAccount(ws) {
    return !!(ws && ws.user && !ws.user.isGuest);
}

module.exports = { issueToken, verifyToken, userFromId, isGuestUser, hasAccount };
