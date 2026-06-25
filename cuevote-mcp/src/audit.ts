// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Append-only audit log for every write action issued through the MCP server.
import { appendFileSync } from "node:fs";
import { config } from "./config.js";

export function audit(action: string, detail: Record<string, unknown> = {}): void {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), action, ...detail }) + "\n";
    appendFileSync(config.auditLog, line);
  } catch (err) {
    // Never let auditing break a tool call; surface on stderr only.
    console.error("[audit] failed to write:", err);
  }
}
