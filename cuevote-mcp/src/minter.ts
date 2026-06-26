// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Mints a short-lived CueVote WS session for an authenticated user by calling
// the server's localhost internal API. The remote DJ MCP uses this (after OAuth)
// so a bridge can connect AS that user without ever holding their web session.
import { config } from "./config.js";

export async function mintSessionToken(userId: string): Promise<string> {
  if (!config.internal.enabled) {
    throw new Error("CUEVOTE_MINT_SECRET not configured.");
  }
  const res = await fetch(`${config.internal.url}/internal/mint-session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.internal.secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    throw new Error(`mint-session failed (${res.status}) for user ${userId}`);
  }
  const json = (await res.json()) as { token?: string };
  if (!json.token) throw new Error("mint-session returned no token");
  return json.token;
}
