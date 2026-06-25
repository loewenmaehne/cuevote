// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// Thin HTTP client for the cuevote-server localhost admin API (Phase 1b).
import { config } from "./config.js";

export interface AdminResponse {
  status: number; // 0 = could not connect
  ok: boolean;
  json: any;
}

async function req(method: string, path: string, body?: unknown): Promise<AdminResponse> {
  try {
    const res = await fetch(config.admin.url + path, {
      method,
      headers: {
        Authorization: `Bearer ${config.admin.token}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, ok: res.ok, json };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      json: { error: "connection_failed", message: err instanceof Error ? err.message : String(err) },
    };
  }
}

const id = (s: string): string => encodeURIComponent(s);

export const adminClient = {
  health: () => req("GET", "/admin/health"),
  listRooms: () => req("GET", "/admin/rooms"),
  getRoom: (roomId: string) => req("GET", `/admin/rooms/${id(roomId)}`),
  action: (roomId: string, action: string, body?: unknown) =>
    req("POST", `/admin/rooms/${id(roomId)}/${action}`, body),
  deleteRoom: (roomId: string) => req("DELETE", `/admin/rooms/${id(roomId)}`),
  gdprDelete: (userId: string) => req("POST", `/admin/users/${id(userId)}/gdpr-delete`),
  maintenance: (task: string, body?: unknown) =>
    req("POST", `/admin/maintenance/${task}`, body),
};
