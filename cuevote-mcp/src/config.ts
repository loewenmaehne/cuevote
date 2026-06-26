// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
// dist/ (or src/ at dev time) -> package root
const pkgRoot = resolve(here, "..");

// Load a .env sitting next to the package, so config travels with the install
// and works regardless of cwd (e.g. when launched over SSH). quiet:true keeps
// dotenv from writing to stdout, which would corrupt the MCP stdio stream.
dotenv.config({ path: resolve(pkgRoot, ".env"), quiet: true });

function env(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

/** Resolve a possibly-relative path against the package root. */
function resolvePath(value: string): string {
  return resolve(pkgRoot, value);
}

export const config = {
  dbPath: resolvePath(env("CUEVOTE_DB_PATH", "../cuevote-server/cuevote.db")),

  admin: {
    url: env("CUEVOTE_ADMIN_URL", "http://127.0.0.1:8081").replace(/\/$/, ""),
    token: env("CUEVOTE_ADMIN_TOKEN"),
    get enabled(): boolean {
      return this.token.length > 0;
    },
  },

  ws: {
    url: env("CUEVOTE_WS_URL", "wss://cuevote.com"),
    origin: env("CUEVOTE_WS_ORIGIN", "https://cuevote.com"),
    sessionToken: env("CUEVOTE_SESSION_TOKEN"),
    get enabled(): boolean {
      return this.sessionToken.length > 0;
    },
  },

  // Internal call to cuevote-server to mint a WS session for an authenticated
  // user (remote DJ MCP, Phase 2). Same localhost server as the admin API,
  // but gated by a narrower secret (matches the server's MCP_SESSION_SECRET).
  internal: {
    url: env("CUEVOTE_INTERNAL_URL", "http://127.0.0.1:8081").replace(/\/$/, ""),
    secret: env("CUEVOTE_MINT_SECRET"),
    get enabled(): boolean {
      return this.secret.length > 0;
    },
  },

  // Remote DJ MCP (HTTP entrypoint). Binds localhost; nginx + Cloudflare sit in front.
  http: {
    host: env("CUEVOTE_HTTP_HOST", "127.0.0.1"),
    port: Number(env("CUEVOTE_HTTP_PORT", "8082")),
    // Comma-separated Host header allow-list for DNS-rebinding protection (Phase 3).
    allowedHosts: env("CUEVOTE_HTTP_ALLOWED_HOSTS")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  },

  auditLog: resolvePath(env("CUEVOTE_AUDIT_LOG", "mcp-audit.log")),

  dbExists(): boolean {
    return existsSync(this.dbPath);
  },
};
