// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Phase 2: AI-DJ / guest control tools. These act AS the session-token user, so
// owner-only actions (skip, play/pause) only take effect if that user owns the
// joined room. Tools are prefixed cv_ to set them apart from the ops tools.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { bridge } from "../wsClient.js";
import { audit } from "../audit.js";
import { ok, fail, guard, table, duration } from "../util.js";

interface Track {
  id?: string;
  videoId?: string;
  title?: string;
  artist?: string;
  score?: number;
}

function queueTable(queue: Track[]): string {
  const upcoming = queue.slice(1); // index 0 mirrors currentTrack
  if (upcoming.length === 0) return "(queue empty)";
  const rows = upcoming.map((t, i) => [i + 1, t.title ?? "—", t.artist ?? "—", t.score ?? 0, t.id ?? ""]);
  return table(["#", "title", "artist", "score", "trackId"], rows);
}

function nowPlayingLine(state: any): string {
  const t = state?.currentTrack;
  if (!t) return "Nothing is playing.";
  return `${state.isPlaying ? "▶" : "⏸"} ${t.title} — ${t.artist} @ ${duration(state.progress)}`;
}

export function registerDjTools(server: McpServer): void {
  server.registerTool(
    "cv_list_rooms",
    {
      title: "List rooms (as a user)",
      description: "Browse CueVote rooms via the live API. scope: public (default), private, my_channels.",
      inputSchema: { scope: z.enum(["public", "private", "my_channels"]).optional() },
    },
    ({ scope }) =>
      guard(async () => {
        const list = (await bridge.listRooms(scope)) as Array<Record<string, any>>;
        if (!list?.length) return ok("No rooms found.");
        const rows = list.map((r) => [
          r.id,
          r.name,
          r.listeners ?? 0,
          r.is_protected ? "🔒" : "",
          r.currentTrack?.title ?? "—",
        ]);
        return ok(`${list.length} room(s):\n\n` + table(["id", "name", "👥", "pw", "now playing"], rows));
      })(),
  );

  server.registerTool(
    "cv_join_room",
    {
      title: "Join a room",
      description: "Connect to a room so the other cv_ tools act on it. Provide a password for protected rooms.",
      inputSchema: {
        roomId: z.string().min(1).max(200),
        password: z.string().max(72).optional(),
      },
    },
    ({ roomId, password }) =>
      guard(async () => {
        const state = await bridge.joinRoom(roomId, password);
        audit("cv_join_room", { userId: bridge.user?.id, roomId });
        const upcoming = Array.isArray(state.queue) ? Math.max(0, state.queue.length - 1) : 0;
        return ok(
          `Joined "${state.activeChannel ?? roomId}" as ${bridge.user?.name ?? "user"}.\n` +
            `${nowPlayingLine(state)}\nUpcoming in queue: ${upcoming}`,
        );
      })(),
  );

  server.registerTool(
    "cv_now_playing",
    {
      title: "What's playing now",
      description: "Show the current track and progress in the joined room.",
      inputSchema: {},
    },
    () =>
      guard(async () => {
        const state = await bridge.ensureJoined();
        return ok(nowPlayingLine(state));
      })(),
  );

  server.registerTool(
    "cv_get_queue",
    {
      title: "Show the queue",
      description: "List the upcoming tracks (with vote scores) in the joined room.",
      inputSchema: {},
    },
    () =>
      guard(async () => {
        const state = await bridge.ensureJoined();
        return ok(`${nowPlayingLine(state)}\n\n${queueTable(state.queue ?? [])}`);
      })(),
  );

  server.registerTool(
    "cv_suggest",
    {
      title: "Suggest a song",
      description:
        "Suggest a track by search terms or a YouTube URL. The server resolves it " +
        "via YouTube and adds it to the queue (or to pending approval in manual mode).",
      inputSchema: { query: z.string().min(1).max(500) },
    },
    ({ query }) =>
      guard(async () => {
        const res = await bridge.suggest(query);
        audit("cv_suggest", { userId: bridge.user?.id, roomId: bridge.roomId, query, ok: res.ok });
        if (!res.ok) return fail(`Suggestion rejected: ${res.error}`);
        const state = res.state ?? {};
        const pending = (state.pendingSuggestions ?? []).length;
        return ok(
          `Suggested "${query}".\n` +
            (pending ? `It's awaiting owner approval (${pending} pending).\n` : "") +
            `\n${queueTable(state.queue ?? [])}`,
        );
      })(),
  );

  server.registerTool(
    "cv_vote",
    {
      title: "Vote on a track",
      description: "Vote a queued track up or down (use cv_get_queue to find trackId).",
      inputSchema: {
        trackId: z.string().min(1).max(100),
        vote: z.enum(["up", "down"]),
      },
    },
    ({ trackId, vote }) =>
      guard(async () => {
        const res = await bridge.vote(trackId, vote);
        audit("cv_vote", { userId: bridge.user?.id, roomId: bridge.roomId, trackId, vote, ok: res.ok });
        if (!res.ok) return fail(`Vote rejected: ${res.error}`);
        const t = (res.state?.queue ?? []).find((x: Track) => x.id === trackId);
        return ok(`Voted ${vote} on ${trackId}.` + (t ? ` New score: ${t.score ?? 0}.` : ""));
      })(),
  );

  server.registerTool(
    "cv_skip",
    {
      title: "Skip current track (owner)",
      description: "Skip the now-playing track. Only works if the session user owns the room.",
      inputSchema: {},
    },
    () =>
      guard(async () => {
        const state = await bridge.skip();
        audit("cv_skip", { userId: bridge.user?.id, roomId: bridge.roomId });
        return ok(`Skip sent.\n${nowPlayingLine(state)}\n(No effect unless you own this room.)`);
      })(),
  );

  server.registerTool(
    "cv_play_pause",
    {
      title: "Play / pause (owner)",
      description: "Resume or pause playback. Only works if the session user owns the room.",
      inputSchema: { playing: z.boolean() },
    },
    ({ playing }) =>
      guard(async () => {
        const state = await bridge.playPause(playing);
        audit("cv_play_pause", { userId: bridge.user?.id, roomId: bridge.roomId, playing });
        return ok(`${playing ? "Play" : "Pause"} sent.\n${nowPlayingLine(state)}\n(No effect unless you own this room.)`);
      })(),
  );
}
