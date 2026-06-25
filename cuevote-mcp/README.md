<!--
SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
Copyright (c) 2026 Julian Zienert
-->

# cuevote-mcp

MCP (Model Context Protocol) server for **CueVote**. It lets an AI assistant
(Claude Desktop, Claude Code, …) work with CueVote through typed tools.

See [DESIGN.md](DESIGN.md) for the full architecture and rationale. This README
covers setup and the tool surface.

## Capabilities (gated by configuration)

| Group | Needs | Status |
|---|---|---|
| **Read-only ops** (rooms, users, history, stats) | read access to `cuevote.db` | ✅ Phase 1a |
| **Live ops / moderation** (skip, ban, approve, delete, GDPR) | server admin API + `CUEVOTE_ADMIN_TOKEN` | ✅ Phase 1b |
| **AI-DJ / guest control** (suggest, vote, now-playing, skip) | a CueVote session token | ✅ Phase 2 |

Each group activates only when its configuration is present, so you can run a
pure read-only console without ever touching the live server.

## Install & build

```bash
cd cuevote-mcp
npm install
npm run build
```

## Quick start on the server (both tiers, ~2 commands)

On the host that runs `cuevote-server`, from the repo root:

```bash
./setup-mcp.sh
```

It builds the MCP, enables the admin API (generates `ADMIN_TOKEN` and restarts the
server once), writes `cuevote-mcp/.env`, verifies the admin health endpoint, and
prints the one line to run on your Mac — typically:

```bash
claude mcp add cuevote -- ssh -T <user>@cuevote.com node /abs/path/cuevote-mcp/dist/index.js
```

Re-run `./setup-mcp.sh` after each deploy to rebuild the MCP. Read-only **and**
live-ops are then both active.

## Configure (manual / local)

The MCP **auto-loads a `.env` placed next to the package** (regardless of cwd, so
it works when launched over SSH). Copy `.env.example`, or pass the same vars via
your MCP client config. The only one needed for read-only use is `CUEVOTE_DB_PATH`
— and it already defaults to the sibling `../cuevote-server/cuevote.db`.

Run `cuevote_diagnostics` first — it reports which capabilities are wired up
without printing any secrets.

### Claude Desktop / Claude Code (stdio)

```jsonc
{
  "mcpServers": {
    "cuevote": {
      "command": "node",
      "args": ["/absolute/path/to/cuevote-mcp/dist/index.js"],
      "env": {
        "CUEVOTE_DB_PATH": "/absolute/path/to/cuevote-server/cuevote.db",
        "CUEVOTE_ADMIN_TOKEN": "…only for live ops…",
        "CUEVOTE_SESSION_TOKEN": "…only for DJ tools…"
      }
    }
  }
}
```

For live ops the MCP process must run **on the server host** (so it can reach the
localhost-only admin API and the DB file). The recommended setup is to launch it
over `ssh` as a stdio command from your dev machine.

## Security notes

- The server admin API binds to `127.0.0.1` and requires `ADMIN_TOKEN`. Never
  proxy it publicly.
- Email (PII) is returned only by the explicit user/GDPR tools, never in lists.
- Destructive tools require `confirm: true` and are written to the audit log.
- All code is PolyForm Noncommercial licensed, like the rest of CueVote.
