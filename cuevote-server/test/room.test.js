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
});
