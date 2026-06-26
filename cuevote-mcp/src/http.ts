#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Phase 1b: the PUBLIC remote DJ MCP — a Streamable-HTTP server that exposes
// ONLY the cv_* DJ tools, one authenticated session per user, each backed by
// its own CueVoteBridge. Binds to localhost; nginx + Cloudflare sit in front.
//
// SECURITY: this entrypoint must NEVER register the ops/admin/read-only tools.
// Auth here is INTERIM (Bearer = the user's CueVote session token) for closed
// local/beta testing only — Phase 2 replaces it with OAuth. Do not expose
// publicly until OAuth + guardrails (Phase 3) are in place.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";
import { CueVoteBridge } from "./wsClient.js";
import { registerDjTools } from "./tools/dj.js";

interface Session {
  transport: StreamableHTTPServerTransport;
  bridge: CueVoteBridge;
}
const sessions = new Map<string, Session>();

function sendJson(res: ServerResponse, code: number, obj: unknown): void {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(body);
}

function rpcError(res: ServerResponse, code: number, rpcCode: number, message: string): void {
  sendJson(res, code, { jsonrpc: "2.0", error: { code: rpcCode, message }, id: null });
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 4_000_000) req.destroy(); // 4 MB cap
    });
    req.on("end", () => {
      if (!data) return resolve(undefined);
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(undefined);
      }
    });
    req.on("error", () => resolve(undefined));
  });
}

function bearer(req: IncomingMessage): string | null {
  const h = req.headers["authorization"];
  return typeof h === "string" && h.startsWith("Bearer ") ? h.slice(7) : null;
}

async function handlePost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sid = req.headers["mcp-session-id"] as string | undefined;
  const body = await readBody(req);

  // Existing session → route to its transport.
  if (sid) {
    const session = sessions.get(sid);
    if (!session) return rpcError(res, 404, -32001, "Unknown or expired session.");
    await session.transport.handleRequest(req, res, body);
    return;
  }

  // New session: must be an initialize request, and must carry a token.
  if (!isInitializeRequest(body)) {
    return rpcError(res, 400, -32000, "Bad Request: initialize a session first.");
  }
  // INTERIM AUTH (Phase 1b): Bearer is the user's CueVote session token. The
  // MCP session is bound to that token at init; Phase 2 swaps this for OAuth.
  const token = bearer(req);
  if (!token) return rpcError(res, 401, -32001, "Unauthorized: Bearer token required.");

  const bridge = new CueVoteBridge(token);
  const server = new McpServer({ name: "cuevote-dj", version: "0.1.0" });
  registerDjTools(server, bridge); // DJ tools ONLY — never ops/admin/read-only.

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true, // request/response (no long-lived SSE behind CF)
    onsessioninitialized: (id) => {
      sessions.set(id, { transport, bridge });
    },
  });
  transport.onclose = () => {
    const id = transport.sessionId;
    if (id && sessions.has(id)) {
      try {
        sessions.get(id)!.bridge.close();
      } catch {
        /* ignore */
      }
      sessions.delete(id);
    }
  };

  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

async function handleSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sid = req.headers["mcp-session-id"] as string | undefined;
  const session = sid ? sessions.get(sid) : undefined;
  if (!session) return rpcError(res, 404, -32001, "Unknown or expired session.");
  await session.transport.handleRequest(req, res);
}

const httpServer = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/health" && req.method === "GET") {
    return sendJson(res, 200, { status: "ok", sessions: sessions.size });
  }
  if (url.pathname === "/mcp") {
    if (req.method === "POST") {
      return void handlePost(req, res).catch((e) => {
        console.error("[http] POST error:", e);
        if (!res.headersSent) rpcError(res, 500, -32603, "Internal error.");
      });
    }
    if (req.method === "GET" || req.method === "DELETE") {
      return void handleSession(req, res).catch((e) => {
        console.error("[http] session error:", e);
        if (!res.headersSent) rpcError(res, 500, -32603, "Internal error.");
      });
    }
  }
  sendJson(res, 404, { error: "not_found" });
});

httpServer.listen(config.http.port, config.http.host, () => {
  console.error(
    `[cuevote-mcp:http] DJ MCP on http://${config.http.host}:${config.http.port}/mcp ` +
      `(DJ tools only, interim bearer auth — not for public exposure yet)`,
  );
});

function shutdown(): void {
  for (const { transport, bridge } of sessions.values()) {
    try { transport.close(); } catch { /* ignore */ }
    try { bridge.close(); } catch { /* ignore */ }
  }
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
