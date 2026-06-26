// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Phase 2: AI-DJ / guest control tools. These act AS the session-token user, so
// owner-only actions (skip, play/pause) only take effect if that user owns the
// joined room. Tools are prefixed cv_ to set them apart from the ops tools.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CueVoteBridge } from "../wsClient.js";
import { audit } from "../audit.js";
import { ok, fail, guard, table, duration } from "../util.js";

// Accept a YouTube watch URL or a bare 11-char video id and return the
// canonical watch URL, so the server resolves it via the cheap videos.list
// (~1 quota unit) instead of a Search-API call (~100). Returns null for
// anything else (free text), which the caller then gates behind an explicit
// opt-in + rate cap.
const YT_URL_RE =
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
function toCanonicalUrl(input: string): string | null {
  const s = input.trim();
  const m = s.match(YT_URL_RE);
  const id = m ? m[1] : /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null;
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

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

export function registerDjTools(server: McpServer, bridge: CueVoteBridge): void {
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
        "Add a song to the room by its YouTube URL. Find the URL yourself (e.g. with your web " +
        "search) and pass it in `query`: a real https://www.youtube.com/watch?v=… link or an " +
        "11-character video id. Do NOT pass a song title or free text — bare titles are rejected " +
        "by default, because the server-side title search (a) returns only the single top result, " +
        "which is often the wrong version (live/cover/lyric/sped-up), and (b) costs CueVote ~100× " +
        "the YouTube API quota of a direct URL lookup. Only if you truly cannot find a URL, retry " +
        "with allowServerSearch=true (a rate-limited last resort).",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(500)
          .describe("A YouTube watch URL or 11-char video id. Free text is only honored with allowServerSearch=true."),
        allowServerSearch: z
          .boolean()
          .optional()
          .describe(
            "Last resort. Set true ONLY if you genuinely cannot find a YouTube URL. Triggers a server " +
              "title search: lower quality (top result only) and ~100× the API quota. Prefer passing a URL.",
          ),
      },
    },
    ({ query, allowServerSearch }) =>
      guard(async () => {
        const canonical = toCanonicalUrl(query);
        // Free text (no URL/id resolved). Block it unless the caller explicitly
        // opted into the expensive fallback — and explain why, so a cooperative
        // model goes and finds the URL instead.
        if (!canonical && !allowServerSearch) {
          return fail(
            `"${query}" isn't a YouTube URL. Find the real watch URL yourself (e.g. via web search) and ` +
              "pass it. A bare title is rejected because the server search returns only the single top result " +
              "(often the wrong version) and costs ~100× the API quota. If you truly cannot find a URL, call " +
              "again with allowServerSearch=true.",
          );
        }
        // Hard ceiling on the expensive path — independent of the model behaving.
        if (!canonical && !bridge.allowSearchFallback()) {
          return fail("Server-search fallback limit reached for now — find a real YouTube URL and pass it instead.");
        }
        if (!bridge.allowSuggest()) {
          return fail("Rate limit: too many suggestions in a short time — please slow down.");
        }
        const usedServerSearch = !canonical;
        const sent = canonical ?? query;
        const res = await bridge.suggest(sent);
        audit("cv_suggest", {
          userId: bridge.user?.id,
          roomId: bridge.roomId,
          query: sent,
          usedServerSearch,
          ok: res.ok,
        });
        if (!res.ok) return fail(`Suggestion rejected: ${res.error}`);
        const state = res.state ?? {};
        const pending = (state.pendingSuggestions ?? []).length;
        return ok(
          `Suggested ${usedServerSearch ? `"${query}" via server search (prefer a URL next time)` : sent}.\n` +
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
