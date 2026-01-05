const Database = require('better-sqlite3');
const db = new Database('cuevote.db'); // Creates the file if missing

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- Google 'sub' ID
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    role TEXT DEFAULT 'user', -- 'admin', 'mod', 'user'
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id TEXT NOT NULL,
    is_public INTEGER DEFAULT 1,
    password TEXT, -- Optional password
    last_active_at INTEGER DEFAULT (unixepoch()),
    created_at INTEGER DEFAULT (unixepoch()),
    color TEXT DEFAULT 'from-gray-700 to-black',
    captions_enabled INTEGER DEFAULT 0,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    title TEXT,
    artist TEXT,
    thumbnail TEXT,
    duration INTEGER,
    category_id TEXT,
    language TEXT,
    fetched_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS search_cache (
    term TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY(video_id) REFERENCES videos(id)
  );

  CREATE TABLE IF NOT EXISTS related_videos_cache (
    source_video_id TEXT PRIMARY KEY,
    data TEXT, -- JSON Array of video objects
    fetched_at INTEGER DEFAULT (unixepoch())
  );
`);

// Migration: Add captions_enabled if missing
try {
  db.prepare("ALTER TABLE rooms ADD COLUMN captions_enabled INTEGER DEFAULT 0").run();
} catch (e) {
  // Ignore duplicate column error
}

// Migration: Add language if missing
try {
  db.prepare("ALTER TABLE videos ADD COLUMN language TEXT").run();
} catch (e) {
  // Ignore duplicate column error
}

module.exports = {
  getUser: (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  getUserByEmail: (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email),
  upsertUser: (user) => {
    const stmt = db.prepare(`
      INSERT INTO users (id, email, name, picture)
      VALUES (@id, @email, @name, @picture)
      ON CONFLICT(id) DO UPDATE SET
        name = @name,
        picture = @picture
    `);
    stmt.run(user);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  },
  createSession: (token, userId, expiresAt) => {
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  },
  getSession: (token) => {
    return db.prepare(`
        SELECT s.*, u.name, u.email, u.picture, u.role 
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > ?
    `).get(token, Math.floor(Date.now() / 1000));
  },
  deleteSession: (token) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },

  // Room Management
  createRoom: (room) => {
    const stmt = db.prepare(`
        INSERT INTO rooms (id, name, description, owner_id, color, is_public, password, captions_enabled)
        VALUES (@id, @name, @description, @owner_id, @color, @is_public, @password, @captions_enabled)
    `);
    // Ensure default
    if (room.captions_enabled === undefined) room.captions_enabled = 0;

    stmt.run(room);
    return db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id);
  },
  deleteRoom: (id) => db.prepare('DELETE FROM rooms WHERE id = ?').run(id),
  getRoom: (id) => db.prepare('SELECT * FROM rooms WHERE id = ?').get(id),
  listPublicRooms: () => {
    // Default 60 days, configurable via env
    const activeDays = parseInt(process.env.ACTIVE_CHANNEL_DAYS || '60', 10);
    const threshold = Math.floor(Date.now() / 1000) - (activeDays * 24 * 60 * 60);
    return db.prepare('SELECT * FROM rooms WHERE is_public = 1 AND last_active_at > ? ORDER BY last_active_at DESC').all(threshold);
  },
  listPrivateRooms: () => {
    const activeDays = parseInt(process.env.ACTIVE_CHANNEL_DAYS || '60', 10);
    const threshold = Math.floor(Date.now() / 1000) - (activeDays * 24 * 60 * 60);
    return db.prepare('SELECT * FROM rooms WHERE is_public = 0 AND last_active_at > ? ORDER BY last_active_at DESC').all(threshold);
  },
  listUserRooms: (userId) => {
    return db.prepare('SELECT * FROM rooms WHERE owner_id = ? ORDER BY last_active_at DESC').all(userId);
  },
  updateRoomActivity: (id) => {
    db.prepare('UPDATE rooms SET last_active_at = unixepoch() WHERE id = ?').run(id);
  },
  updateRoomSettings: (id, settings) => {
    const updates = [];
    const values = [];

    if (settings.captions_enabled !== undefined) {
      updates.push("captions_enabled = ?");
      values.push(settings.captions_enabled ? 1 : 0);
    }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
  },

  // Video Caching
  upsertVideo: (video) => {
    const stmt = db.prepare(`
      INSERT INTO videos (id, title, artist, thumbnail, duration, category_id, language, fetched_at)
      VALUES (@id, @title, @artist, @thumbnail, @duration, @category_id, @language, unixepoch())
      ON CONFLICT(id) DO UPDATE SET
        title = @title,
        artist = @artist,
        thumbnail = @thumbnail,
        duration = @duration,
        category_id = @category_id,
        language = @language,
        fetched_at = unixepoch()
    `);
    stmt.run(video);
  },
  getVideo: (id) => {
    return db.prepare('SELECT * FROM videos WHERE id = ?').get(id);
  },
  cacheSearchTerm: (term, videoId) => {
    const stmt = db.prepare(`
      INSERT INTO search_cache (term, video_id, created_at)
      VALUES (?, ?, unixepoch())
      ON CONFLICT(term) DO UPDATE SET
        video_id = excluded.video_id,
        created_at = unixepoch()
    `);
    stmt.run(term, videoId);
  },
  getSearchTermVideo: (term) => {
    const row = db.prepare('SELECT video_id FROM search_cache WHERE term = ?').get(term);
    return row ? row.video_id : null;
  },
  // Related Videos Caching
  saveRelatedVideos: (sourceVideoId, relatedVideos) => {
    const data = JSON.stringify(relatedVideos);
    const stmt = db.prepare(`
      INSERT INTO related_videos_cache (source_video_id, data, fetched_at)
      VALUES (?, ?, unixepoch())
      ON CONFLICT(source_video_id) DO UPDATE SET
        data = excluded.data,
        fetched_at = unixepoch()
    `);
    stmt.run(sourceVideoId, data);
  },
  getRelatedVideos: (sourceVideoId) => {
    const row = db.prepare('SELECT data, fetched_at FROM related_videos_cache WHERE source_video_id = ?').get(sourceVideoId);
    if (!row) return null;
    try {
      return {
        data: JSON.parse(row.data),
        fetched_at: row.fetched_at
      };
    } catch (e) {
      console.error("Failed to parse related videos cache:", e);
      return null;
    }
  },
  deleteUser: (userId) => {
    // 1. Get User Email for double-tap deletion (prevents email unique constraint zombies)
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    const userEmail = user ? user.email : null;

    console.log(`[DB DELETE] Starting cleanup for User ID: ${userId}, Email: ${userEmail}`);

    const transaction = db.transaction(() => {
      // Sessions
      const s1 = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

      // Rooms
      const r1 = db.prepare('DELETE FROM rooms WHERE owner_id = ?').run(userId);

      // Users (Primary ID)
      const u1 = db.prepare('DELETE FROM users WHERE id = ?').run(userId);

      // Users (Email cleanup explanation: If ID somehow changed or we have a zombie row with same email)
      let u2 = { changes: 0 };
      if (userEmail) {
        u2 = db.prepare('DELETE FROM users WHERE email = ? AND id != ?').run(userEmail, userId);
      }

      console.log(`[DB DELETE] Result - Sessions: ${s1.changes}, Rooms: ${r1.changes}, Users(ID): ${u1.changes}, Users(Email): ${u2.changes}`);
    });

    try {
      transaction();
      // FORCE synchronous write to disk and clear WAL
      db.pragma('wal_checkpoint(TRUNCATE)');
      return true;
    } catch (err) {
      console.error("[DB] deleteUser Transaction Failed:", err);
      throw err;
    }
  },

  backup: (destination) => {
    return db.backup(destination);
  }
};
