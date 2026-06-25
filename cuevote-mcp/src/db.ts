// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Read-only access to the cuevote-server SQLite database. WAL mode lets us read
// safely alongside the writing server process. Everything here is SELECT-only.
import Database from "better-sqlite3";
import { statSync, existsSync } from "node:fs";
import { config } from "./config.js";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!existsSync(config.dbPath)) {
    throw new Error(
      `CueVote DB not found at ${config.dbPath}. Set CUEVOTE_DB_PATH to the ` +
        `cuevote-server/cuevote.db file.`,
    );
  }
  _db = new Database(config.dbPath, { readonly: true, fileMustExist: true });
  _db.pragma("busy_timeout = 5000");
  return _db;
}

// Mirror the server's defaults (db.js / cleanup constants).
const ACTIVE_DAYS = Number(process.env.ACTIVE_CHANNEL_DAYS ?? 60);
const RETENTION_DAYS = 28;
const nowS = (): number => Math.floor(Date.now() / 1000);

export type RoomFilter = "active" | "public" | "private" | "all";

export interface RoomListItem {
  id: string;
  name: string;
  owner_id: string;
  owner_name: string | null;
  is_public: number;
  password: string | null;
  last_active_at: number;
  created_at: number;
}

export function listRooms(filter: RoomFilter, limit: number): RoomListItem[] {
  const db = getDb();
  const threshold = nowS() - ACTIVE_DAYS * 86400;
  let where = "1=1";
  const params: unknown[] = [];
  if (filter === "active") {
    where = "r.last_active_at > ?";
    params.push(threshold);
  } else if (filter === "public") {
    where = "r.is_public = 1";
  } else if (filter === "private") {
    where = "r.is_public = 0";
  }
  return db
    .prepare(
      `SELECT r.id, r.name, r.owner_id, u.name AS owner_name, r.is_public,
              r.password, r.last_active_at, r.created_at
         FROM rooms r LEFT JOIN users u ON r.owner_id = u.id
        WHERE ${where}
        ORDER BY r.last_active_at DESC
        LIMIT ?`,
    )
    .all(...params, limit) as RoomListItem[];
}

export interface RoomDetail {
  room: Record<string, unknown> & { owner_name: string | null };
  historyCount: number;
  snapshot: unknown;
  snapshotAgeS: number | null;
}

export function getRoom(roomId: string): RoomDetail | null {
  const db = getDb();
  const room = db
    .prepare(
      `SELECT r.*, u.name AS owner_name
         FROM rooms r LEFT JOIN users u ON r.owner_id = u.id
        WHERE r.id = ?`,
    )
    .get(roomId) as RoomDetail["room"] | undefined;
  if (!room) return null;

  const hc = db
    .prepare(`SELECT COUNT(*) AS c FROM room_history WHERE room_id = ?`)
    .get(roomId) as { c: number };
  const snap = db
    .prepare(`SELECT state_json, saved_at FROM room_state WHERE room_id = ?`)
    .get(roomId) as { state_json: string; saved_at: number } | undefined;

  let snapshot: unknown = null;
  let snapshotAgeS: number | null = null;
  if (snap) {
    try {
      snapshot = JSON.parse(snap.state_json);
    } catch {
      snapshot = null;
    }
    snapshotAgeS = nowS() - snap.saved_at;
  }
  return { room, historyCount: hc.c, snapshot, snapshotAgeS };
}

export interface HistoryItem {
  videoId: string;
  title: string | null;
  artist: string | null;
  duration: number | null;
  played_at: number;
}

export function getRoomHistory(roomId: string, limit: number): HistoryItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT v.id AS videoId, v.title, v.artist, v.duration, h.played_at
         FROM room_history h JOIN videos v ON h.video_id = v.id
        WHERE h.room_id = ?
        ORDER BY h.played_at DESC
        LIMIT ?`,
    )
    .all(roomId, limit) as HistoryItem[];
}

export interface UserDetail {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string | null;
    created_at: number;
  };
  ownedRooms: number;
  activeSessions: number;
}

export function findUser(key: string): UserDetail | null {
  const db = getDb();
  const user = db
    .prepare(`SELECT id, email, name, role, created_at FROM users WHERE id = ? OR email = ?`)
    .get(key, key) as UserDetail["user"] | undefined;
  if (!user) return null;
  const rc = db
    .prepare(`SELECT COUNT(*) AS c FROM rooms WHERE owner_id = ?`)
    .get(user.id) as { c: number };
  const sc = db
    .prepare(`SELECT COUNT(*) AS c FROM sessions WHERE user_id = ? AND expires_at > ?`)
    .get(user.id, nowS()) as { c: number };
  return { user, ownedRooms: rc.c, activeSessions: sc.c };
}

export function platformStats(): Record<string, number> {
  const db = getDb();
  const threshold = nowS() - ACTIVE_DAYS * 86400;
  const one = (sql: string, ...p: unknown[]): number =>
    (db.prepare(sql).get(...p) as { c: number }).c;
  return {
    users: one(`SELECT COUNT(*) c FROM users`),
    rooms_total: one(`SELECT COUNT(*) c FROM rooms`),
    rooms_public: one(`SELECT COUNT(*) c FROM rooms WHERE is_public = 1`),
    rooms_private: one(`SELECT COUNT(*) c FROM rooms WHERE is_public = 0`),
    rooms_active: one(`SELECT COUNT(*) c FROM rooms WHERE last_active_at > ?`, threshold),
    rooms_protected: one(`SELECT COUNT(*) c FROM rooms WHERE password IS NOT NULL`),
    videos_cached: one(`SELECT COUNT(*) c FROM videos`),
    sessions_active: one(`SELECT COUNT(*) c FROM sessions WHERE expires_at > ?`, nowS()),
    room_states: one(`SELECT COUNT(*) c FROM room_state`),
    db_size_bytes: statSync(config.dbPath).size,
  };
}

export function dbHealth(): Record<string, number> {
  const db = getDb();
  const ret = nowS() - RETENTION_DAYS * 86400;
  const one = (sql: string, ...p: unknown[]): number =>
    (db.prepare(sql).get(...p) as { c: number }).c;
  let walBytes = 0;
  try {
    walBytes = statSync(config.dbPath + "-wal").size;
  } catch {
    /* no WAL file */
  }
  return {
    stale_video_metadata: one(
      `SELECT COUNT(*) c FROM videos WHERE fetched_at < ? AND title IS NOT NULL`,
      ret,
    ),
    search_cache_total: one(`SELECT COUNT(*) c FROM search_cache`),
    search_cache_stale: one(`SELECT COUNT(*) c FROM search_cache WHERE created_at < ?`, ret),
    related_cache_total: one(`SELECT COUNT(*) c FROM related_videos_cache`),
    related_cache_stale: one(
      `SELECT COUNT(*) c FROM related_videos_cache WHERE fetched_at < ?`,
      ret,
    ),
    room_state_stale: one(`SELECT COUNT(*) c FROM room_state WHERE saved_at < ?`, ret),
    expired_sessions: one(`SELECT COUNT(*) c FROM sessions WHERE expires_at <= ?`, nowS()),
    wal_size_bytes: walBytes,
  };
}
