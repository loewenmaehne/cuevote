const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const schemas = require('../schemas');

describe('Zod Schemas', () => {
  describe('LoginPayload', () => {
    it('should accept valid token', () => {
      const result = schemas.LoginPayload.safeParse({ token: 'ya29.abcdef' });
      assert.ok(result.success);
    });

    it('should reject empty token', () => {
      const result = schemas.LoginPayload.safeParse({ token: '' });
      assert.ok(!result.success);
    });

    it('should reject missing token', () => {
      const result = schemas.LoginPayload.safeParse({});
      assert.ok(!result.success);
    });
  });

  describe('JoinRoomPayload', () => {
    it('should accept valid roomId', () => {
      const result = schemas.JoinRoomPayload.safeParse({ roomId: 'my-room-abc123' });
      assert.ok(result.success);
    });

    it('should accept roomId with password', () => {
      const result = schemas.JoinRoomPayload.safeParse({ roomId: 'room', password: 'secret' });
      assert.ok(result.success);
    });

    it('should reject empty roomId', () => {
      const result = schemas.JoinRoomPayload.safeParse({ roomId: '' });
      assert.ok(!result.success);
    });
  });

  describe('CreateRoomPayload', () => {
    it('should accept valid room creation', () => {
      const result = schemas.CreateRoomPayload.safeParse({
        name: 'My Room',
        description: 'A cool room',
        isPrivate: true,
        password: 'secret',
      });
      assert.ok(result.success);
    });

    it('should reject name over 100 chars', () => {
      const result = schemas.CreateRoomPayload.safeParse({ name: 'x'.repeat(101) });
      assert.ok(!result.success);
    });

    it('should reject missing name', () => {
      const result = schemas.CreateRoomPayload.safeParse({});
      assert.ok(!result.success);
    });
  });

  describe('VotePayload', () => {
    it('should accept valid upvote', () => {
      const result = schemas.VotePayload.safeParse({ trackId: 'abc-123', voteType: 'up' });
      assert.ok(result.success);
    });

    it('should accept valid downvote', () => {
      const result = schemas.VotePayload.safeParse({ trackId: 'abc-123', voteType: 'down' });
      assert.ok(result.success);
    });

    it('should reject invalid voteType', () => {
      const result = schemas.VotePayload.safeParse({ trackId: 'abc', voteType: 'sideways' });
      assert.ok(!result.success);
    });
  });

  describe('UpdateSettingsPayload', () => {
    it('should accept valid settings', () => {
      const result = schemas.UpdateSettingsPayload.safeParse({
        musicOnly: true,
        maxDuration: 600,
        maxQueueSize: 25,
      });
      assert.ok(result.success);
    });

    it('should reject empty object', () => {
      const result = schemas.UpdateSettingsPayload.safeParse({});
      assert.ok(!result.success);
    });

    it('should reject invalid suggestionMode', () => {
      const result = schemas.UpdateSettingsPayload.safeParse({ suggestionMode: 'chaos' });
      assert.ok(!result.success);
    });

    it('should reject negative maxDuration', () => {
      const result = schemas.UpdateSettingsPayload.safeParse({ maxDuration: -1 });
      assert.ok(!result.success);
    });
  });

  describe('SuggestSongPayload', () => {
    it('should accept valid query', () => {
      const result = schemas.SuggestSongPayload.safeParse({ query: 'rick astley' });
      assert.ok(result.success);
    });

    it('should accept YouTube URL', () => {
      const result = schemas.SuggestSongPayload.safeParse({
        query: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      });
      assert.ok(result.success);
    });

    it('should reject empty query', () => {
      const result = schemas.SuggestSongPayload.safeParse({ query: '' });
      assert.ok(!result.success);
    });
  });

  describe('WebSocketMessage', () => {
    it('should accept valid message', () => {
      const result = schemas.WebSocketMessage.safeParse({
        type: 'VOTE',
        payload: { trackId: '123', voteType: 'up' },
        msgId: 'msg-1',
      });
      assert.ok(result.success);
    });

    it('should accept message without payload', () => {
      const result = schemas.WebSocketMessage.safeParse({ type: 'PING' });
      assert.ok(result.success);
    });

    it('should reject missing type', () => {
      const result = schemas.WebSocketMessage.safeParse({ payload: {} });
      assert.ok(!result.success);
    });

    it('should reject empty type', () => {
      const result = schemas.WebSocketMessage.safeParse({ type: '' });
      assert.ok(!result.success);
    });
  });

  describe('SeekToPayload', () => {
    it('should accept valid number', () => {
      assert.ok(schemas.SeekToPayload.safeParse(42.5).success);
    });

    it('should reject negative', () => {
      assert.ok(!schemas.SeekToPayload.safeParse(-1).success);
    });

    it('should reject NaN', () => {
      assert.ok(!schemas.SeekToPayload.safeParse(NaN).success);
    });

    it('should reject Infinity', () => {
      assert.ok(!schemas.SeekToPayload.safeParse(Infinity).success);
    });
  });
});
