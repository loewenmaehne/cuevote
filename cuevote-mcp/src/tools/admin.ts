// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Phase 1b: live ops / moderation tools backed by the server admin API.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { adminClient, type AdminResponse } from "../adminClient.js";
import { audit } from "../audit.js";
import { ok, fail, guard, table, duration, type ToolResult } from "../util.js";

// Map an admin HTTP response to a clean tool result.
function mapErr(r: AdminResponse): ToolResult | null {
  if (r.status === 0)
    return fail(
      `Cannot reach the admin API: ${r.json?.message ?? "connection failed"}. ` +
        `Is cuevote-server running with ADMIN_TOKEN set, and is this MCP on the same host?`,
    );
  if (r.status === 401)
    return fail("Admin API rejected the token (401). Check CUEVOTE_ADMIN_TOKEN.");
  if (!r.ok)
    return fail(
      `Admin API error ${r.status}: ${r.json?.error ?? "unknown"}` +
        (r.json?.message ? ` — ${r.json.message}` : ""),
    );
  return null;
}

interface Track {
  title?: string;
  artist?: string;
  score?: number;
  suggestedByUsername?: string;
  id?: string;
  videoId?: string;
}

function trackRows(list: Track[] | undefined): (string | number)[][] {
  return (list ?? []).map((t, i) => [
    i + 1,
    t.title ?? "—",
    t.artist ?? "—",
    t.score ?? 0,
    t.id ?? t.videoId ?? "",
  ]);
}

export function registerAdminTools(server: McpServer): void {
  server.registerTool(
    "list_active_rooms",
    {
      title: "List live (in-memory) rooms",
      description:
        "Rooms currently loaded in the running server, with live listener counts " +
        "and now-playing. Differs from list_rooms (which reads the DB).",
      inputSchema: {},
    },
    () =>
      guard(async () => {
        const r = await adminClient.listRooms();
        const e = mapErr(r);
        if (e) return e;
        const rooms = r.json.rooms as Array<Record<string, any>>;
        if (rooms.length === 0) return ok("No rooms are currently loaded in memory.");
        const rows = rooms.map((x) => [
          x.id,
          x.name,
          x.listeners,
          x.isPlaying ? "▶" : "⏸",
          x.queueLength,
          x.pending,
          x.nowPlaying?.title ?? "—",
        ]);
        return ok(
          `${rooms.length} active room(s):\n\n` +
            table(["id", "name", "👥", "play", "queue", "pend", "now playing"], rows),
        );
      })(),
  );

  server.registerTool(
    "get_live_room",
    {
      title: "Get true live room state",
      description:
        "The real in-memory state of a room: queue with vote scores, now-playing, " +
        "pending suggestions, banned videos and key settings. Falls back to the " +
        "persisted snapshot if the room isn't currently loaded.",
      inputSchema: { roomId: z.string().min(1).max(200) },
    },
    ({ roomId }) =>
      guard(async () => {
        const r = await adminClient.getRoom(roomId);
        const e = mapErr(r);
        if (e) return e;
        if (r.json.active === false) {
          const m = r.json.metadata ?? {};
          const snap = r.json.snapshot;
          return ok(
            `Room ${roomId} is NOT loaded in memory.\n` +
              `Name: ${m.name ?? "—"} · owner ${m.owner_id ?? "—"} · ${m.is_protected ? "protected" : "open"}\n` +
              (snap
                ? `Persisted snapshot: queue ${snap.queue?.length ?? 0}, now-playing "${snap.currentTrack?.title ?? "—"}", playing ${snap.isPlaying ? "yes" : "no"}.`
                : "No persisted snapshot."),
          );
        }
        const s = r.json.state ?? {};
        const ct = s.currentTrack;
        const lines: string[] = [
          `Room:        ${r.json.metadata?.name ?? roomId} (${roomId})`,
          `Listeners:   ${r.json.listeners}`,
          `Now playing: ${ct ? `${ct.title} — ${ct.artist} @ ${duration(s.progress)}` : "—"} ${s.isPlaying ? "▶" : "⏸"}`,
          `Settings:    mode=${s.suggestionMode} · votes=${s.votesEnabled ? "on" : "off"} · autoRefill=${s.autoRefill ? "on" : "off"} · maxQueue=${s.maxQueueSize} · musicOnly=${s.musicOnly ? "yes" : "no"}`,
        ];
        const upcoming = Array.isArray(s.queue) ? s.queue.slice(1) : [];
        lines.push("", `Queue (${upcoming.length} upcoming):`);
        lines.push(
          upcoming.length
            ? table(["#", "title", "artist", "score", "trackId"], trackRows(upcoming))
            : "  (empty)",
        );
        if ((s.pendingSuggestions ?? []).length) {
          lines.push("", `Pending approval (${s.pendingSuggestions.length}):`);
          lines.push(table(["#", "title", "artist", "score", "trackId"], trackRows(s.pendingSuggestions)));
        }
        if ((s.bannedVideos ?? []).length) {
          lines.push("", `Banned (${s.bannedVideos.length}): ` + s.bannedVideos.map((b: Track) => b.title ?? b.videoId).join(", "));
        }
        return ok(lines.join("\n"));
      })(),
  );

  // ---- Reversible live moderation actions (audited, no confirm needed) ----
  const liveAction = (
    name: string,
    title: string,
    description: string,
    shape: z.ZodRawShape,
    toAction: (args: any) => { action: string; body?: unknown },
  ): void => {
    server.registerTool(name, { title, description, inputSchema: shape }, (args: any) =>
      guard(async () => {
        const { action, body } = toAction(args);
        const r = await adminClient.action(args.roomId, action, body);
        const e = mapErr(r);
        if (e) return e;
        audit(name, { roomId: args.roomId, ...args });
        return ok(`✓ ${action} on ${args.roomId}: ${JSON.stringify(r.json)}`);
      })(),
    );
  };

  liveAction(
    "skip_track",
    "Skip current track",
    "Skip the now-playing track in a live room (advances the queue).",
    { roomId: z.string().min(1).max(200) },
    () => ({ action: "skip" }),
  );
  liveAction(
    "pause_room",
    "Play / pause a room",
    "Set playback on/off for a live room.",
    { roomId: z.string().min(1).max(200), playing: z.boolean() },
    (a) => ({ action: "pause", body: { playing: a.playing } }),
  );
  liveAction(
    "ban_video",
    "Ban a pending suggestion",
    "Ban a pending suggestion (by trackId) from the room.",
    { roomId: z.string().min(1).max(200), trackId: z.string().min(1).max(100) },
    (a) => ({ action: "ban", body: { trackId: a.trackId } }),
  );
  liveAction(
    "unban_video",
    "Unban a video",
    "Remove a video (by videoId) from the room's banned list.",
    { roomId: z.string().min(1).max(200), videoId: z.string().min(1).max(50) },
    (a) => ({ action: "unban", body: { videoId: a.videoId } }),
  );
  liveAction(
    "approve_suggestion",
    "Approve a pending suggestion",
    "Approve a pending suggestion (manual mode) so it enters the queue.",
    { roomId: z.string().min(1).max(200), trackId: z.string().min(1).max(100) },
    (a) => ({ action: "approve", body: { trackId: a.trackId } }),
  );
  liveAction(
    "reject_suggestion",
    "Reject a pending suggestion",
    "Reject a pending suggestion (manual mode) without banning it.",
    { roomId: z.string().min(1).max(200), trackId: z.string().min(1).max(100) },
    (a) => ({ action: "reject", body: { trackId: a.trackId } }),
  );
  liveAction(
    "remove_from_queue",
    "Remove a queued track",
    "Remove a track (by trackId) from the room's queue.",
    { roomId: z.string().min(1).max(200), trackId: z.string().min(1).max(100) },
    (a) => ({ action: "remove", body: { trackId: a.trackId } }),
  );
  liveAction(
    "broadcast_notice",
    "Broadcast a notice",
    "Send an info message to everyone connected to a live room.",
    { roomId: z.string().min(1).max(200), message: z.string().min(1).max(500) },
    (a) => ({ action: "broadcast", body: { message: a.message } }),
  );

  // ---- Irreversible actions (require confirm: true, audited) ----
  server.registerTool(
    "delete_room",
    {
      title: "Delete a room (irreversible)",
      description:
        "Permanently delete a room from DB and memory. Requires confirm:true.",
      inputSchema: { roomId: z.string().min(1).max(200), confirm: z.boolean() },
    },
    ({ roomId, confirm }) =>
      guard(async () => {
        if (!confirm) return fail("Refusing to delete: pass confirm:true to proceed.");
        const r = await adminClient.deleteRoom(roomId);
        const e = mapErr(r);
        if (e) return e;
        audit("delete_room", { roomId, dbChanges: r.json.dbChanges });
        return ok(`✓ Deleted room ${roomId} (db changes: ${r.json.dbChanges}, was active: ${r.json.wasActive}).`);
      })(),
  );

  server.registerTool(
    "gdpr_delete_user",
    {
      title: "GDPR delete a user (irreversible)",
      description:
        "Erase a user (GDPR Art. 17): DB rows + owned rooms + in-memory scrub. " +
        "Use find_user first to confirm the id. Requires confirm:true.",
      inputSchema: { userId: z.string().min(1).max(200), confirm: z.boolean() },
    },
    ({ userId, confirm }) =>
      guard(async () => {
        if (!confirm) return fail("Refusing to delete: pass confirm:true to proceed.");
        const r = await adminClient.gdprDelete(userId);
        const e = mapErr(r);
        if (e) return e;
        audit("gdpr_delete_user", { userId, ...r.json });
        return ok(
          `✓ GDPR-deleted user ${userId}. DB deleted: ${r.json.dbDeleted}, ` +
            `rooms destroyed: ${r.json.destroyedRooms}, rooms scrubbed: ${r.json.scrubbedRooms}.`,
        );
      })(),
  );

  server.registerTool(
    "run_maintenance",
    {
      title: "Run a maintenance task",
      description:
        "Trigger server maintenance: 'cleanup' (daily retention sweep) or " +
        "'backup' (SQLite backup; optional dest path).",
      inputSchema: {
        task: z.enum(["cleanup", "backup"]),
        dest: z.string().max(500).optional(),
      },
    },
    ({ task, dest }) =>
      guard(async () => {
        const r = await adminClient.maintenance(task, task === "backup" ? { dest } : undefined);
        const e = mapErr(r);
        if (e) return e;
        audit("run_maintenance", { task, dest });
        return ok(`✓ ${task}: ${JSON.stringify(r.json)}`);
      })(),
  );
}
