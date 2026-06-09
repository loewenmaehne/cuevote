// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let db;

describe('Database Module', () => {
  before(() => {
    process.env.NODE_ENV = 'test';
    const testDir = __dirname;
    const dbFile = path.join(testDir, 'cuevote.db');
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(dbFile + suffix); } catch {}
    }
    process.chdir(testDir);
    db = require('../db');
  });

  after(() => {
    const dbFile = path.join(__dirname, 'cuevote.db');
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(dbFile + suffix); } catch {}
    }
  });

  describe('User CRUD', () => {
    it('should upsert and retrieve a user', () => {
      const user = db.upsertUser({
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
      });
      assert.equal(user.id, 'test-user-1');
      assert.equal(user.email, 'test@example.com');
      assert.equal(user.name, 'Test User');
    });

    it('should get user by ID', () => {
            const user = db.getUser('test-user-1');
      assert.ok(user);
      assert.equal(user.name, 'Test User');
    });

    it('should get user by email', () => {
            const user = db.getUserByEmail('test@example.com');
      assert.ok(user);
      assert.equal(user.id, 'test-user-1');
    });

    it('should update user on conflict', () => {
            db.upsertUser({
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Updated Name',
        picture: 'https://example.com/new.jpg',
      });
      const user = db.getUser('test-user-1');
      assert.equal(user.name, 'Updated Name');
    });
  });

  describe('Session Management', () => {
    it('should create and retrieve a session', () => {
            const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      db.createSession('test-session-1', 'test-user-1', expiresAt);
      const session = db.getSession('test-session-1');
      assert.ok(session);
      assert.equal(session.user_id, 'test-user-1');
    });

    it('should not return expired sessions', () => {
            const pastExpiry = Math.floor(Date.now() / 1000) - 100;
      db.createSession('expired-session', 'test-user-1', pastExpiry);
      const session = db.getSession('expired-session');
      assert.equal(session, undefined);
    });

    it('should delete a session', () => {
            db.deleteSession('test-session-1');
      const session = db.getSession('test-session-1');
      assert.equal(session, undefined);
    });

    it('should cleanup expired sessions', () => {
            const count = db.cleanupExpiredSessions();
      assert.ok(count >= 0);
    });
  });

  describe('Room Management', () => {
    it('should create a room', () => {
            const room = db.createRoom({
        id: 'test-room-1',
        name: 'Test Room',
        description: 'A test room',
        owner_id: 'test-user-1',
        color: 'from-blue-500 to-purple-500',
        is_public: 1,
        password: null,
      });
      assert.ok(room);
      assert.equal(room.name, 'Test Room');
    });

    it('should retrieve a room', () => {
            const room = db.getRoom('test-room-1');
      assert.ok(room);
      assert.equal(room.owner_id, 'test-user-1');
    });

    it('should list public rooms', () => {
            const rooms = db.listPublicRooms();
      assert.ok(Array.isArray(rooms));
      const found = rooms.find(r => r.id === 'test-room-1');
      assert.ok(found);
    });

    it('should list user rooms', () => {
            const rooms = db.listUserRooms('test-user-1');
      assert.ok(rooms.length >= 1);
    });

    it('should update room activity', () => {
            db.updateRoomActivity('test-room-1');
      const room = db.getRoom('test-room-1');
      assert.ok(room.last_active_at > 0);
    });

    it('should update room settings', () => {
            db.updateRoomSettings('test-room-1', { captions_enabled: true });
      const room = db.getRoom('test-room-1');
      assert.equal(room.captions_enabled, 1);
    });

    it('should delete a room', () => {
            db.createRoom({
        id: 'room-to-delete',
        name: 'Deletable Room',
        description: '',
        owner_id: 'test-user-1',
        color: 'red',
        is_public: 1,
        password: null,
      });
      const result = db.deleteRoom('room-to-delete');
      assert.equal(result.changes, 1);
      assert.equal(db.getRoom('room-to-delete'), undefined);
    });
  });

  describe('Video Caching', () => {
    it('should upsert and retrieve a video', () => {
            db.upsertVideo({
        id: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        artist: 'Rick Astley',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        duration: 213,
        category_id: '10',
        language: 'en',
      });
      const video = db.getVideo('dQw4w9WgXcQ');
      assert.ok(video);
      assert.equal(video.title, 'Never Gonna Give You Up');
      assert.equal(video.duration, 213);
    });

    it('should cache and retrieve search terms', () => {
            db.cacheSearchTerm('rick astley', 'dQw4w9WgXcQ');
      const videoId = db.getSearchTermVideo('rick astley');
      assert.equal(videoId, 'dQw4w9WgXcQ');
    });

    it('should return null for unknown search terms', () => {
            const videoId = db.getSearchTermVideo('nonexistent search');
      assert.equal(videoId, null);
    });
  });

  describe('Room History', () => {
    it('should add to and retrieve room history', () => {
            db.addToRoomHistory('test-room-1', {
        videoId: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        artist: 'Rick Astley',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        duration: 213,
        playedAt: Date.now(),
      });
      const history = db.getRoomHistory('test-room-1');
      assert.ok(history.length >= 1);
      assert.equal(history[0].videoId, 'dQw4w9WgXcQ');
    });

    it('should remove from room history', () => {
            db.removeFromRoomHistory('test-room-1', 'dQw4w9WgXcQ');
      const history = db.getRoomHistory('test-room-1');
      const found = history.find(h => h.videoId === 'dQw4w9WgXcQ');
      assert.equal(found, undefined);
    });
  });

  describe('Room State Persistence', () => {
    it('should save and load room state', () => {
            const state = {
        queue: [{ id: '1', videoId: 'abc', title: 'Test', score: 0 }],
        currentTrack: null,
        progress: 42,
        isPlaying: false,
      };
      db.saveRoomState('test-room-1', state);
      const loaded = db.loadRoomState('test-room-1');
      assert.ok(loaded);
      assert.equal(loaded.progress, 42);
      assert.equal(loaded.queue.length, 1);
    });

    it('should delete room state', () => {
            db.deleteRoomState('test-room-1');
      const loaded = db.loadRoomState('test-room-1');
      assert.equal(loaded, null);
    });
  });

  describe('GDPR Account Deletion', () => {
    it('should delete user and all associated data', () => {
            const userId = 'gdpr-test-user';
      db.upsertUser({
        id: userId,
        email: 'gdpr@example.com',
        name: 'GDPR User',
        picture: '',
      });
      db.createSession('gdpr-session', userId, Math.floor(Date.now() / 1000) + 3600);
      db.createRoom({
        id: 'gdpr-room',
        name: 'GDPR Room',
        description: '',
        owner_id: userId,
        color: 'red',
        is_public: 1,
        password: null,
      });

      const result = db.deleteUser(userId);
      assert.equal(result, true);

      assert.equal(db.getUser(userId), undefined);
      assert.equal(db.getSession('gdpr-session'), undefined);
      assert.equal(db.getRoom('gdpr-room'), undefined);
      assert.equal(db.getUserByEmail('gdpr@example.com'), undefined);
    });
  });

  describe('Cleanup Functions', () => {
    it('should run cleanupStaleVideoMetadata without error', () => {
            const count = db.cleanupStaleVideoMetadata();
      assert.ok(count >= 0);
    });

    it('should run cleanupSearchCache without error', () => {
            const count = db.cleanupSearchCache();
      assert.ok(count >= 0);
    });

    it('should run cleanupRelatedVideosCache without error', () => {
            const count = db.cleanupRelatedVideosCache();
      assert.ok(count >= 0);
    });

    it('should run cleanupEmptyRooms without error', () => {
            const count = db.cleanupEmptyRooms();
      assert.ok(count >= 0);
    });

    it('should clear lobby previews of dormant rooms but keep active ones', () => {
      db.upsertUser({ id: 'preview-owner', email: 'preview@example.com', name: 'Preview Owner', picture: '' });
      const preview = { videoId: 'abc123', title: 'Cached Title', artist: 'Cached Artist', thumbnail: 'https://i.ytimg.com/x.jpg' };
      for (const id of ['preview-room-active', 'preview-room-dormant']) {
        db.createRoom({ id, name: id, description: '', owner_id: 'preview-owner', color: 'red', is_public: 1, password: null });
        db.updateLobbyPreview(id, preview);
      }

      // Backdate the dormant room past the 28-day window via a second
      // connection (the module doesn't expose raw SQL, deliberately).
      const Database = require('better-sqlite3');
      const raw = new Database(path.join(__dirname, 'cuevote.db'));
      raw.prepare('UPDATE rooms SET last_active_at = ? WHERE id = ?')
        .run(Math.floor(Date.now() / 1000) - (29 * 24 * 60 * 60), 'preview-room-dormant');
      raw.close();

      const count = db.cleanupStaleLobbyPreviews();
      assert.ok(count >= 1);
      assert.equal(db.getRoom('preview-room-dormant').lobby_preview, null);
      assert.ok(db.getRoom('preview-room-active').lobby_preview);
    });
  });
});
