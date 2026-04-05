# Spotify Integration Audit

## 1. OAuth & Token Management (`cuevote-server/spotify.js`)

### 1.1 `isConfigured()` — OK
Prueft `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`. Korrekt.

### 1.2 `getAuthUrl(userId)` — BUG (Mittel)
**CSRF-Schwachstelle**: Der `state`-Parameter wird direkt auf `userId` gesetzt (Zeile 29). Der OAuth-`state`-Parameter sollte ein zufaelliger, serverseitig verifizierter Wert sein, um CSRF-Angriffe zu verhindern.

**Angriffsszenario**: Ein Angreifer ruft `/api/spotify/auth?userId=OPFER_ID` auf, authentifiziert sich mit seinem eigenen Spotify-Account. Der Server speichert dann die Spotify-Tokens des Angreifers unter der userId des Opfers. Ergebnis: Der Angreifer kontrolliert die Musik im Room des Opfers.

**Fix**: Zufaelligen `state`-Wert generieren, in einer serverseitigen Map (`state -> userId`) speichern, und im Callback verifizieren.

### 1.3 `exchangeCode(code)` Fehlerfall — OK
Loggt Fehler, wirft Exception mit Status-Code.

### 1.4 `exchangeCode(code)` Erfolg — OK
Gibt JSON korrekt zurueck.

### 1.5 `storeTokens()` Ablauf-Buffer — OK
`Date.now() + (expires_in * 1000) - 300000` = 5 Minuten vor Ablauf. Korrekt.
**Gut**: Zeile 81 bewahrt den alten Refresh-Token, falls Spotify keinen neuen sendet.

### 1.6 `getAccessToken()` gueltiger Token — OK
Gibt Token direkt zurueck wenn `Date.now() < expiresAt`.

### 1.7 `getAccessToken()` abgelaufener Token — OK
Refresh-Logik korrekt. Bei Fehler: Token geloescht, `null` zurueck.

### 1.8 `getAccessToken()` concurrent Refresh — OK
`refreshInFlight` Map verhindert parallele Refresh-Requests. `finally`-Block raeumt auf.

### 1.9 `getAccessToken()` ohne Tokens — OK
Gibt `null` zurueck.

### 1.10 `refreshAccessToken()` bei revoked Token — BUG (Mittel)
Die Funktion loescht den Token und gibt `null` zurueck, aber der Client wird **nicht aktiv benachrichtigt**, dass eine Re-Authentifizierung noetig ist. Der naechste API-Call schlaegt einfach still fehl.

**Fix**: Nach Token-Loesch sollte ein `SPOTIFY_REAUTH`-Event an den Room-Owner gesendet werden.

### 1.11 In-Memory Token Store — Bekannte Limitation (Niedrig)
Alle Tokens gehen bei Server-Neustart verloren. Fuer Prototyp akzeptabel.

### 1.12 `hasTokens()` — BUG (Niedrig)
Prueft nur ob ein Eintrag existiert (`tokenStore.has()`), nicht ob der Token noch gueltig ist oder ein Refresh-Token vorhanden ist. Kann False-Positives liefern wenn ein Token abgelaufen ist und der Refresh fehlgeschlagen ist (Token wird erst bei `getAccessToken()` geloescht).

### 1.13 `searchSpotify()` — OK
Mapping korrekt: `duration_ms` -> Sekunden, Artists joined, Thumbnail vom ersten Album-Bild.
**Hinweis**: `preview_url` wird von Spotify zunehmend als `null` zurueckgegeben. Viele Tracks haben keinen Preview mehr.

### 1.14 `getTrackDetails()` — OK
Gleiche Mapping-Logik. `encodeURIComponent` fuer trackId im URL-Pfad.

### 1.15 `getRecommendations()` — OK mit Vorbehalt
Funktioniert, aber nutzt nur `seed_tracks`. Keine `seed_artists` oder `seed_genres` fuer bessere Ergebnisse.
**Pruefen**: Spotify hat den `/v1/recommendations`-Endpoint eingeschraenkt. Testen ob er noch funktioniert.

### 1.16 Duplikat-Mapping in 3 Funktionen — Verbesserung (Niedrig)
`searchSpotify()`, `getTrackDetails()`, `getRecommendations()` haben identisches Track-Mapping (Zeilen 149-157, 170-178, 198-206). Sollte eine Helper-Funktion sein.

---

## 2. HTTP Routes (`cuevote-server/index.js`)

### 2.1 `GET /api/spotify/auth` ohne userId — OK
Gibt 400 mit "userId required" zurueck.

### 2.2 `GET /api/spotify/auth` nicht konfiguriert — OK
Gibt 503 mit "Spotify not configured" zurueck.

### 2.3 `GET /api/spotify/auth` Erfolg — OK
302 Redirect zur Spotify OAuth URL.

### 2.4 `GET /api/spotify/callback` mit error-Param — OK (mit Vorbehalt)
Error-String wird via `JSON.stringify(String(error))` sanitisiert — guter XSS-Schutz.

**Problem**: `postMessage(..., '*')` auf Zeile 105 sendet die Nachricht an **jeden Origin**. Sollte auf den App-Origin beschraenkt werden (z.B. `window.location.origin` oder eine hardcodierte URL).

Gleiches Problem auf Zeilen 122 und 129.

### 2.5 `GET /api/spotify/callback` ohne code/state — OK
Gibt 400 zurueck.

### 2.6 `GET /api/spotify/callback` Erfolg — OK
Token-Exchange und Speicherung korrekt.

### 2.7 `GET /api/spotify/token` ohne Session — OK
Gibt 401 "session required" zurueck.

### 2.8 `GET /api/spotify/token` falsche Session — OK
Gibt 403 "Unauthorized" zurueck. **Gut**: Verifiziert `session.user_id === userId` (Zeile 150).

### 2.9 `GET /api/spotify/token` nicht authentifiziert — OK
Gibt 401 "Not authenticated" zurueck.

### 2.10 `GET /api/spotify/token` Erfolg — OK
Gibt `{ token }` zurueck mit 200.

### 2.11 Session-Token als GET-Parameter — BUG (Mittel)
`/api/spotify/token?userId=X&session=Y` uebergibt den Session-Token als Query-Parameter. Dieser landet in:
- Server-Access-Logs
- Browser-History
- Referrer-Headers

**Fix**: POST-Request verwenden oder Session-Token im `Authorization`-Header senden.

### 2.12 `postMessage` targetOrigin `'*'` — BUG (Mittel)
Auf Zeilen 105, 122, 129 wird `postMessage` mit `'*'` als targetOrigin verwendet. Jede Seite die das Popup geoeffnet hat kann die Auth-Nachricht empfangen.

**Fix**: `window.opener?.postMessage(..., '${APP_ORIGIN}')` mit dem Origin der Anwendung.

### 2.13 CREATE_ROOM musicSource — OK
Zeile 639: `music_source: (musicSource === 'spotify') ? 'spotify' : 'youtube'` — sauberer Fallback auf 'youtube' bei ungueltigem Wert.

---

## 3. Room-Erstellung & Settings (`Room.js`, `index.js`)

### 3.1 CREATE_ROOM mit `musicSource: 'spotify'` — OK
Strikte Pruefung auf Zeile 639. DB korrekt gespeichert.

### 3.2 CREATE_ROOM ohne musicSource — OK
Default 'youtube' durch Fallback in Zeile 639.

### 3.3 UPDATE_SETTINGS: youtube -> spotify — OK
Zeilen 1671-1686: Queue, currentTrack, progress, pendingSuggestions alle geleert. DB aktualisiert.

### 3.4 UPDATE_SETTINGS: spotify -> youtube — OK
Gleicher Code-Pfad.

### 3.5 UPDATE_SETTINGS: gleiche Source — OK
Zeile 1672: `if (musicSource !== this.state.musicSource)` — kein Reset bei unveraenderter Source.

### 3.6 Doppeltes State-Update bei kombiniertem Settings-Wechsel — BUG (Niedrig)
Wenn musicSource UND andere Settings gleichzeitig geaendert werden, gibt es zwei separate `updateState()`-Aufrufe (Zeile 1646 und 1673). Das loest zwei Broadcasts an alle Clients aus. Koennte kurzes UI-Flackern verursachen.

**Fix**: musicSource-Logik in den `updates`-Block integrieren.

---

## 4. Song-Suche & Suggestion (`Room.js` -> `handleSuggestSongSpotify`)

### 4.1 Suche mit gueltigem Query — OK
Vollstaendiger Flow: Cache-Check -> API-Call -> Track erstellen -> Queue/Pending.

### 4.2 Cache-Hit (< 28 Tage) — OK
Zeile 1250: `2419200` Sekunden = 28 Tage. Kein API-Call bei Cache-Hit.

### 4.3 Abgelaufener Cache — OK
Faellt durch zu API-Call.

### 4.4 Ohne Owner-Token — OK
Zeile 1292-1295: Klare Fehlermeldung.

### 4.5 Rate Limiting (5s Cooldown) — OK
Zeile 1235: `now - ws.lastSuggestionTime < 5000`.

### 4.6 Owner Bypass — OK
`canBypass` Parameter wird korrekt weitergereicht.

### 4.7 Gebannter Track — OK
Beide Pfade gedeckt: Cache (Zeile 1255) und API (Zeile 1308).

### 4.8 Max Duration — OK
Beide Pfade gedeckt: Cache (Zeile 1260) und API (Zeile 1309).

### 4.9 Queue voll + Smart Queue — OK
Zeilen 1207-1231: Worst-Track-Entfernung korrekt implementiert.

### 4.10 Manual Approval — OK
Zeilen 1375-1386: Track in pendingSuggestions, Return ohne Queue-Add.

### 4.11 Auto Approval — OK
Faellt durch zu Queue-Add.

### 4.12 Duplikat-Check — OK (by design)
Zeilen 1356-1367: Title-basiert (lowercase). Gleiche Logik wie YouTube. Fuer Spotify-Tracks mit exakten API-Titeln akzeptabel.

### 4.13 Leere Suchergebnisse — OK
Zeile 1300-1303: Klare Fehlermeldung.

### 4.14 `getSourceId()` Prioritaet — BUG (Niedrig)
Zeile 8-10: `return track?.videoId || track?.trackId || null`. Bei einem Spotify-Track mit versehentlichem `videoId`-Feld wuerde `videoId` Vorrang haben. Fragile Annahme.

**Fix**: Explizit nach `track.source` unterscheiden: `track.source === 'spotify' ? track.trackId : track.videoId`.

### 4.15 Ban-Check im Cache-Pfad — BUG (Niedrig)
Zeile 1255: `getSourceId(b) === rawId`. Verwendet `getSourceId`, was `videoId || trackId` zurueckgibt. Wenn gebannte Tracks inkonsistente Felder haben, koennten sie nicht erkannt werden. Haengt mit 4.14 zusammen.

### 4.16 Nur erster Suchtreffer wird gecacht — Verbesserung (Niedrig)
Nur der erste passende Track wird per `cacheSearchTerm()` gecacht. Wenn dieser Track spaeter gebannt wird, liefert der Cache immer noch den gebannten Track. Der Cache-Pfad prueft zwar auf Bann (Zeile 1255), aber faellt dann durch zum API-Call statt zum naechsten Cache-Ergebnis.

---

## 5. Recommendations (`Room.js` -> `handleFetchSuggestions`)

### 5.1 Recommendations mit gueltigem trackId — OK
Zeile 768: API-Call mit Owner-Token.

### 5.2 Cache-Hit — OK
Zeile 750: 30 Tage TTL (2592000 Sekunden).

### 5.3 Seed-Track Filterung — OK
Zeile 771: `filter(r => r.trackId !== trackId)`.

### 5.4 Ohne Owner-Token — OK
Zeile 763-765: Fehlermeldung.

### 5.5 Spotify nicht konfiguriert — OK
Zeile 758-760: Fehlermeldung.

### 5.6 Cache-TTL Inkonsistenz — Verbesserung (Niedrig)
Search-Cache: 28 Tage (2419200s, Zeile 1250). Recommendations-Cache: 30 Tage (2592000s, Zeile 750). Sollte vereinheitlicht werden.

---

## 6. Playback & Fehlerbehandlung (Server-Seite)

### 6.1 PLAYBACK_ERROR mit SPOTIFY_AUTH_ERROR — OK
Zeile 1533-1535: Broadcast `SPOTIFY_REAUTH`, Playback pausiert.

### 6.2 PLAYBACK_ERROR anderer Fehler — OK
Zeile 1537: `handleNextTrack()` aufgerufen.

### 6.3 Fehler-Validierung vor Handling — OK
Zeile 1528: Prueft ob `errorSourceId` zum `currentTrack` passt. Verhindert veraltete Error-Meldungen.

### 6.4 Auto-Refill fuer Spotify — OK
Zeile 379: `isSpotifyRoom` Check. IP-Block und Music-Only Filter korrekt uebersprungen (Zeilen 413-419).

### 6.5 Client: `spotifyPlayTrack()` — OK
PUT zu Spotify API mit korrekter device_id und Track-URI. Gute Fehlerbehandlung:
- 401/403: Setzt `spotifyNeedsAuth`, sendet `PLAYBACK_ERROR`
- 404: Setzt Device zurueck (Player disconnected)
- Netzwerk-Fehler: Console-Log, kein Crash

### 6.6 Client: Player disconnect bei Source-Wechsel — OK
Zeilen 978-994: useEffect Cleanup bei `isSpotify`-Aenderung. Beide Player-Typen (disconnect/destroy) abgedeckt.

### 6.7 Client: Player disconnect bei Unmount — OK
Zeilen 940-955: playerContainerRef Callback mit Cleanup.

### 6.8 Client: Pause/Resume — OK
Zeilen 1204/1210: `playerRef.current?.pause?.()` / `resume?.()`. Korrekt fuer Guests (lokal) und Owner (Server-Message).

### 6.9 Client: Volume — OK
Zeilen 1220/1236: `volumeRef.current / 100` — korrekte Umrechnung auf 0-1 Range fuer Spotify.

### 6.10 Client: Seek — OK
Zeile 1354: `playerRef.current.seek?.(seconds * 1000)` — korrekte Umrechnung in Millisekunden.

### 6.11 Client: Mute-Toggle bei Volume-Aenderung — BUG (Niedrig)
Zeile 1240-1243: Bei Volume-Aenderung im Muted-Zustand wird fuer YouTube `unMute()` aufgerufen, fuer Spotify nicht. Die Volume-Aenderung via `setVolume()` hebt den Mute zwar implizit auf, aber der UI-State (`isMuted`) wird korrekt zurueckgesetzt (Zeile 1242).

---

## 7. Spotify Player Initialisierung (`RoomBody.jsx`)

### 7.1 `loadSpotifySDK()` — OK
Duplikat-Check fuer Script-Tags (Zeile 786). Drei Pfade korrekt: SDK geladen, SDK laedt, SDK nicht geladen.

### 7.2 `initializeSpotifyPlayer()` — OK (mit Vorbehalt)
- Nur Owner initialisiert (Zeile 817)
- Race-Condition-Schutz via `playerInitIdRef` (Zeile 818/821)
- **Vorbehalt**: `getOAuthToken`-Callback (Zeile 833-835) ruft `fetchSpotifyToken()` auf. Wenn der Server `null` zurueckgibt, wird `cb(null)` aufgerufen. Das Spotify SDK koennte damit nicht korrekt umgehen.

### 7.3 Player ready Event — OK
Device-ID und isPlayerReady korrekt gesetzt.

### 7.4 Player not_ready Event — OK
isPlayerReady auf false gesetzt.

### 7.5 `player_state_changed` — OK (mit Edge-Case)
Track-End-Erkennung (Zeilen 868-876):
- Bedingung 1: `position === 0 && previous_tracks.length > 0` — Track fertig
- Bedingung 2: `position >= duration - 1000` — Innerhalb 1s vom Ende
- Beide nur bei `paused === true` — verhindert False-Positives bei Seek

**Edge Case**: User pausiert manuell bei Position 0 mit Previous-Tracks → `isAtEnd` wird true. In der Praxis unwahrscheinlich.

Nur Owner sendet `NEXT_TRACK` (Zeile 873-875) — korrekt.

### 7.6 `authentication_error` — OK
Zeilen 883-888: Setzt needsAuth, sendet PLAYBACK_ERROR an Server.

### 7.7 `account_error` — BUG (Hoch)
Zeilen 891-893: **Nur Console-Log, kein User-Feedback!** Wenn der User kein Spotify Premium hat, sieht er nichts — der Player funktioniert einfach nicht, ohne Erklaerung.

**Fix**: Fehlermeldung an den User anzeigen, z.B. via Toast: "Spotify Premium is required for playback."

### 7.8 Retry bei spaeter Owner-Status — OK
Zeilen 971-976: useEffect beobachtet `isOwner`-Aenderungen. Startet Init erneut wenn Owner-Info spaet kommt.

### 7.9 Auth Popup: Erfolg — OK
Zeilen 915-919: Listener entfernt, Player initialisiert.

### 7.10 Auth Popup: Fehler — BUG (Mittel)
Zeilen 920-923: Nur Console-Log. **Kein User-Feedback** bei fehlgeschlagener Authentifizierung.

**Fix**: Toast oder UI-Hinweis anzeigen: "Spotify authentication failed. Please try again."

### 7.11 Auth Listener Cleanup — OK
Zeilen 930-938: useEffect Cleanup entfernt Listener bei Unmount.

### 7.12 postMessage ohne Origin-Validierung — BUG (Mittel)
Zeile 914: `event.data?.type === 'SPOTIFY_AUTH_SUCCESS'` wird geprueft, aber `event.origin` wird **nicht validiert**. Jede Seite koennte eine gefaelschte `SPOTIFY_AUTH_SUCCESS`-Nachricht senden.

**Impact**: Begrenzt — ein Angreifer koennte `setSpotifyNeedsAuth(false)` und `initializeSpotifyPlayer()` ausloesen, aber ohne gueltige Tokens wuerde die Initialisierung fehlschlagen.

**Fix**: `event.origin` gegen den Server-Origin pruefen.

### 7.13 URL-Konstruktion fuer Server-Calls — Verbesserung (Niedrig)
Zeile 803/911: `import.meta.env.VITE_WS_URL?.replace('wss://', 'https://').replace('ws://', 'http://').replace('/ws', '')` — fragile String-Manipulation. Funktioniert fuer Standardfaelle, aber z.B. `/ws` in anderen URL-Teilen wuerde falsch ersetzt.

**Fix**: `new URL()` fuer sauberes URL-Parsing verwenden.
