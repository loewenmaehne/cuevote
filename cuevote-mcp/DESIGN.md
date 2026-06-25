<!--
SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
Copyright (c) 2026 Julian Zienert
-->

# CueVote MCP Server — Design & Plan

> Status: **Entwurf** · Autor: Julian Zienert · Stand: 2026-06-26
> Ziel: Ein MCP-Server (Model Context Protocol), der CueVote für KI-Assistenten
> nutzbar macht — gestuft: **Phase 1 Ops/Admin** (für den Solo-Dev), danach
> **Phase 2 KI-DJ** (für Endnutzer).

---

## 1. Architektur-Befund (Ausgangslage)

Der `cuevote-server` ist ein **reiner WebSocket-Server** (Node.js, `ws`,
`better-sqlite3`), kein REST-API außer `/health` und `/.well-known/security.txt`.

| Aspekt | Ist-Zustand |
|---|---|
| Transport | WebSocket, Origin-geprüft gegen `ALLOWED_ORIGINS`, `?clientId=…` in der URL |
| Auth | Google-OAuth-Access-Token → `LOGIN` → 24h-Session-Token; `RESUME_SESSION` zum Reconnect |
| Kommunikation | **Stateful**: `JOIN_ROOM`, dann raumbezogene Messages; Server pusht `{type:"state", payload}` |
| Persistenz | SQLite (WAL) `cuevote.db` + Worker-Thread (`db-worker.js`) für Async-Writes |
| Laufzeit | Debian-VPS, nginx (TLS/Proxy), **PM2** (`cuevote-server`, 1 Instanz), Logs in `logs/pm2-*.log` (Pino-JSON, redigiert) |
| Rollen | `users.role` ∈ {admin, mod, user} **existiert**, wird aber nirgends geprüft — `isOwner` checkt nur `room.metadata.owner_id` |

### 🔑 Der zentrale Constraint

```
   PERSISTIERT (SQLite)                 NUR IM SPEICHER (Room-Objekte)
   ────────────────────                 ──────────────────────────────
   users, sessions                      queue[] (mit live scores)
   rooms (Metadaten)                     currentTrack + progress (live)
   room_history                         pendingSuggestions[]
   videos (YT-Cache, 28d)               bannedVideos[]
   room_state  ← Snapshot, ≤30s alt,    votes / voters
                 nur {queue,current,     knownVideos, IP-Block-Cache
                 progress,isPlaying}     Hörerzahl (clients.size)
```

**Folge:** Ein MCP, der nur die DB liest, sieht einen **bis zu 30 s alten,
gekürzten** Raumzustand und kann **keine** Live-Aktion (skip, ban, approve)
ausführen — denn die wirken auf In-Memory-`Room`-Objekte. Live-Funktionen
erfordern eine **Admin-Schnittstelle am laufenden Server-Prozess**.

Das ist die Sollbruchstelle, an der Phase 1 sauber zerfällt:

- **Phase 1a** — read-only über die DB. **Null** Server-Änderungen. Sofort lieferbar.
- **Phase 1b** — Live-Lesen + Moderation. Braucht eine neue, localhost-gebundene,
  Token-gesicherte Admin-API im Server.

---

## 2. Gesamtarchitektur des MCP-Servers

Neues Top-Level-Paket **`cuevote-mcp/`** (Geschwister von `cuevote-server` /
`cuevote-client`), TypeScript, offizielles `@modelcontextprotocol/sdk`,
`better-sqlite3` (read-only-Verbindung, gleiche Dep wie der Server), `ws` für
Phase 2. PolyForm-Noncommercial-Header auf allen Dateien (konsistent zur
Monetarisierungs-/Dual-License-Linie).

```
                         ┌─────────────────────────────────────────┐
                         │            cuevote-mcp (Node/TS)         │
                         │  MCP SDK · stdio (P1) / HTTP+SSE (später)│
                         └───────┬───────────────────┬─────────────┘
            Phase 1a:            │                   │   Phase 1b:
       read-only SQLite          │                   │  Admin-HTTP (127.0.0.1
       (cuevote.db, WAL)         ▼                   ▼   + Bearer ADMIN_TOKEN)
                         ┌────────────────┐  ┌──────────────────────────┐
                         │   cuevote.db   │  │  cuevote-server (PM2)     │
                         │   (SQLite)     │◄─┤  rooms: Map<id,Room>      │
                         └────────────────┘  │  + admin.js (neu)         │
                                             └──────────────────────────┘
                                                        ▲
       Phase 2: stateful WS-Client (wss://cuevote.com)  │
       als normaler/authentifizierter Nutzer ───────────┘
```

### Transport-Empfehlung
- **Phase 1:** **stdio**, MCP-Prozess läuft **auf dem VPS** (gleicher Host wie
  `cuevote-server`, damit DB-Datei + localhost-Admin-API erreichbar sind).
  Anbindung von der Dev-Maschine via **`ssh`-stdio** (kein neuer öffentlicher
  Port). Alternative später: Remote-MCP über HTTPS hinter nginx mit Token.
- **Phase 2:** stdio lokal genügt für den Start (verbindet sich auswärts per
  `wss://`). Für breitere Distribution später Remote-MCP (HTTP+SSE), z. B. hinter
  nginx oder als Cloudflare-Worker-Proxy auf die WS-API.

---

## 3. Phase 1 — Ops/Admin-Konsole (Detailfokus)

### 3a. Read-only-Tools (keine Server-Änderung)

MCP öffnet `cuevote.db` mit `new Database(path, { readonly: true })`. WAL erlaubt
parallele Reader gefahrlos neben dem schreibenden Server.

| Tool | Eingabe | Ausgabe / Zweck |
|---|---|---|
| `list_rooms` | `filter: active\|public\|private\|all`, `limit` | Räume aus `rooms` (+ Aktiv-Schwelle wie `listPublicRooms`), je Raum: id, name, owner, public/privat, last_active |
| `get_room` | `roomId` | Metadaten + **Snapshot** aus `room_state` (klar als „≤30 s alt" markiert) + History-Count + Owner-Mail (PII-gated) |
| `get_room_history` | `roomId`, `limit` | gespielte Videos (`room_history` ⨝ `videos`) |
| `find_user` | `emailOrId` | User-Record (id, email, name, role, created_at, #owned rooms). **PII-Tool** — Mail nur hier, nie in Listen |
| `platform_stats` | — | Totale: #users, #rooms (public/privat/aktiv), #videos-cached, #aktive Sessions, DB-Dateigröße |
| `db_health` | — | WAL-Größe, Anzahl stale Metadaten (28d-Retention-Check), stale Caches — spiegelt `runDailyCleanup`-Logik read-only |

→ **Sofort lieferbar, null Risiko, kein Prod-Eingriff.** Liefert bereits echten
Support-/Analyse-Wert (Wer besitzt welche Räume? Retention sauber? Stats?).

### 3b. Live-Ops & Moderation (braucht Server-Admin-Schnittstelle)

**Server-Änderung (neu): `cuevote-server/admin.js`**
- Kleiner HTTP-Server, **gebunden an `127.0.0.1:${ADMIN_PORT}`** (getrennt vom
  öffentlichen 8080), jede Route verlangt `Authorization: Bearer ${ADMIN_TOKEN}`.
- Hat direkten Zugriff auf die `rooms`-Map und `db`/`dbAsync`.
- **Minimaler Refactor in `index.js`:** `const admin = require('./admin'); admin.start({ rooms, db, dbAsync });`
- **Refactor-Pflicht:** Die GDPR-In-Memory-Scrub-Logik (aktuell inline im
  `DELETE_ACCOUNT`-Handler in `index.js`: Räume zerstören + `scrubDeletedUser`
  über alle Räume) in eine gemeinsame Funktion extrahieren, damit
  `DELETE_ACCOUNT` **und** `admin.gdprDeleteUser` denselben Pfad nutzen.

MCP-Tools, die die Admin-API aufrufen:

| Tool | Wirkung | Server-Pfad |
|---|---|---|
| `get_live_room` | echter In-Memory-State (queue+scores, currentTrack+progress, pendingSuggestions, bannedVideos, settings, Hörer) | liest `rooms.get(id).state` |
| `list_active_rooms` | aktuell im Speicher geladene Räume + Hörerzahl | iteriert `rooms` |
| `skip_track` | überspringt aktuellen Track | `room.handleNextTrack()` |
| `pause_room` | play/pause erzwingen | `room.updateState({isPlaying})` |
| `ban_video` / `unban_video` | Video bannen/entbannen | `handleBanSuggestion`/`handleUnbanSong` |
| `approve_suggestion` / `reject_suggestion` | Manual-Mode-Moderation | bestehende Handler |
| `remove_from_queue` | Track aus Queue werfen | `handleDeleteSong` |
| `broadcast_notice` | System-/Owner-Hinweis an Raum | `room.broadcast(...)` |
| `delete_room` | Raum löschen (Memory + DB) | `handleDeleteRoom` + `db.deleteRoom` |
| `gdpr_delete_user` | **Art. 17** Volllöschung (DB + In-Memory-Scrub) | gemeinsame Scrub-Fn + `db.deleteUser` |
| `trigger_backup` / `trigger_cleanup` | Wartung anstoßen | `db.backup` / `dbAsync.runDailyCleanup` |

> ⚠️ Schreibende Tools (`skip`, `ban`, `delete_room`, `gdpr_delete_user`) bekommen
> ein **`confirm: true`-Flag** und werden auditiert (s. §5).

---

## 4. Phase 2 — KI-DJ / Gast-Assistent (Skizze)

Der MCP hält intern einen **stateful WS-Client** (`ws`) zu `wss://cuevote.com`
und überbrückt das Push-Modell auf MCP-Request/Response.

**WS-Bridge:**
- `new WebSocket(url, { origin: 'https://cuevote.com' })` — der Origin-Header muss
  in `ALLOWED_ORIGINS` stehen (sonst 403 in `verifyClient`).
- Eingehende `{type:"state"}` werden als `latestState` gecacht; **Read-Tools**
  (`now_playing`, `get_queue`) antworten daraus.
- **Mutierende Tools** senden die WS-Message mit `msgId` und warten auf `ACK`
  und/oder das nächste `state`-Diff (mit Timeout + Fehler-Mapping).

**Auth (der schwierige Teil):**
- v1 simpel: Nutzer hinterlegt einen **CueVote-Session-Token** (aus der Web-App)
  via MCP-Config/Env → `RESUME_SESSION`. Damit ist `ws.user` gesetzt.
- v2 komfortabel: Pairing-/Device-Code-Flow (out of scope für den ersten Wurf).

**Tools:** `cv_list_rooms`, `cv_join_room(roomId, password?)`, `cv_now_playing`,
`cv_get_queue`, `cv_suggest(query)`, `cv_vote(trackId, up|down)`;
Owner-only: `cv_skip`, `cv_play_pause`, `cv_update_settings`.

**YouTube-ToS / Quota (Memory-Querverweis):**
- KI-Vorschläge laufen über den bestehenden `SUGGEST_SONG`-Pfad (serverseitige
  YT-Suche) — **gleiche ToS-Haltung wie ein Mensch, der die App nutzt**, kein
  Auth-Injection (vgl. ausgeschlossene Variante).
- Aber: automatisiertes Massen-Queuing erhöht den **YT-Search-Quota-Verbrauch**
  (100 Units/Suche). Suchgebnis-Cache mildert das; trotzdem **Rate-Limit für
  KI-Suggests** einplanen und an das offene Quota-Review denken. **Kein
  Auto-Suggest at scale.**

---

## 5. Querschnitt: Sicherheit, GDPR, Compliance

- **PII-Disziplin:** `email` nur in `find_user`/`gdpr_delete_user`, **nie** in
  Listen-Ausgaben. Pino-Redaction-Linie des Servers spiegeln.
- **Admin-Surface:** ausschließlich `127.0.0.1` + `ADMIN_TOKEN`, **niemals**
  öffentlich (nginx darf den Admin-Port nicht proxien).
- **Audit-Log:** jede schreibende Admin-Aktion (wer/wann/was) in eine Datei.
- **Confirm-Gate:** destruktive Tools verlangen `confirm:true`.
- **Lizenz:** PolyForm-Noncommercial-SPDX-Header auf jeder neuen Datei.
- **`DEPLOYMENT.md` synchron halten:** neue Envs (`ADMIN_PORT`, `ADMIN_TOKEN`)
  dort + ggf. in `ALLOWED_ORIGINS`-Hinweis ergänzen (apex **und** www-Regel).

---

## 6. Liefer-Meilensteine (je eigener Commit/PR)

| # | Inhalt | Risiko | Server-Eingriff |
|---|---|---|---|
| **M0** | Scaffold `cuevote-mcp/` (TS, MCP-SDK, PolyForm, Env-Config) | – | nein |
| **M1** | Phase 1a: read-only-Tools | sehr niedrig | nein |
| **M2** | `admin.js` (localhost+Token) + `index.js`-Refactor + GDPR-Scrub-Extraktion | mittel | **ja** |
| **M3** | Phase 1b: Live-Ops-Tools im MCP gegen Admin-API | mittel | nein (nutzt M2) |
| **M4** | Phase 2: WS-Bridge + Auth + Gast-/Owner-Tools | hoch | ggf. Origin-Allowlist |

---

## 7. Offene Entscheidungen (vor M2/M4 zu klären)

1. **Wo läuft der MCP-Prozess?** Empfehlung Phase 1: auf dem VPS, Anbindung per
   `ssh`-stdio (kein neuer öffentlicher Port). Alternative: Remote-MCP hinter nginx.
2. **Form der Admin-Schnittstelle:** localhost-HTTP (Empfehlung, leicht aus dem
   MCP aufrufbar) vs. authentifizierte `ADMIN_*`-WS-Message.
3. **Phase-2-Auth-UX:** Session-Token einfügen (v1) vs. Pairing-Flow (v2).
4. **Rollenmodell:** `users.role='admin'` endlich serverseitig auswerten (würde
   einen echten Admin-WS-Pfad statt nur localhost-HTTP ermöglichen)?
