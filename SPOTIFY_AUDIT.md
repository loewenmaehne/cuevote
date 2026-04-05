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
