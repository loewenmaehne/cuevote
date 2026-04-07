import Database from 'better-sqlite3';
import type { User, Session, RoomData, Video, RoomSettings, HistoryTrack, SavedRoomState } from './types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const logger = require('../logger');

const db = new Database('cuevote.db');
const log = logger;

db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    role TEXT DEFAULT 'user',
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
    password TEXT,
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
    data TEXT,
    fetched_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS room_history (
    room_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    played_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (room_id, video_id),
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY(video_id) REFERENCES videos(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS room_state (
    room_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    saved_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );
`);

// Migrations (idempotent)
const migrations = [
  "ALTER TABLE rooms ADD COLUMN captions_enabled INTEGER DEFAULT 0",
  "ALTER TABLE videos ADD COLUMN language TEXT",
  "ALTER TABLE rooms ADD COLUMN auto_refill INTEGER DEFAULT 1",
  "ALTER TABLE rooms ADD COLUMN language_flag TEXT DEFAULT 'international'",
  "ALTER TABLE rooms ADD COLUMN lobby_preview TEXT DEFAULT NULL",
  "ALTER TABLE rooms ADD COLUMN music_source TEXT DEFAULT 'youtube'",
  "ALTER TABLE videos ADD COLUMN source TEXT DEFAULT 'youtube'",
  "ALTER TABLE videos ADD COLUMN preview_url TEXT DEFAULT NULL",
];
for (const sql of migrations) {
  try { db.prepare(sql).run(); } catch { /* column already exists */ }
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_rooms_owner_last_active ON rooms(owner_id, last_active_at DESC);
  CREATE INDEX IF NOT EXISTS idx_rooms_public_last_active ON rooms(is_public, last_active_at DESC);
  CREATE INDEX IF NOT EXISTS idx_videos_fetched_at ON videos(fetched_at);
  CREATE INDEX IF NOT EXISTS idx_search_cache_created_at ON search_cache(created_at);
  CREATE INDEX IF NOT EXISTS idx_related_videos_fetched_at ON related_videos_cache(fetched_at);
`);

export function getUser(id: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getUserByEmail(email: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
}

export function upsertUser(user: Pick<User, 'id' | 'email' | 'name' | 'picture'>): User {
  db.prepare(`
    INSERT INTO users (id, email, name, picture)
    VALUES (@id, @email, @name, @picture)
    ON CONFLICT(id) DO UPDATE SET name = @name, picture = @picture
  `).run(user);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as User;
}

export function createSession(token: string, userId: string, expiresAt: number): void {
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
}

export function getSession(token: string): Session | undefined {
  return db.prepare(`
    SELECT s.*, u.name, u.email, u.picture, u.role
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, Math.floor(Date.now() / 1000)) as Session | undefined;
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function createRoom(room: Partial<RoomData>): RoomData {
  if (room.captions_enabled === undefined) room.captions_enabled = 0;
  if (room.language_flag === undefined) room.language_flag = 'international';
  if (room.music_source === undefined) room.music_source = 'youtube';
  db.prepare(`
    INSERT INTO rooms (id, name, description, owner_id, color, is_public, password, captions_enabled, language_flag, music_source)
    VALUES (@id, @name, @description, @owner_id, @color, @is_public, @password, @captions_enabled, @language_flag, @music_source)
  `).run(room);
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id) as RoomData;
}

export function deleteRoom(id: string) {
  return db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
}

export function getRoom(id: string): RoomData | undefined {
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as RoomData | undefined;
}

export function listPublicRooms(): RoomData[] {
  const activeDays = parseInt(process.env.ACTIVE_CHANNEL_DAYS || '60', 10);
  const threshold = Math.floor(Date.now() / 1000) - (activeDays * 24 * 60 * 60);
  return db.prepare('SELECT * FROM rooms WHERE is_public = 1 AND last_active_at > ? ORDER BY last_active_at DESC').all(threshold) as RoomData[];
}

export function listPrivateRooms(): RoomData[] {
  const activeDays = parseInt(process.env.ACTIVE_CHANNEL_DAYS || '60', 10);
  const threshold = Math.floor(Date.now() / 1000) - (activeDays * 24 * 60 * 60);
  return db.prepare('SELECT * FROM rooms WHERE is_public = 0 AND last_active_at > ? ORDER BY last_active_at DESC').all(threshold) as RoomData[];
}

export function listUserRooms(userId: string): RoomData[] {
  return db.prepare('SELECT * FROM rooms WHERE owner_id = ? ORDER BY last_active_at DESC').all(userId) as RoomData[];
}

export function updateRoomActivity(id: string): void {
  db.prepare('UPDATE rooms SET last_active_at = unixepoch() WHERE id = ?').run(id);
}

export function updateLobbyPreview(roomId: string, preview: { thumbnail: string; title: string; artist: string } | null): void {
  const json = preview ? JSON.stringify(preview) : null;
  db.prepare('UPDATE rooms SET lobby_preview = ? WHERE id = ?').run(json, roomId);
}

export function updateRoomSettings(id: string, settings: RoomSettings): void {
  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (settings.captions_enabled !== undefined) {
    updates.push("captions_enabled = ?");
    values.push(settings.captions_enabled ? 1 : 0);
  }
  if (settings.auto_refill !== undefined) {
    updates.push("auto_refill = ?");
    values.push(settings.auto_refill ? 1 : 0);
  }
  if (settings.language_flag !== undefined) {
    updates.push("language_flag = ?");
    values.push(settings.language_flag);
  }
  if (settings.music_source !== undefined) {
    updates.push("music_source = ?");
    values.push(settings.music_source);
  }

  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
}

export function upsertVideo(video: Partial<Video>): void {
  if (!video.source) video.source = 'youtube';
  if (video.preview_url === undefined) video.preview_url = null;
  db.prepare(`
    INSERT INTO videos (id, title, artist, thumbnail, duration, category_id, language, source, preview_url, fetched_at)
    VALUES (@id, @title, @artist, @thumbnail, @duration, @category_id, @language, @source, @preview_url, unixepoch())
    ON CONFLICT(id) DO UPDATE SET
      title = @title, artist = @artist, thumbnail = @thumbnail,
      duration = @duration, category_id = @category_id, language = @language, source = @source,
      preview_url = @preview_url, fetched_at = unixepoch()
  `).run(video);
}

export function getVideo(id: string): Video | undefined {
  return db.prepare('SELECT * FROM videos WHERE id = ?').get(id) as Video | undefined;
}

export function cacheSearchTerm(term: string, videoId: string): void {
  try {
    db.prepare(`
      INSERT INTO search_cache (term, video_id, created_at) VALUES (?, ?, unixepoch())
      ON CONFLICT(term) DO UPDATE SET video_id = excluded.video_id, created_at = unixepoch()
    `).run(term, videoId);
  } catch (err: any) {
    if (err.code !== 'SQLITE_CONSTRAINT_FOREIGNKEY') throw err;
  }
}

export function getSearchTermVideo(term: string): string | null {
  const row = db.prepare('SELECT video_id FROM search_cache WHERE term = ?').get(term) as { video_id: string } | undefined;
  return row ? row.video_id : null;
}

export function saveRelatedVideos(sourceVideoId: string, relatedVideos: unknown[]): void {
  const data = JSON.stringify(relatedVideos);
  db.prepare(`
    INSERT INTO related_videos_cache (source_video_id, data, fetched_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(source_video_id) DO UPDATE SET data = excluded.data, fetched_at = unixepoch()
  `).run(sourceVideoId, data);
}

export function getRelatedVideos(sourceVideoId: string): { data: unknown[]; fetched_at: number } | null {
  const row = db.prepare('SELECT data, fetched_at FROM related_videos_cache WHERE source_video_id = ?').get(sourceVideoId) as { data: string; fetched_at: number } | undefined;
  if (!row) return null;
  try {
    return { data: JSON.parse(row.data), fetched_at: row.fetched_at };
  } catch {
    log.error("Failed to parse related videos cache");
    return null;
  }
}

export function deleteUser(userId: string): boolean {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
  const userEmail = user?.email ?? null;
  log.info('[DB DELETE] Starting cleanup for user (ID redacted).');

  const transaction = db.transaction(() => {
    const s1 = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    const r1 = db.prepare('DELETE FROM rooms WHERE owner_id = ?').run(userId);
    const u1 = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    let u2 = { changes: 0 };
    if (userEmail) {
      u2 = db.prepare('DELETE FROM users WHERE email = ? AND id != ?').run(userEmail, userId);
    }
    log.info(`[DB DELETE] Result - Sessions: ${s1.changes}, Rooms: ${r1.changes}, Users(ID): ${u1.changes}, Users(Email cleanup): ${u2.changes}`);
  });

  try {
    transaction();
    db.pragma('wal_checkpoint(TRUNCATE)');
    return true;
  } catch (err) {
    log.error({ err }, "[DB] deleteUser Transaction Failed");
    throw err;
  }
}

export function backup(destination: string): Promise<Database.BackupMetadata> {
  return db.backup(destination);
}

export function addToRoomHistory(roomId: string, track: Partial<HistoryTrack>): void {
  const sourceId = track.videoId || track.trackId;
  if (!sourceId) return;

  const isSpotify = track.source === 'spotify';
  const dbId = isSpotify ? `sp:${track.trackId}` : track.videoId!;

  upsertVideo({
    id: dbId,
    title: track.title ?? null,
    artist: track.artist ?? null,
    thumbnail: track.thumbnail ?? null,
    duration: track.duration ?? null,
    category_id: track.category_id || (isSpotify ? null : '10'),
    language: track.language || null,
    source: track.source || 'youtube',
    preview_url: track.previewUrl ?? null,
  });
  const playedAt = track.playedAt ? Math.floor(track.playedAt / 1000) : Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO room_history (room_id, video_id, played_at) VALUES (?, ?, ?)
    ON CONFLICT(room_id, video_id) DO UPDATE SET played_at = excluded.played_at
  `).run(roomId, dbId, playedAt);
}

export function getRoomHistory(roomId: string): HistoryTrack[] {
  const rows = db.prepare(`
    SELECT v.*, h.played_at FROM room_history h
    JOIN videos v ON h.video_id = v.id WHERE h.room_id = ? ORDER BY h.played_at ASC
  `).all(roomId) as (Video & { played_at: number })[];
  return rows.map(row => {
    const isSpotify = row.source === 'spotify';
    const rawId = isSpotify ? row.id.replace(/^sp:/, '') : row.id;
    return {
      ...row,
      videoId: isSpotify ? undefined : rawId,
      trackId: isSpotify ? rawId : undefined,
      previewUrl: row.preview_url || null,
      source: row.source || 'youtube',
      playedAt: row.played_at * 1000,
    };
  });
}

export function removeFromRoomHistory(roomId: string, videoId: string): void {
  db.prepare('DELETE FROM room_history WHERE room_id = ? AND video_id = ?').run(roomId, videoId);
}

export function cleanupExpiredSessions(): number {
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  log.info(`[DB Cleanup] Removed ${result.changes} expired sessions.`);
  return result.changes;
}

export function saveRoomState(roomId: string, state: Partial<SavedRoomState>): void {
  const minimal = {
    queue: state.queue || [],
    currentTrack: state.currentTrack || null,
    progress: state.progress || 0,
    isPlaying: state.isPlaying || false,
  };
  const json = JSON.stringify(minimal);
  db.prepare(`
    INSERT INTO room_state (room_id, state_json, saved_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(room_id) DO UPDATE SET state_json = excluded.state_json, saved_at = unixepoch()
  `).run(roomId, json);
}

export function loadRoomState(roomId: string): SavedRoomState | null {
  const row = db.prepare('SELECT state_json, saved_at FROM room_state WHERE room_id = ?').get(roomId) as { state_json: string } | undefined;
  if (!row) return null;
  try { return JSON.parse(row.state_json); } catch { return null; }
}

export function deleteRoomState(roomId: string): void {
  db.prepare('DELETE FROM room_state WHERE room_id = ?').run(roomId);
}

export function cleanupRoomHistory(): number { return 0; }

export function cleanupStaleVideoMetadata(): number {
  // YouTube API TOS: clear stale metadata after 28 days.
  // Spotify has no such requirement — skip Spotify entries to preserve metadata.
  const threshold = Math.floor(Date.now() / 1000) - (28 * 24 * 60 * 60);
  const result = db.prepare(`
    UPDATE videos SET title = NULL, artist = NULL, thumbnail = NULL,
    duration = NULL, category_id = NULL, language = NULL
    WHERE fetched_at < ? AND title IS NOT NULL
    AND (source IS NULL OR source != 'spotify')
  `).run(threshold);
  log.info(`[DB Cleanup] Cleared metadata from ${result.changes} stale video entries (YouTube only).`);
  return result.changes;
}

export function cleanupSearchCache(): number {
  // YouTube API TOS: 28-day TTL for cached search results.
  // Spotify search mappings (sp: prefix) are exempt — no TOS restriction.
  const threshold = Math.floor(Date.now() / 1000) - (28 * 24 * 60 * 60);
  const result = db.prepare("DELETE FROM search_cache WHERE created_at < ? AND term NOT LIKE 'sp:%'").run(threshold);
  log.info(`[DB Cleanup] Removed ${result.changes} stale search cache entries (YouTube only).`);
  return result.changes;
}

export function cleanupRelatedVideosCache(): number {
  // YouTube API TOS: 28-day TTL for cached related videos.
  // Spotify recommendations (sp: prefix) are exempt — no TOS restriction.
  const threshold = Math.floor(Date.now() / 1000) - (28 * 24 * 60 * 60);
  const result = db.prepare("DELETE FROM related_videos_cache WHERE fetched_at < ? AND source_video_id NOT LIKE 'sp:%'").run(threshold);
  log.info(`[DB Cleanup] Removed ${result.changes} stale related videos cache entries (YouTube only).`);
  return result.changes;
}

export function cleanupEmptyRooms(): number {
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
  const result = db.prepare(`
    DELETE FROM rooms WHERE created_at < ?
    AND id NOT IN (SELECT DISTINCT room_id FROM room_history)
  `).run(sevenDaysAgo);
  if (result.changes > 0) {
    log.info(`[DB Cleanup] Deleted ${result.changes} empty channels older than 7 days.`);
  }
  return result.changes;
}
