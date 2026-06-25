// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
export interface ToolResult {
  // Index signature keeps this structurally assignable to the SDK's CallToolResult.
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export const ok = (text: string): ToolResult => ({ content: [{ type: "text", text }] });
export const fail = (text: string): ToolResult => ({
  content: [{ type: "text", text }],
  isError: true,
});

/** Wrap a handler so thrown errors become a clean isError result instead of a crash. */
export function guard(fn: () => Promise<ToolResult> | ToolResult): () => Promise<ToolResult> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      return fail(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
}

export function table(headers: string[], rows: (string | number)[][]): string {
  const body = rows.map((r) => r.map((c) => String(c ?? "")));
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...body.map((r) => (r[i] ?? "").length), 0),
  );
  const line = (cells: string[]): string =>
    cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [
    line(headers),
    line(widths.map((w) => "-".repeat(w))),
    ...body.map(line),
  ].join("\n");
}

export function ago(seconds: number): string {
  if (seconds < 0) return "in the future";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ago`;
  if (h > 0) return `${h}h ${m}m ago`;
  if (m > 0) return `${m}m ago`;
  return `${seconds}s ago`;
}

export function tsAgo(unixSeconds: number): string {
  return ago(Math.floor(Date.now() / 1000) - unixSeconds);
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let x = n;
  let i = -1;
  do {
    x /= 1024;
    i++;
  } while (x >= 1024 && i < units.length - 1);
  return `${x.toFixed(1)} ${units[i]}`;
}

export function duration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
