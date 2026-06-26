<!--
SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
Copyright (c) 2026 Julian Zienert
-->

# Remote DJ MCP — Design (Phase 2 public, „für alle")

> Status: **Plan** · Stand: 2026-06-26
> Ziel: Ein **gehosteter Remote-MCP**, mit dem **jeder CueVote-User** eine KI
> (Claude o. ä.) verbinden und CueVote **als sich selbst** steuern kann —
> Songs vorschlagen, voten, Now-Playing/Queue sehen, und Owner-Aktionen auf
> eigenen Räumen. Login per „**Mit CueVote verbinden**" (OAuth).
>
> Entscheidung getroffen: **Option A** — läuft auf dem **VPS hinter dem
> Cloudflare-Proxy**; OAuth über das **MCP-SDK-Auth-Framework** (kein
> handgestrickter OAuth-Server).

---

## 1. Sicherheitsmodell (die harten Regeln)

- **Der öffentliche Remote-MCP zeigt AUSSCHLIESSLICH die DJ-Tools (`cv_*`)** —
  **niemals** die Ops/Admin/Read-only-Tools. Das ist ein **eigener Entrypoint**
  (`src/http.ts`), nicht der stdio-Server (der bleibt für dich per SSH).
- Jede Verbindung ist authentifiziert und agiert **nur als dieser User**.
  Owner-Aktionen (skip/pause) werden weiterhin **serverseitig** über das
  bestehende `isOwner` durchgesetzt — der MCP verleiht keine Extra-Rechte.
- Bindet auf **localhost**; **nginx** terminiert TLS unter `mcp.cuevote.com`;
  **Cloudflare-Proxy** davor versteckt die Origin-IP.
- OAuth 2.1 nach MCP-Spec: PKCE, kurzlebige Access- + Refresh-Tokens, Dynamic
  Client Registration. Über das SDK-Framework, **vorm Public-Rollout durch
  `/security-review`**.

## 2. Architektur

```
Claude ─HTTPS▶ Cloudflare (Proxy, IP versteckt) ─▶ nginx (TLS, mcp.cuevote.com)
                                                      └─▶ 127.0.0.1:PORT  cuevote-mcp (remote)
                                                            • Streamable-HTTP-Transport
                                                            • OAuth (MCP-SDK) ← Identität via bestehendes Google-Login
                                                            • pro-Session CueVoteBridge ─wss▶ cuevote-server (als der User)
```

## 3. Auth-Fluss (der knifflige Teil)

1. Claude entdeckt die Auth-Metadaten des MCP (`.well-known/...`), startet den
   OAuth-Flow.
2. **CueVote ist der Authorization Server.** `/authorize` → User loggt sich per
   **Google** ein (bestehender Flow) und bestätigt einen **Consent-Screen**
   („Diese KI darf in deinem Namen Songs vorschlagen/voten …"). → Auth-Code.
3. Client tauscht den Code (PKCE) an `/token` gegen **Access- + Refresh-Token**.
   Tokens sind userscoped, kurzlebig, **widerrufbar** (neue Tabelle, z. B.
   `mcp_grants`).
4. **MCP → WS-Bridge:** Der MCP hat jetzt die *User-Identität*, aber nicht das
   Web-Session-Token des Users. Damit die Bridge sich am WS-Server **als dieser
   User** anmelden kann, bekommt der Server einen **privilegierten internen
   Pfad** „mint WS-Session für `userId`" (nur localhost + Secret, erreichbar nur
   vom co-located MCP). Die Bridge nutzt dann `RESUME_SESSION` mit dem
   frisch geprägten Token. → Wiederverwendung der bestehenden Session-Maschinerie,
   kein neuer Auth-Pfad im WS-Server.

## 4. Wo die Arbeit anfällt

| Bereich | Was | Phase |
|---|---|---|
| `cuevote-mcp` | HTTP-Entrypoint (`src/http.ts`), Streamable-HTTP, **pro-Session** McpServer mit **nur** DJ-Tools, pro-Session-Bridge | 1 |
| `cuevote-mcp` | OAuth (SDK-Auth-Router): Resource-Metadaten + AS-Anbindung | 2 |
| `cuevote-server` | interner „mint WS-Session für userId"-Pfad (localhost/Secret) | 2 |
| `cuevote-server` | AS-Logik (kennt Google-Login + users/sessions) — bzw. wo der AS sitzt | 2 |
| `cuevote-client` | Consent-/„Mit KI verbinden"-Screen für `/authorize` + Token-Verwaltung (widerrufen) | 3 |
| Guardrails | pro-User-Rate-Limit auf `cv_suggest` (Quota!), aggressiver Such-Cache (existiert), Abuse-Limits | 3 |
| Ops | nginx-vhost `mcp.cuevote.com` → localhost, Cloudflare orange-cloud, PM2-Dienst | 3 |

## 5. Phasen

1. **Remote-Transport + Multi-Session-Plumbing.** Interim-Auth: Bearer = das
   Session-Token des Users (nur geschlossener lokaler/Beta-Test, **nicht
   öffentlich**). DJ-Tools-only, pro-Session-Bridge. *(Refactor der Bridge auf
   pro-Session ist bereits Teil dieses PRs.)*
2. **OAuth-„Connect".** SDK-Auth; CueVote als AS via Google; geprägte
   WS-Sessions. Ersetzt das Interim-Bearer.
3. **Web-App-Consent + Token-UI, Guardrails, nginx+CF+PM2, Public-Rollout** —
   **gated auf das YouTube-Quota-Review**.

## 6. Risiken

- **YouTube-Quota** (offenes Review): öffentlicher KI-Suggest-Kanal kann den
  Search-API-Verbrauch hochtreiben → pro-User-Rate-Limit + Cache; **Public-Rollout
  (Phase 3) erst nach grünem Quota-Review.** Siehe [[project_youtube_quota_review]].
- **OAuth-Sicherheit** → Framework statt selbstgebaut; `/security-review` vor Public.
- **SSE hinter Cloudflare-Proxy** kann Timeouts haben → in Phase 1 prüfen
  (Streamable-HTTP ist überwiegend Request/Response, meist unkritisch).
- **Kein Rechte-Leak:** die Bridge darf ausschließlich als der authentifizierte
  User handeln.

## 7. Non-Goals

- Ops/Admin-Tools **niemals** über den öffentlichen Remote-MCP.
- Kein unbegrenztes Auto-DJ / Massen-Suggest durch die KI.
