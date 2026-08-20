// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let guest;

describe('Guest tokens', () => {
  before(() => {
    process.env.NODE_ENV = 'test';
    // A fixed secret keeps the assertions independent of the generated one.
    process.env.GUEST_TOKEN_SECRET = 'test-secret-that-is-long-enough-for-hmac';
    const testDir = __dirname;
    const dbFile = path.join(testDir, 'cuevote.db');
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(dbFile + suffix); } catch {}
    }
    process.chdir(testDir);
    delete require.cache[require.resolve('../db')];
    delete require.cache[require.resolve('../guest')];
    delete require.cache[require.resolve('../logger')];
    delete require.cache[require.resolve('../migrator')];
    guest = require('../guest');
  });

  after(() => {
    delete process.env.GUEST_TOKEN_SECRET;
    const dbFile = path.join(__dirname, 'cuevote.db');
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(dbFile + suffix); } catch {}
    }
  });

  it('issues a token that verifies back to an id', () => {
    const token = guest.issueToken();
    const id = guest.verifyToken(token);
    assert.ok(id, 'a freshly issued token must verify');
    assert.equal(token.startsWith(id + '.'), true);
  });

  it('issues a different id every time', () => {
    const ids = new Set();
    for (let i = 0; i < 50; i++) ids.add(guest.verifyToken(guest.issueToken()));
    assert.equal(ids.size, 50);
  });

  it('rejects a token whose id was tampered with', () => {
    const token = guest.issueToken();
    const [id, sig] = token.split('.');
    const forgedId = id.slice(0, -1) + (id.endsWith('A') ? 'B' : 'A');
    assert.equal(guest.verifyToken(`${forgedId}.${sig}`), null);
  });

  it('rejects a token whose signature was tampered with', () => {
    const token = guest.issueToken();
    const [id, sig] = token.split('.');
    const forgedSig = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
    assert.equal(guest.verifyToken(`${id}.${forgedSig}`), null);
  });

  it('rejects an unsigned or malformed token', () => {
    for (const bad of ['', '.', 'nodot', 'a.', '.b', null, undefined, 42, {}]) {
      assert.equal(guest.verifyToken(bad), null, `should reject ${JSON.stringify(bad)}`);
    }
  });

  it('rejects a signature of the wrong length without throwing', () => {
    const token = guest.issueToken();
    const [id] = token.split('.');
    // timingSafeEqual throws on length mismatch, so this must be caught earlier.
    assert.equal(guest.verifyToken(`${id}.short`), null);
    assert.equal(guest.verifyToken(`${id}.${'x'.repeat(200)}`), null);
  });

  it('namespaces guest ids so they cannot collide with account ids', () => {
    const id = guest.verifyToken(guest.issueToken());
    const user = guest.userFromId(id);
    assert.equal(user.id.startsWith('guest:'), true);
    assert.equal(user.isGuest, true);
    assert.equal(guest.isGuestUser(user), true);
    assert.equal(guest.isGuestUser({ id: 'owner-1', name: 'Owner' }), false);
    assert.equal(guest.isGuestUser(null), false);
  });

  it('derives a stable display tag from the id', () => {
    const id = guest.verifyToken(guest.issueToken());
    const first = guest.userFromId(id);
    const second = guest.userFromId(id);
    assert.equal(first.guestTag, second.guestTag);
    assert.match(first.guestTag, /^[0-9A-F]{4}$/);
    assert.equal(first.name, `Guest ${first.guestTag}`);
  });

  it('does not leak the raw id into the display name', () => {
    const id = guest.verifyToken(guest.issueToken());
    const user = guest.userFromId(id);
    assert.equal(user.name.includes(id), false);
  });
});
