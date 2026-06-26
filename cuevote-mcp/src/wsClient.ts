// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Phase 2: stateful WebSocket bridge to the public CueVote server. It logs in
// with a session token, tracks the latest room state pushed by the server, and
// exposes request/response helpers over the otherwise push-based protocol.
import WebSocket from "ws";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";

type AnyMsg = { type: string; [k: string]: any };
interface Waiter {
  match: (m: AnyMsg) => boolean;
  resolve: (m: AnyMsg) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class CueVoteBridge {
  private ws: WebSocket | null = null;
  private clientId = "mcp-" + randomUUID();
  private connecting: Promise<void> | null = null;
  private waiters: Waiter[] = [];
  private readonly tokenSource: string | (() => Promise<string>);

  user: { id: string; name?: string } | null = null;
  roomId: string | null = null;
  latestState: any = null;

  // One bridge per CueVote session. The token source is either a static session
  // token (stdio / Phase-1b interim auth) or a provider that mints a fresh token
  // per connect (Phase-2 OAuth: a freshly minted WS session for the auth'd user).
  constructor(tokenSource: string | (() => Promise<string>) = config.ws.sessionToken) {
    this.tokenSource = tokenSource;
  }

  private async resolveToken(): Promise<string> {
    const t = typeof this.tokenSource === "function" ? await this.tokenSource() : this.tokenSource;
    if (!t) throw new Error("No CueVote session token for this bridge.");
    return t;
  }

  private url(): string {
    const u = new URL(config.ws.url);
    u.searchParams.set("clientId", this.clientId);
    return u.toString();
  }

  /** Connect + authenticate if not already ready. Idempotent / coalesced. */
  async ensureReady(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.user) return;
    if (!this.connecting) {
      this.connecting = this.connect().finally(() => {
        this.connecting = null;
      });
    }
    await this.connecting;
  }

  private async connect(): Promise<void> {
    const token = await this.resolveToken();
    await new Promise<void>((resolve, reject) => {
      // Close any prior (possibly half-open) socket before reconnecting.
      try { this.ws?.close(); } catch { /* ignore */ }
      const ws = new WebSocket(this.url(), { origin: config.ws.origin });
      this.ws = ws;
      const failTimer = setTimeout(() => {
        try { ws.close(); } catch { /* ignore */ }
        reject(new Error("Connection/auth timed out."));
      }, 15000);

      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "RESUME_SESSION", payload: { token }, msgId: "auth" }));
      });
      ws.on("message", (data: WebSocket.RawData) => {
        let m: AnyMsg;
        try { m = JSON.parse(data.toString()); } catch { return; }
        this.onMessage(m);
        if (m.type === "LOGIN_SUCCESS") {
          this.user = m.payload?.user ?? null;
          clearTimeout(failTimer);
          resolve();
        } else if (m.type === "SESSION_INVALID") {
          clearTimeout(failTimer);
          try { ws.close(); } catch { /* ignore */ }
          reject(new Error("Session invalid — refresh CUEVOTE_SESSION_TOKEN from the web app."));
        }
      });
      ws.on("close", () => this.handleClose());
      ws.on("error", (err: Error) => {
        clearTimeout(failTimer);
        try { ws.close(); } catch { /* ignore */ }
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  private handleClose(): void {
    this.ws = null;
    this.user = null;
    this.latestState = null;
    for (const w of this.waiters) {
      clearTimeout(w.timer);
      w.reject(new Error("Connection closed."));
    }
    this.waiters = [];
  }

  private onMessage(m: AnyMsg): void {
    if (m.type === "state") this.latestState = m.payload;
    else if (m.type === "state_delta") this.latestState = { ...(this.latestState || {}), ...m.payload };
    else if (m.type === "PING") this.safeSend({ type: "PONG" });

    for (const w of [...this.waiters]) {
      if (w.match(m)) {
        clearTimeout(w.timer);
        this.waiters = this.waiters.filter((x) => x !== w);
        w.resolve(m);
      }
    }
  }

  private safeSend(obj: AnyMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  private send(obj: AnyMsg): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error("Not connected.");
    this.ws.send(JSON.stringify(obj));
  }

  private waitFor(match: (m: AnyMsg) => boolean, timeoutMs = 10000): Promise<AnyMsg> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x.timer !== timer);
        reject(new Error("Timed out waiting for server response."));
      }, timeoutMs);
      this.waiters.push({ match, resolve, reject, timer });
    });
  }

  /**
   * Send a message and resolve on the first of its ACK or a server error,
   * so a rejection that arrives without an ACK surfaces immediately instead of
   * waiting out the timeout. (CueVote sends an `error` before the `ACK` on a
   * failed SUGGEST/VOTE, so the error wins the race.)
   */
  private async sendAcked(obj: AnyMsg, msgId: string, settleMs = 250): Promise<{ ok: boolean; error?: string }> {
    const settled = this.waitFor(
      (m) => (m.type === "ACK" && m.msgId === msgId) || m.type === "error",
      12000,
    );
    this.send({ ...obj, msgId });
    const m = await settled;
    if (m.type === "error") return { ok: false, error: m.message || m.code || "error" };
    await sleep(settleMs); // let the resulting state_delta land
    return { ok: true };
  }

  // ---- High-level operations ----

  async listRooms(type?: "public" | "private" | "my_channels"): Promise<any> {
    await this.ensureReady();
    const p = this.waitFor((m) => m.type === "ROOM_LIST");
    this.send({ type: "LIST_ROOMS", payload: type ? { type } : {} });
    return (await p).payload;
  }

  async joinRoom(roomId: string, password?: string): Promise<any> {
    await this.ensureReady();
    const msgId = "join-" + randomUUID();
    const p = this.waitFor((m) => m.type === "state" || m.type === "error");
    this.send({ type: "JOIN_ROOM", payload: { roomId, ...(password ? { password } : {}) }, msgId });
    const m = await p;
    if (m.type === "error") throw new Error(m.message || m.code || "Join failed");
    this.roomId = roomId;
    this.latestState = m.payload;
    return m.payload;
  }

  async ensureJoined(): Promise<any> {
    await this.ensureReady();
    if (!this.roomId) throw new Error("Not in a room — call cv_join_room first.");
    if (!this.latestState) await this.joinRoom(this.roomId); // reconnected → rejoin
    return this.latestState;
  }

  async suggest(query: string): Promise<{ ok: boolean; error?: string; state?: any }> {
    await this.ensureJoined();
    const res = await this.sendAcked({ type: "SUGGEST_SONG", payload: { query } }, "sug-" + randomUUID());
    return { ...res, state: this.latestState };
  }

  async vote(trackId: string, voteType: "up" | "down"): Promise<{ ok: boolean; error?: string; state?: any }> {
    await this.ensureJoined();
    const res = await this.sendAcked({ type: "VOTE", payload: { trackId, voteType } }, "vote-" + randomUUID());
    return { ...res, state: this.latestState };
  }

  /** Owner-only; a silent no-op server-side if the session user isn't the owner. */
  async skip(): Promise<any> {
    await this.ensureJoined();
    this.send({ type: "NEXT_TRACK" });
    await sleep(300);
    return this.latestState;
  }

  async playPause(playing: boolean): Promise<any> {
    await this.ensureJoined();
    this.send({ type: "PLAY_PAUSE", payload: playing });
    await sleep(250);
    return this.latestState;
  }

  close(): void {
    try { this.ws?.close(); } catch { /* ignore */ }
  }
}

// One shared bridge per MCP process.
export const bridge = new CueVoteBridge();
