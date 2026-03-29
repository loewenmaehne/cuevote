// Worker thread for non-blocking DB write operations.
// Owns a separate SQLite connection (WAL mode supports concurrent readers/writers).
// Receives fire-and-forget messages from the main thread for heavy or periodic writes.
const { parentPort } = require('worker_threads');
const Database = require('better-sqlite3');
const logger = require('./logger');

const db = new Database('cuevote.db');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

// Pre-compiled prepared statements for hot-path operations
const upsertVideoStmt = db.prepare(`
  INSERT INTO videos (id, title, artist, thumbnail, duration, category_id, language, fetched_at)
  VALUES (@id, @title, @artist, @thumbnail, @duration, @category_id, @language, unixepoch())
  ON CONFLICT(id) DO UPDATE SET
    title = @title, artist = @artist, thumbnail = @thumbnail,
    duration = @duration, category_id = @category_id, language = @language,
    fetched_at = unixepoch()
`);

const insertHistoryStmt = db.prepare(`
  INSERT INTO room_history (room_id, video_id, played_at)
  VALUES (?, ?, ?)
  ON CONFLICT(room_id, video_id) DO UPDATE SET
    played_at = excluded.played_at
`);

const saveRoomStateStmt = db.prepare(`
  INSERT INTO room_state (room_id, state_json, saved_at)
  VALUES (?, ?, unixepoch())
  ON CONFLICT(room_id) DO UPDATE SET
    state_json = excluded.state_json,
    saved_at = unixepoch()
`);

const updateRoomActivityStmt = db.prepare(
  'UPDATE rooms SET last_active_at = unixepoch() WHERE id = ?'
);

// Transactions
const addToRoomHistoryTx = db.transaction((roomId, track) => {
  upsertVideoStmt.run({
    id: track.videoId,
    title: track.title || null,
    artist: track.artist || null,
    thumbnail: track.thumbnail || null,
    duration: track.duration || null,
    category_id: track.category_id || '10',
    language: track.language || null
  });
  const playedAt = track.playedAt
    ? Math.floor(track.playedAt / 1000)
    : Math.floor(Date.now() / 1000);
  insertHistoryStmt.run(roomId, track.videoId, playedAt);
});

const saveRoomStateAndActivityTx = db.transaction((roomId, stateJson) => {
  saveRoomStateStmt.run(roomId, stateJson);
  updateRoomActivityStmt.run(roomId);
});

const runDailyCleanupTx = db.transaction(() => {
  const now = Math.floor(Date.now() / 1000);
  const twentyEightDays = now - (28 * 24 * 60 * 60);
  const sevenDays = now - (7 * 24 * 60 * 60);

  const s1 = db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  logger.info(`[DB Worker Cleanup] Removed ${s1.changes} expired sessions.`);

  const s2 = db.prepare(`
    UPDATE videos SET title = NULL, artist = NULL, thumbnail = NULL,
      duration = NULL, category_id = NULL, language = NULL
    WHERE fetched_at < ? AND title IS NOT NULL
  `).run(twentyEightDays);
  logger.info(`[DB Worker Cleanup] Cleared metadata from ${s2.changes} stale video entries.`);

  const s3 = db.prepare('DELETE FROM search_cache WHERE created_at < ?').run(twentyEightDays);
  logger.info(`[DB Worker Cleanup] Removed ${s3.changes} stale search cache entries.`);

  const s4 = db.prepare('DELETE FROM related_videos_cache WHERE fetched_at < ?').run(twentyEightDays);
  logger.info(`[DB Worker Cleanup] Removed ${s4.changes} stale related videos cache entries.`);

  const s5 = db.prepare(`
    DELETE FROM rooms WHERE created_at < ?
      AND id NOT IN (SELECT DISTINCT room_id FROM room_history)
  `).run(sevenDays);
  if (s5.changes > 0) {
    logger.info(`[DB Worker Cleanup] Deleted ${s5.changes} empty channels older than 7 days.`);
  }
});

// Message handler — all operations are fire-and-forget
parentPort.on('message', (msg) => {
  try {
    switch (msg.op) {
      case 'addToRoomHistory':
        if (msg.track && msg.track.videoId) {
          addToRoomHistoryTx(msg.roomId, msg.track);
        }
        break;
      case 'saveRoomStateAndActivity': {
        const minimal = {
          queue: msg.state.queue || [],
          currentTrack: msg.state.currentTrack || null,
          progress: msg.state.progress || 0,
          isPlaying: msg.state.isPlaying || false,
        };
        saveRoomStateAndActivityTx(msg.roomId, JSON.stringify(minimal));
        break;
      }
      case 'saveRoomState': {
        const minimal = {
          queue: msg.state.queue || [],
          currentTrack: msg.state.currentTrack || null,
          progress: msg.state.progress || 0,
          isPlaying: msg.state.isPlaying || false,
        };
        saveRoomStateStmt.run(msg.roomId, JSON.stringify(minimal));
        break;
      }
      case 'runDailyCleanup':
        runDailyCleanupTx();
        break;
      case 'shutdown':
        db.close();
        process.exit(0);
        break;
    }
  } catch (err) {
    logger.error(`[DB Worker] ${msg.op} failed:`, err.message);
  }
});

logger.info('[DB Worker] Ready.');
