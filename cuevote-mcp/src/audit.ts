// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Append-only audit log for every write action issued through the MCP server,
// and for the OAuth events that decide who gets to issue one.
import { appendFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { config } from "./config.js";

// Nothing rotates this file — pm2-logrotate only handles PM2's own stdout and
// stderr, and this is written directly with appendFileSync. Rotate it here so
// the log cannot grow without bound. It is operational telemetry, not the GDPR
// Art. 33(5) incident record (that is kept separately, outside the repo), so a
// bounded window is the right trade.
const MAX_BYTES = Number(process.env.CUEVOTE_AUDIT_MAX_BYTES || 10 * 1024 * 1024);
const KEEP = Number(process.env.CUEVOTE_AUDIT_KEEP || 5);

function rotateIfNeeded(): void {
  let size: number;
  try {
    size = statSync(config.auditLog).size;
  } catch {
    return; // no log yet
  }
  if (size < MAX_BYTES) return;

  try { unlinkSync(`${config.auditLog}.${KEEP}`); } catch { /* may not exist */ }
  for (let i = KEEP - 1; i >= 1; i--) {
    try { renameSync(`${config.auditLog}.${i}`, `${config.auditLog}.${i + 1}`); } catch { /* may not exist */ }
  }
  try { renameSync(config.auditLog, `${config.auditLog}.1`); } catch { /* raced with another writer */ }
}

export function audit(action: string, detail: Record<string, unknown> = {}): void {
  try {
    rotateIfNeeded();
    const line = JSON.stringify({ ts: new Date().toISOString(), action, ...detail }) + "\n";
    appendFileSync(config.auditLog, line);
  } catch (err) {
    // Never let auditing break a tool call; surface on stderr only.
    console.error("[audit] failed to write:", err);
  }
}
