#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// The PUBLIC remote DJ MCP: a Streamable-HTTP server exposing ONLY the cv_*
// DJ tools, protected by OAuth 2.1 (CueVote is the authorization server). Each
// authenticated user gets a session backed by its own CueVoteBridge, which
// connects to the WS server AS that user via a freshly minted session.
//
// SECURITY: never register ops/admin/read-only tools here. Binds to localhost;
// nginx + Cloudflare sit in front. Do not flip on the public rollout until the
// guardrails (Phase 3) land and the YouTube quota review is clear.
import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { config } from "./config.js";
import { CueVoteBridge } from "./wsClient.js";
import { registerDjTools } from "./tools/dj.js";
import { provider, finalizeAuthorization } from "./oauth/provider.js";
import { mintSessionToken } from "./minter.js";

interface Session {
  transport: StreamableHTTPServerTransport;
  bridge: CueVoteBridge;
  userId: string;
}
const sessions = new Map<string, Session>();

const userIdOf = (req: Request): string =>
  (((req as Request & { auth?: AuthInfo }).auth?.extra?.userId as string) || "");

function rpcErr(res: Response, status: number, message: string): void {
  res.status(status).json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });
}

const app = express();
const issuerUrl = new URL(config.http.publicUrl);

// OAuth 2.1 endpoints: /.well-known/*, /authorize, /token, /register, /revoke.
app.use(
  mcpAuthRouter({
    provider,
    issuerUrl,
    scopesSupported: ["dj"],
    resourceName: "CueVote DJ",
  }),
);

// Web-app callback: after Google login it finalizes a pending authorization.
// Gated by a shared secret (the web app holds CUEVOTE_OAUTH_FINALIZE_SECRET).
app.post("/oauth/finalize", express.json(), (req: Request, res: Response) => {
  const secret = config.oauth.finalizeSecret;
  const provided = (req.headers["authorization"] || "").toString().replace(/^Bearer /, "");
  if (!secret || provided !== secret) return void res.status(401).json({ error: "unauthorized" });
  const body = (req.body ?? {}) as { handle?: string; userId?: string };
  if (!body.handle || !body.userId) return void res.status(400).json({ error: "missing handle or userId" });
  try {
    res.json({ redirectTo: finalizeAuthorization(String(body.handle), String(body.userId)) });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "finalize_failed" });
  }
});

app.get("/health", (_req: Request, res: Response) => res.json({ status: "ok", sessions: sessions.size }));

// Every /mcp request must carry a valid OAuth access token.
const bearer = requireBearerAuth({ verifier: provider, requiredScopes: [] });

app.post("/mcp", bearer, express.json(), async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  const sid = req.headers["mcp-session-id"] as string | undefined;

  if (sid) {
    const s = sessions.get(sid);
    if (!s) return rpcErr(res, 404, "Unknown or expired session.");
    if (s.userId !== userId) return rpcErr(res, 403, "Session does not belong to this user.");
    await s.transport.handleRequest(req, res, req.body);
    return;
  }

  if (!isInitializeRequest(req.body)) return rpcErr(res, 400, "Initialize a session first.");
  if (!userId) return rpcErr(res, 401, "No user associated with token.");

  // Bridge connects AS this user via a freshly minted WS session per connect.
  const bridge = new CueVoteBridge(() => mintSessionToken(userId));
  const server = new McpServer({ name: "cuevote-dj", version: "0.1.0" });
  registerDjTools(server, bridge); // DJ tools ONLY.

  const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
    onsessioninitialized: (id: string) => {
      sessions.set(id, { transport, bridge, userId });
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
  await transport.handleRequest(req, res, req.body);
});

async function handleSession(req: Request, res: Response): Promise<void> {
  const sid = req.headers["mcp-session-id"] as string | undefined;
  const s = sid ? sessions.get(sid) : undefined;
  if (!s) return rpcErr(res, 404, "Unknown or expired session.");
  if (s.userId !== userIdOf(req)) return rpcErr(res, 403, "Session does not belong to this user.");
  await s.transport.handleRequest(req, res);
}
app.get("/mcp", bearer, handleSession);
app.delete("/mcp", bearer, handleSession);

const httpServer = app.listen(config.http.port, config.http.host, () => {
  console.error(
    `[cuevote-mcp:http] DJ MCP (OAuth) on ${config.http.publicUrl}/mcp — DJ tools only` +
      (config.oauth.devUser ? ` [DEV identity: ${config.oauth.devUser}]` : ""),
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
