#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "./config.js";
import { registerReadonlyTools } from "./tools/readonly.js";
import { registerAdminTools } from "./tools/admin.js";
import { registerDjTools } from "./tools/dj.js";

const server = new McpServer({ name: "cuevote-mcp", version: "0.1.0" });

// Always-available diagnostics tool: reports which capabilities are wired up,
// without leaking any secrets. Useful as a first call to confirm setup.
server.registerTool(
  "cuevote_diagnostics",
  {
    title: "CueVote MCP diagnostics",
    description:
      "Report which CueVote MCP capabilities are configured (DB read access, " +
      "live-ops admin API, DJ WebSocket bridge). Returns no secrets.",
    inputSchema: {},
  },
  async () => {
    const lines = [
      `DB path:        ${config.dbPath}`,
      `DB readable:    ${config.dbExists() ? "yes" : "NO — read-only tools unavailable"}`,
      `Live-ops admin: ${config.admin.enabled ? `configured (${config.admin.url})` : "not configured — set CUEVOTE_ADMIN_TOKEN"}`,
      `DJ bridge:      ${config.ws.enabled ? `configured (${config.ws.url})` : "not configured — set CUEVOTE_SESSION_TOKEN"}`,
    ];
    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// Phase 1a: read-only ops tools (always registered; they return a clean error
// if the DB file isn't reachable).
registerReadonlyTools(server);

// Phase 1b: live ops / moderation — only when an admin token is configured.
if (config.admin.enabled) {
  registerAdminTools(server);
}

// Phase 2: AI-DJ / guest control — only when a session token is configured.
if (config.ws.enabled) {
  registerDjTools(server);
}

async function main(): Promise<void> {
  // stdout is reserved for the MCP protocol; all logging must go to stderr.
  console.error("[cuevote-mcp] starting (stdio)…");
  await server.connect(new StdioServerTransport());
  console.error("[cuevote-mcp] ready.");
}

main().catch((err) => {
  console.error("[cuevote-mcp] fatal:", err);
  process.exit(1);
});
