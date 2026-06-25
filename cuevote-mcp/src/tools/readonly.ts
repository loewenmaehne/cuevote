// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Phase 1a: read-only ops tools backed directly by the SQLite file.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  listRooms,
  getRoom,
  getRoomHistory,
  findUser,
  platformStats,
  dbHealth,
} from "../db.js";
import { ok, fail, guard, table, tsAgo, bytes, duration } from "../util.js";

export function registerReadonlyTools(server: McpServer): void {
  server.registerTool(
    "list_rooms",
    {
      title: "List CueVote rooms",
      description:
        "List rooms from the database. filter: active (default, recently used), " +
        "public, private, or all. Owner email is never shown here — use find_user.",
      inputSchema: {
        filter: z.enum(["active", "public", "private", "all"]).default("active"),
        limit: z.number().int().min(1).max(200).default(25),
      },
    },
    ({ filter, limit }) =>
      guard(() => {
        const rooms = listRooms(filter, limit);
        if (rooms.length === 0) return ok(`No rooms matched filter="${filter}".`);
        const rows = rooms.map((r) => [
          r.id,
          r.name,
          r.owner_name ?? "—",
          r.is_public ? "public" : "private",
          r.password ? "🔒" : "",
          tsAgo(r.last_active_at),
        ]);
        return ok(
          `${rooms.length} room(s), filter="${filter}":\n\n` +
            table(["id", "name", "owner", "visibility", "pw", "last active"], rows),
        );
      })(),
  );

  server.registerTool(
    "get_room",
    {
      title: "Get room detail",
      description:
        "Room metadata + persisted playback snapshot (from room_state) + history " +
        "size. NOTE: the snapshot is a periodic checkpoint and may be up to ~30s " +
        "stale; for the true live state use get_live_room (needs the admin API).",
      inputSchema: { roomId: z.string().min(1).max(200) },
    },
    ({ roomId }) =>
      guard(() => {
        const d = getRoom(roomId);
        if (!d) return fail(`Room not found: ${roomId}`);
        const r = d.room;
        const lines: string[] = [
          `Room:        ${r.name} (${r.id})`,
          `Owner:       ${r.owner_name ?? "—"} (${r.owner_id})`,
          `Visibility:  ${r.is_public ? "public" : "private"}${r.is_protected ? " · password-protected" : ""}`,
          `Description: ${r.description ?? "—"}`,
          `Language:    ${r.language_flag ?? "international"}`,
          `Created:     ${tsAgo(Number(r.created_at))}`,
          `Last active: ${tsAgo(Number(r.last_active_at))}`,
          `History:     ${d.historyCount} track(s) in library`,
        ];
        if (d.snapshot && typeof d.snapshot === "object") {
          const s = d.snapshot as {
            queue?: unknown[];
            currentTrack?: { title?: string; artist?: string } | null;
            isPlaying?: boolean;
            progress?: number;
          };
          lines.push("");
          lines.push(`Snapshot (${d.snapshotAgeS}s old, may be stale):`);
          lines.push(`  Now playing: ${s.currentTrack?.title ?? "—"}${s.currentTrack?.artist ? " — " + s.currentTrack.artist : ""}`);
          lines.push(`  Playing:     ${s.isPlaying ? "yes" : "no"} @ ${duration(s.progress)}`);
          lines.push(`  Queue:       ${Array.isArray(s.queue) ? s.queue.length : 0} track(s)`);
        } else {
          lines.push("");
          lines.push("Snapshot:    none persisted (room never checkpointed).");
        }
        return ok(lines.join("\n"));
      })(),
  );

  server.registerTool(
    "get_room_history",
    {
      title: "Get room play history",
      description:
        "Recently played tracks for a room (the Auto-DJ / library pool), newest first. " +
        "Titles may be blank for entries older than 28 days (YouTube TOS retention).",
      inputSchema: {
        roomId: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(200).default(20),
      },
    },
    ({ roomId, limit }) =>
      guard(() => {
        const items = getRoomHistory(roomId, limit);
        if (items.length === 0) return ok(`No history for room ${roomId}.`);
        const rows = items.map((h) => [
          h.title ?? "(metadata cleared)",
          h.artist ?? "—",
          duration(h.duration),
          tsAgo(h.played_at),
        ]);
        return ok(
          `${items.length} track(s) for ${roomId}:\n\n` +
            table(["title", "artist", "len", "played"], rows),
        );
      })(),
  );

  server.registerTool(
    "find_user",
    {
      title: "Find a user (PII)",
      description:
        "Look up a user by Google id or email. Returns email (PERSONAL DATA) plus " +
        "owned-room and active-session counts. Use only when you need to identify " +
        "an account (e.g. support or a GDPR request).",
      inputSchema: { query: z.string().min(1).max(320) },
    },
    ({ query }) =>
      guard(() => {
        const d = findUser(query.trim());
        if (!d) return fail(`No user matches "${query}".`);
        const u = d.user;
        return ok(
          [
            `User:            ${u.name ?? "—"}`,
            `ID:              ${u.id}`,
            `Email:           ${u.email}`,
            `Role:            ${u.role ?? "user"}`,
            `Created:         ${tsAgo(u.created_at)}`,
            `Owned rooms:     ${d.ownedRooms}`,
            `Active sessions: ${d.activeSessions}`,
          ].join("\n"),
        );
      })(),
  );

  server.registerTool(
    "platform_stats",
    {
      title: "Platform statistics",
      description: "Aggregate counts across users, rooms, videos and sessions.",
      inputSchema: {},
    },
    () =>
      guard(() => {
        const s = platformStats();
        return ok(
          [
            `Users:             ${s.users}`,
            `Rooms (total):     ${s.rooms_total}  (public ${s.rooms_public}, private ${s.rooms_private}, protected ${s.rooms_protected})`,
            `Rooms (active):    ${s.rooms_active}`,
            `Videos cached:     ${s.videos_cached}`,
            `Active sessions:   ${s.sessions_active}`,
            `Persisted states:  ${s.room_states}`,
            `DB file size:      ${bytes(s.db_size_bytes)}`,
          ].join("\n"),
        );
      })(),
  );

  server.registerTool(
    "db_health",
    {
      title: "Database / retention health",
      description:
        "Read-only view of cache sizes and 28-day YouTube-TOS retention pressure " +
        "(mirrors the server's daily cleanup, without mutating anything).",
      inputSchema: {},
    },
    () =>
      guard(() => {
        const h = dbHealth();
        return ok(
          [
            `Stale video metadata (>28d, not yet cleared): ${h.stale_video_metadata}`,
            `Search cache:        ${h.search_cache_total} (stale ${h.search_cache_stale})`,
            `Related-video cache: ${h.related_cache_total} (stale ${h.related_cache_stale})`,
            `Room-state snapshots stale (>28d):            ${h.room_state_stale}`,
            `Expired sessions awaiting cleanup:            ${h.expired_sessions}`,
            `WAL file size:       ${bytes(h.wal_size_bytes)}`,
          ].join("\n"),
        );
      })(),
  );
}
