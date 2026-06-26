<!--
SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
Copyright (c) 2026 Julian Zienert
-->

# Remote DJ MCP — Design (Phase 2 public, „für alle")

> Status: **Phasen 1b–2c umgesetzt & end-to-end getestet** (mit Dev-Identity);
> **Phase 3 offen**: Web-Consent-Seite (cuevote-client), Hosting, Public-Rollout
> (gated auf Quota-Review + `/security-review`). · Stand: 2026-06-26
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

## 8. Deployment & Web-Consent-Vertrag (Phase 3)

**Server (`cuevote-server/.env`):** `MCP_SESSION_SECRET=<random>` aktiviert die
interne `mint-session`-Route (localhost). `MCP_SESSION_TTL` optional (Default 3600).
`CUEVOTE_OAUTH_FINALIZE_SECRET=<random>` (= MCP-Wert) + `MCP_INTERNAL_URL`
(Default `http://127.0.0.1:8082`) aktivieren den `MCP_AUTHORIZE`-Consent-Bridge.

**Remote-MCP (`cuevote-mcp/.env`), läuft als eigener PM2-Dienst (`dist/http.js`):**
`CUEVOTE_PUBLIC_URL=https://mcp.cuevote.com`, `CUEVOTE_MINT_SECRET=`(=Server-
`MCP_SESSION_SECRET`), `CUEVOTE_WS_URL=ws://127.0.0.1:8080`,
`CUEVOTE_WS_ORIGIN=https://cuevote.com`, `CUEVOTE_OAUTH_CONSENT_URL`,
`CUEVOTE_OAUTH_FINALIZE_SECRET`, `CUEVOTE_SUGGEST_PER_MIN`. **`CUEVOTE_OAUTH_DEV_USER`
in Prod leer lassen** (umgeht Login).

**nginx:** `server { server_name mcp.cuevote.com; … proxy_pass http://127.0.0.1:8082; }`
(WS/HTTP-Header durchreichen). **Cloudflare:** den `mcp`-Record orange-clouden
(Origin-IP versteckt).

**Web-Consent-Seite (cuevote-client) — der einzige noch fehlende Baustein:**
Eine Route unter `CUEVOTE_OAUTH_CONSENT_URL` (z. B. `/connect-ai`), die
1. `?auth=<handle>` liest,
2. den User per Google einloggt (bestehender Flow),
3. einen Consent-Screen zeigt („Diese KI darf in deinem Namen Songs vorschlagen/voten"),
4. bei Zustimmung über die **bestehende WS-Verbindung** `MCP_AUTHORIZE { handle }`
   sendet (der User ist auf diesem Socket schon eingeloggt),
5. auf `MCP_AUTHORIZE_RESULT { redirectTo }` wartet und den Browser dorthin
   weiterleitet (zurück zum MCP-Client mit dem Code).

> **Sicherheit (korrigiert):** Der Browser ruft **nicht** den Finalize-Endpoint
> mit dem Secret auf — das Secret darf nie in den Client. Stattdessen geht die
> Zustimmung über `cuevote-server` (`MCP_AUTHORIZE`, authentifiziert über die
> Session des Users); der Server fügt die `userId` hinzu und ruft
> `POST {MCP}/oauth/finalize` **server-zu-server** mit `CUEVOTE_OAUTH_FINALIZE_SECRET`.
> Server (`MCP_AUTHORIZE`-Handler) **und** MCP (`/oauth/finalize`, Pending-Store)
> **sind implementiert & getestet**; nur die React-Seite fehlt noch.

## 9. Status-Checkliste

- [x] **1b** Remote-HTTP-Transport, DJ-tools-only, pro-Session — getestet
- [x] **2a** `mint-session`-Endpoint (Server) — getestet
- [x] **2b** Token-Provider-Bridge (mintet WS-Session als User) — getestet
- [x] **2c** OAuth 2.1 (Discovery/Register/Authorize-PKCE/Token/Verify) — e2e getestet (Dev-Identity)
- [x] **3b** pro-User-Suggest-Rate-Limit (Quota-Guardrail) — getestet
- [x] **3c** Hosting-/Env-Doku + Web-Vertrag
- [x] **3a (Server)** `MCP_AUTHORIZE`-Consent-Bridge (Secret bleibt server-seitig) — e2e getestet
- [x] **3a (Client)** Web-Consent-Seite `/connect-ai` (React, 35 Sprachen) — gebaut + im Browser verifiziert (DE/NL geprüft). ⚠️ Die 33 Nicht-EN/DE-Übersetzungen sind Maschinen-Entwürfe und sollten review't werden.
- [ ] **Public-Rollout** — gated auf YouTube-Quota-Review + `/security-review`
