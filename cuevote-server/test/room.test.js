// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let Room;
let db;

function mockWs(user = null) {
  const messages = [];
  return {
    id: 'mock-' + Math.random().toString(36).slice(2),
    readyState: 1,
    user,
    send(data) { messages.push(JSON.parse(data)); },
    close() { this.readyState = 3; },
    _messages: messages,
  };
}

describe('Room', () => {
  before(() => {
    process.env.NODE_ENV = 'test';
    const testDir = __dirname;
    const dbFile = path.join(testDir, 'cuevote.db');
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(dbFile + suffix); } catch {}
    }
    process.chdir(testDir);
    delete require.cache[require.resolve('../db')];
    delete require.cache[require.resolve('../Room')];
    delete require.cache[require.resolve('../logger')];
    delete require.cache[require.resolve('../migrator')];
    db = require('../db');
    Room = require('../Room');

    db.upsertUser({
      id: 'owner-1',
      email: 'owner@example.com',
      name: 'Room Owner',
      picture: '',
    });
    db.upsertUser({
      id: 'guest-1',
      email: 'guest@example.com',
      name: 'Guest User',
      picture: '',
    });
  });

  after(() => {
    const dbFile = path.join(__dirname, 'cuevote.db');
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(dbFile + suffix); } catch {}
    }
  });

  describe('Construction', () => {
    it('should create a room with default state', () => {
      const room = new Room('test-room', 'Test Room', null, { owner_id: 'owner-1' });
      assert.equal(room.id, 'test-room');
      assert.equal(room.name, 'Test Room');
      assert.equal(room.state.isPlaying, false);
      assert.deepEqual(room.state.queue, []);
      assert.equal(room.state.suggestionsEnabled, true);
      room.destroy();
    });

    it('should respect metadata settings', () => {
      const room = new Room('test-room-2', 'Room 2', null, {
        owner_id: 'owner-1',
        captions_enabled: 1,
        auto_refill: 0,
        language_flag: 'en',
      });
      assert.equal(room.state.captionsEnabled, true);
      assert.equal(room.state.autoRefill, false);
      assert.equal(room.metadata.language_flag, 'en');
      room.destroy();
    });
  });

  describe('Client Management', () => {
    it('should add and remove clients', () => {
      const room = new Room('client-room', 'Client Room', null, { owner_id: 'owner-1' });
      const ws = mockWs({ id: 'guest-1', name: 'Guest' });

      room.addClient(ws);
      assert.equal(room.clients.size, 1);

      room.removeClient(ws);
      assert.equal(room.clients.size, 0);
      room.destroy();
    });

    it('should send full state on addClient', () => {
      const room = new Room('state-room', 'State Room', null, { owner_id: 'owner-1' });
      const ws = mockWs({ id: 'guest-1', name: 'Guest' });

      room.addClient(ws);
      assert.equal(ws._messages.length, 1);
      assert.equal(ws._messages[0].type, 'state');
      assert.ok(ws._messages[0].payload.roomId);
      room.removeClient(ws);
      room.destroy();
    });

    it('should reject connections to deleted rooms', () => {
      const room = new Room('deleted-room', 'Deleted', null, { owner_id: 'owner-1' });
      room.deleted = true;
      const ws = mockWs({ id: 'guest-1', name: 'Guest' });

      room.addClient(ws);
      assert.equal(room.clients.size, 0);
      assert.equal(ws._messages[0].type, 'error');
      room.destroy();
    });
  });

  describe('Voting', () => {
    it('should handle upvote on a queued track', () => {
      const room = new Room('vote-room', 'Vote Room', null, { owner_id: 'owner-1' });
      room.state.queue = [
        { id: 'track-1', videoId: 'v1', title: 'Track 1', score: 0, voters: {} },
        { id: 'track-2', videoId: 'v2', title: 'Track 2', score: 0, voters: {} },
      ];
      room.state.currentTrack = room.state.queue[0];

      const ws = mockWs({ id: 'guest-1', name: 'Guest' });
      room.addClient(ws);

      room.handleVote(ws, { trackId: 'track-2', voteType: 'up' });
      const track = room.state.queue.find(t => t.id === 'track-2');
      assert.equal(track.score, 1);
      assert.equal(track.voters['guest-1'], 'up');
      room.destroy();
    });

    it('should toggle vote off when same type is sent twice', () => {
      const room = new Room('toggle-room', 'Toggle Room', null, { owner_id: 'owner-1' });
      room.state.queue = [
        { id: 'track-1', videoId: 'v1', title: 'Track 1', score: 0, voters: {} },
        { id: 'track-2', videoId: 'v2', title: 'Track 2', score: 0, voters: {} },
      ];
      room.state.currentTrack = room.state.queue[0];

      const ws = mockWs({ id: 'guest-1', name: 'Guest' });
      room.addClient(ws);

      room.handleVote(ws, { trackId: 'track-2', voteType: 'up' });
      room.handleVote(ws, { trackId: 'track-2', voteType: 'up' });
      const track = room.state.queue.find(t => t.id === 'track-2');
      assert.equal(track.score, 0);
      assert.equal(track.voters['guest-1'], undefined);
      room.destroy();
    });

    it('should reject votes from unauthenticated users', () => {
      const room = new Room('auth-vote-room', 'Auth Vote', null, { owner_id: 'owner-1' });
      room.state.queue = [
        { id: 'track-1', videoId: 'v1', title: 'T1', score: 0, voters: {} },
      ];
      const ws = mockWs(null);
      room.addClient(ws);

      room.handleVote(ws, { trackId: 'track-1', voteType: 'up' });
      const lastMsg = ws._messages[ws._messages.length - 1];
      assert.equal(lastMsg.type, 'error');
      assert.ok(lastMsg.message.includes('logged in'));
      room.destroy();
    });

    it('should sort queue by score after voting', () => {
      const room = new Room('sort-room', 'Sort Room', null, { owner_id: 'owner-1' });
      room.state.queue = [
        { id: 'current', videoId: 'v0', title: 'Current', score: 0, voters: {} },
        { id: 'track-a', videoId: 'v1', title: 'A', score: 0, voters: {} },
        { id: 'track-b', videoId: 'v2', title: 'B', score: 0, voters: {} },
      ];
      room.state.currentTrack = room.state.queue[0];

      const ws = mockWs({ id: 'guest-1', name: 'Guest' });
      room.addClient(ws);

      room.handleVote(ws, { trackId: 'track-b', voteType: 'up' });
      assert.equal(room.state.queue[0].id, 'current');
      assert.equal(room.state.queue[1].id, 'track-b');
      assert.equal(room.state.queue[2].id, 'track-a');
      room.destroy();
    });
  });

  describe('Owner Controls', () => {
    it('should allow owner to update settings', () => {
      const room = new Room('settings-room', 'Settings', null, { owner_id: 'owner-1' });
      const ws = mockWs({ id: 'owner-1', name: 'Owner' });
      room.addClient(ws);

      room.handleUpdateSettings({ musicOnly: true, maxDuration: 300 });
      assert.equal(room.state.musicOnly, true);
      assert.equal(room.state.maxDuration, 300);
      room.destroy();
    });

    it('should handle next track', () => {
      const room = new Room('next-room', 'Next', null, { owner_id: 'owner-1' });
      room.state.queue = [
        { id: 'current', videoId: 'v1', title: 'Current Track', score: 0, voters: {}, duration: 200, artist: 'A', thumbnail: 'x' },
        { id: 'next', videoId: 'v2', title: 'Next Track', score: 0, voters: {}, duration: 200, artist: 'B', thumbnail: 'y' },
      ];
      room.state.currentTrack = room.state.queue[0];
      room.state.isPlaying = true;

      room.handleNextTrack();
      assert.equal(room.state.currentTrack.id, 'next');
      assert.equal(room.state.queue.length, 1);
      assert.ok(room.state.history.length >= 1);
      room.destroy();
    });
  });

  describe('Playback Error Handling', () => {
    const seedQueue = (room) => {
      room.state.queue = [
        { id: 'a', videoId: 'vidA', title: 'A', score: 0, voters: {}, duration: 200, artist: 'A', thumbnail: 'x' },
        { id: 'b', videoId: 'vidB', title: 'B', score: 0, voters: {}, duration: 200, artist: 'B', thumbnail: 'y' },
        { id: 'c', videoId: 'vidC', title: 'C', score: 0, voters: {}, duration: 200, artist: 'C', thumbnail: 'z' },
      ];
      room.state.currentTrack = room.state.queue[0];
      room.state.isPlaying = true;
    };
    // YouTube API shape for a deleted/private video: no items returned
    const goneResponse = { ok: true, json: async () => ({ items: [] }) };

    it('should not double-skip on concurrent PLAYBACK_ERRORs for the same video', async () => {
      const room = new Room('pberr-dupe', 'PB Dupe', 'test-key', { owner_id: 'owner-1' });
      seedQueue(room);
      const originalFetch = global.fetch;
      const resolvers = [];
      global.fetch = () => new Promise((resolve) => resolvers.push(resolve));
      try {
        const ws = mockWs({ id: 'owner-1' });
        const p1 = room.handlePlaybackError(ws, { videoId: 'vidA', errorCode: 100 });
        const p2 = room.handlePlaybackError(ws, { videoId: 'vidA', errorCode: 100 });
        assert.equal(resolvers.length, 1, 'second concurrent check should be deduped');
        resolvers.forEach((resolve) => resolve(goneResponse));
        await Promise.all([p1, p2]);
        assert.equal(room.state.currentTrack.videoId, 'vidB');
        assert.equal(room.state.queue.length, 2);
      } finally {
        global.fetch = originalFetch;
        room.destroy();
      }
    });

    it('should not skip the successor when the queue advanced during the API check', async () => {
      const room = new Room('pberr-advance', 'PB Advance', 'test-key', { owner_id: 'owner-1' });
      seedQueue(room);
      const originalFetch = global.fetch;
      let resolveFetch;
      global.fetch = () => new Promise((resolve) => { resolveFetch = resolve; });
      try {
        const ws = mockWs({ id: 'owner-1' });
        const pending = room.handlePlaybackError(ws, { videoId: 'vidA', errorCode: 100 });
        room.handleNextTrack(); // tick()-style auto-advance while the check is in flight
        assert.equal(room.state.currentTrack.videoId, 'vidB');
        resolveFetch(goneResponse);
        await pending;
        assert.equal(room.state.currentTrack.videoId, 'vidB', 'stale error must not skip the successor track');
        assert.equal(room.state.queue.length, 2);
      } finally {
        global.fetch = originalFetch;
        room.destroy();
      }
    });
  });

  describe('Broadcast', () => {
    it('should broadcast delta state on updateState', () => {
      const room = new Room('broadcast-room', 'Broadcast', null, { owner_id: 'owner-1' });
      const ws = mockWs({ id: 'guest-1', name: 'Guest' });
      room.addClient(ws);
      ws._messages.length = 0;

      room.updateState({ votesEnabled: false });
      assert.equal(ws._messages.length, 1);
      assert.equal(ws._messages[0].type, 'state_delta');
      assert.equal(ws._messages[0].payload.votesEnabled, false);
      room.destroy();
    });

    it('should not send to closed connections', () => {
      const room = new Room('closed-room', 'Closed', null, { owner_id: 'owner-1' });
      const ws = mockWs({ id: 'guest-1', name: 'Guest' });
      room.addClient(ws);
      ws.readyState = 3;
      ws._messages.length = 0;

      room.updateState({ musicOnly: true });
      assert.equal(ws._messages.length, 0);
      room.destroy();
    });
  });

  describe('Metadata Rehydration', () => {
    it('fills cleared title/artist on the now-playing track + queue and broadcasts', async () => {
      const room = new Room('rehydrate-room', 'Rehydrate', null, { owner_id: 'owner-1' });

      // Simulate state restored from a dormant room: valid video IDs, but title/
      // artist cleared by the 28-day cleanup. currentTrack mirrors queue[0] by id.
      room.state.currentTrack = { id: 'c1', videoId: 'VID_CUR', title: null, artist: null, score: 0, voters: {} };
      room.state.queue = [
        { id: 'c1', videoId: 'VID_CUR', title: null, artist: null, score: 0, voters: {} },
        { id: 'q2', videoId: 'VID_Q2', title: null, artist: null, score: 5, voters: { u1: 'up' } },
        { id: 'q3', videoId: 'VID_Q3', title: 'Already Titled', artist: 'Known', score: 0, voters: {} },
      ];

      // Stub the YouTube layer so the test needs no API key / network.
      const requested = [];
      room.checkVideoAvailability = async (ids) => {
        requested.push(...ids);
        return new Map(ids.map(id => [id, {
          title: 'Title ' + id, artist: 'Artist ' + id, thumbnail: 'http://thumb/' + id, duration: 123,
        }]));
      };

      const ws = mockWs({ id: 'guest-1', name: 'Guest' });
      room.clients.add(ws);

      await room.rehydrateVisibleMetadata();

      // Only the cleared tracks were fetched (already-titled q3 skipped; VID_CUR deduped).
      assert.deepEqual(requested.sort(), ['VID_CUR', 'VID_Q2']);

      // Title/artist filled in on now-playing + queue.
      assert.equal(room.state.currentTrack.title, 'Title VID_CUR');
      assert.equal(room.state.currentTrack.artist, 'Artist VID_CUR');
      assert.equal(room.state.queue[0].title, 'Title VID_CUR');
      assert.equal(room.state.queue[1].title, 'Title VID_Q2');

      // App data preserved.
      assert.equal(room.state.queue[1].score, 5);
      assert.deepEqual(room.state.queue[1].voters, { u1: 'up' });
      assert.equal(room.state.queue[1].videoId, 'VID_Q2');

      // Already-titled track untouched.
      assert.equal(room.state.queue[2].title, 'Already Titled');

      // A state_delta carrying the refreshed queue was broadcast to the client.
      const delta = ws._messages.find(m => m.type === 'state_delta' && m.payload && m.payload.queue);
      assert.ok(delta, 'expected a state_delta broadcast with the refreshed queue');
      assert.equal(delta.payload.queue[1].title, 'Title VID_Q2');

      room.destroy();
    });

    it('does not hit the API when no visible title is missing', async () => {
      const room = new Room('rehydrate-noop', 'NoOp', null, { owner_id: 'owner-1' });
      room.state.currentTrack = { id: 'c1', videoId: 'V1', title: 'Has Title', artist: 'A', score: 0, voters: {} };
      room.state.queue = [{ id: 'c1', videoId: 'V1', title: 'Has Title', artist: 'A', score: 0, voters: {} }];

      let called = false;
      room.checkVideoAvailability = async () => { called = true; return new Map(); };

      await room.rehydrateVisibleMetadata();
      assert.equal(called, false, 'should skip the API when nothing is missing');
      room.destroy();
    });

    it('drops an upcoming track the API confirmed is gone (id absent from the result)', async () => {
      const room = new Room('rehydrate-drop', 'Drop', null, { owner_id: 'owner-1' });

      // currentTrack already has a title, so only the two title-less queue items get queried.
      room.state.currentTrack = { id: 'c1', videoId: 'VID_CUR', title: 'Now Playing', artist: 'A', score: 0, voters: {} };
      room.state.queue = [
        { id: 'c1', videoId: 'VID_CUR', title: 'Now Playing', artist: 'A', score: 0, voters: {} },
        { id: 'q2', videoId: 'VID_GONE', title: null, artist: null, score: 0, voters: {} },     // deleted/private → absent
        { id: 'q3', videoId: 'VID_OK', title: null, artist: null, score: 2, voters: { u1: 'up' } }, // resolvable
      ];

      // Successful call: VID_OK resolves, VID_GONE is OMITTED (mirrors a deleted/private/
      // non-embeddable video, which checkVideoAvailability leaves out of the Map).
      const requested = [];
      room.checkVideoAvailability = async (ids) => {
        requested.push(...ids);
        const map = new Map();
        for (const id of ids) {
          if (id === 'VID_OK') map.set(id, { title: 'OK Title', artist: 'OK Artist', thumbnail: 'http://thumb/ok', duration: 100 });
          // VID_GONE intentionally omitted → absent → confirmed unavailable
        }
        return map;
      };

      const ws = mockWs({ id: 'guest-1', name: 'Guest' });
      room.clients.add(ws);

      await room.rehydrateVisibleMetadata();

      assert.deepEqual(requested.sort(), ['VID_GONE', 'VID_OK']);
      // Confirmed-gone track removed; current + resolvable track kept, in order.
      assert.deepEqual(room.state.queue.map(t => t.videoId), ['VID_CUR', 'VID_OK']);
      assert.equal(room.state.queue[1].title, 'OK Title', 'survivor got healed');
      assert.equal(room.state.queue[1].score, 2, 'app data preserved on survivor');
      // Now-playing untouched.
      assert.equal(room.state.currentTrack.videoId, 'VID_CUR');
      assert.equal(room.state.currentTrack.title, 'Now Playing');

      // The shortened queue was broadcast.
      const delta = ws._messages.find(m => m.type === 'state_delta' && m.payload && m.payload.queue);
      assert.ok(delta, 'expected a state_delta with the cleaned queue');
      assert.equal(delta.payload.queue.length, 2);

      room.destroy();
    });

    it('keeps a track the API could not verify (present-but-null: no key / quota / error)', async () => {
      const room = new Room('rehydrate-keep', 'Keep', null, { owner_id: 'owner-1' });
      room.state.currentTrack = { id: 'c1', videoId: 'VID_CUR', title: 'Now', artist: 'A', score: 0, voters: {} };
      room.state.queue = [
        { id: 'c1', videoId: 'VID_CUR', title: 'Now', artist: 'A', score: 0, voters: {} },
        { id: 'q2', videoId: 'VID_UNVERIFIED', title: null, artist: null, score: 3, voters: { u1: 'up' } },
      ];

      // "Couldn't verify": every id comes back present-with-null, exactly as
      // checkVideoAvailability does with no API key or on an HTTP/fetch error.
      room.checkVideoAvailability = async (ids) => new Map(ids.map(id => [id, null]));

      const ws = mockWs({ id: 'guest-1', name: 'Guest' });
      room.clients.add(ws);

      await room.rehydrateVisibleMetadata();

      // Unverifiable track is retained as a skeleton (retriable later), not dropped.
      assert.equal(room.state.queue.length, 2);
      assert.equal(room.state.queue[1].videoId, 'VID_UNVERIFIED');
      assert.equal(room.state.queue[1].title, null);
      assert.equal(room.state.queue[1].score, 3, 'app data preserved');

      room.destroy();
    });

    it('never drops the now-playing track even when the API reports it gone', async () => {
      const room = new Room('rehydrate-current-gone', 'CurGone', null, { owner_id: 'owner-1' });
      // currentTrack itself is a cleared skeleton AND will come back absent.
      room.state.currentTrack = { id: 'c1', videoId: 'VID_GONE', title: null, artist: null, score: 0, voters: {} };
      room.state.queue = [
        { id: 'c1', videoId: 'VID_GONE', title: null, artist: null, score: 0, voters: {} },
        { id: 'q2', videoId: 'VID_OK', title: null, artist: null, score: 0, voters: {} },
      ];

      room.checkVideoAvailability = async (ids) => {
        const map = new Map();
        for (const id of ids) {
          if (id === 'VID_OK') map.set(id, { title: 'OK', artist: 'A', thumbnail: 'http://thumb/ok', duration: 50 });
          // VID_GONE omitted → absent
        }
        return map;
      };

      const ws = mockWs({ id: 'guest-1', name: 'Guest' });
      room.clients.add(ws);

      await room.rehydrateVisibleMetadata();

      // queue[0] mirrors currentTrack, so it is preserved despite being confirmed gone —
      // tick()/skip logic relies on queue[0] === current. It stays a skeleton; the playing
      // copy is resolved through PLAYBACK_ERROR, not yanked mid-rehydrate.
      assert.equal(room.state.queue.length, 2, 'current mirror retained, rest healed');
      assert.equal(room.state.queue[0].videoId, 'VID_GONE');
      assert.equal(room.state.currentTrack.videoId, 'VID_GONE');
      assert.equal(room.state.queue[1].title, 'OK');

      room.destroy();
    });
  });
});
