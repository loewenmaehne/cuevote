# Spotify Playback Audit — CueVote

**Branch:** `spotify`
**Datum:** 2026-04-07
**Scope:** Vollständige Analyse des Spotify-Abspielverhaltens: Initialisierung, Autoplay, Mute-State, Race Conditions, und alle identifizierten Bugs.

---

## Zusammenfassung der gemeldeten Symptome

1. **Musik spielt manchmal erst nach F5 (Seite neu laden)**
2. **Musik ist am Anfang oft gepaused oder gemutet**
3. **Grundsätzlich unvorhersehbares Abspielverhalten**

---

## 1. Architektur-Überblick

Spotify-Playback in CueVote folgt einer **Owner-Only** Architektur:

- Nur der Room-Owner betreibt den Spotify Web Playback SDK Player
- Gäste sehen Albumcover + Track-Info, hören aber über den Owner's Player
- Der Server verwaltet State (isPlaying, progress, queue) und broadcast an alle Clients
- Authentifizierung läuft über OAuth 2.0 mit In-Memory Token-Speicher

### Beteiligte Dateien

| Datei | Rolle |
|-------|-------|
| `RoomBody.jsx:806-1204` | Spotify SDK Init, Device Polling, Auth Flow |
| `RoomBody.jsx:1206-1368` | Track Loading, Resume, Play/Pause Sync |
| `RoomBody.jsx:1481-1550` | User Interaction Handler (Play/Pause, Mute, Volume) |
| `Player.jsx` | Spotify UI (Albumcover, Auth-Button, Error States) |
| `spotify.js` | Backend Token Management, Search, Recommendations |
| `Room.js:229-235` | Owner-Disconnect → Pause Broadcast |
| `Room.js:1600-1614` | Spotify Error Handling |
| `index.js:75-185` | OAuth Routes (`/api/spotify/auth`, `/callback`, `/token`) |

---

## 2. Ablauf von Seitenaufruf bis erstem Ton

```
Seite geladen
  │
  ├─ WebSocket verbindet → Server sendet Room State (musicSource: 'spotify')
  │
  ├─ isSpotify = true wird abgeleitet (Zeile 178)
  │
  ├─ playerContainerRef wird gesetzt → initializeSpotifyPlayer() (Zeile 1147-1149)
  │   │
  │   ├─ Prüft: hasConsent && isOwnerRef.current  ← [BUG #1: Race Condition]
  │   │
  │   ├─ loadSpotifySDK() → Script-Tag laden (~1-2s)
  │   │
  │   ├─ fetchSpotifyToken() → POST /api/spotify/token (~500ms)
  │   │   └─ Kein Token? → spotifyNeedsAuth = true → STOP
  │   │
  │   ├─ new Spotify.Player({ volume: volumeRef.current / 100 })
  │   │
  │   ├─ player.connect() → SDK WebSocket zu Spotify (~500ms)
  │   │
  │   ├─ 'ready' Event → Device ID empfangen
  │   │   │
  │   │   ├─ Device Polling Loop (bis zu 8 Versuche, ~8s max)
  │   │   │   └─ Polls GET /me/player/devices alle 500-1000ms
  │   │   │
  │   │   ├─ Falls nicht gefunden: Transfer Playback (PUT /me/player)
  │   │   │
  │   │   ├─ setIsPlayerReady(true)
  │   │   └─ setIsMuted(false)  ← [BUG #3: Widerspruch zum Initialstate]
  │   │
  │   └─ activateElement Handler registriert (click/touchstart)
  │       └─ Ohne User-Klick: SDK verbunden, ABER kein Audio
  │
  ├─ Main Playback Effect (Zeile 1352-1368) evaluiert:
  │   │
  │   ├─ hasFullscreenOverlay? → pause
  │   ├─ userHasInteractedRef.current && (isPlaying || isLocallyPlaying) && !isLocallyPaused?
  │   │   └─ → spotifyResume()
  │   └─ Sonst → pause  ← [BUG #4: Standard ist PAUSE]
  │
  └─ Track Change Effect (Zeile 1321-1347):
      └─ spotifyPlayTrack(trackId, positionMs) mit Retry-Logik
```

**Best Case: ~4-7 Sekunden bis zum ersten Ton**
**Worst Case: ~18-30 Sekunden oder komplett ohne Sound**

---

## 3. Identifizierte Bugs und Probleme

### BUG #1: Owner-Status Race Condition (KRITISCH)

**Datei:** `RoomBody.jsx:862-863`
```js
const initializeSpotifyPlayer = useCallback(async () => {
    if (!hasConsent || !isOwnerRef.current) return;  // ← Problem
```

**Problem:** `playerContainerRef` wird beim DOM-Mount aufgerufen (Zeile 1147), aber `isOwnerRef.current` ist zu diesem Zeitpunkt oft noch `false`, weil der Server-State (mit `ownerId`) noch nicht angekommen ist. Die Initialisierung wird übersprungen.

**Workaround vorhanden (Zeile 1177-1181):**
```js
useEffect(() => {
    if (isSpotify && isOwner && hasConsent && !isPlayerReady && !spotifyNeedsAuth) {
        initializeSpotifyPlayer();
    }
}, [isOwner, isSpotify, hasConsent, isPlayerReady, spotifyNeedsAuth, initializeSpotifyPlayer]);
```

**Bewertung:** Der Workaround funktioniert, ABER: Zwischen DOM-Mount und Owner-Bestätigung vergehen typisch 500ms-2s. In dieser Zeit sieht der User die "Connect Spotify" UI, obwohl er bereits authentifiziert ist. Das erklärt, warum **F5 manchmal hilft** — beim Reload ist der Owner-Status aus dem Cache schneller verfügbar.

**Verbesserungsvorschlag:** Die `isOwnerRef.current`-Prüfung aus `initializeSpotifyPlayer` entfernen und stattdessen den Retry-Effect als einzigen Trigger nutzen, oder `initializeSpotifyPlayer` immer aufrufen und den Owner-Check erst bei Token-Fetch machen.

---

### BUG #2: `isMuted` startet mit `true`, aber Spotify ignoriert das (KRITISCH)

**Datei:** `RoomBody.jsx:363`
```js
const [isMuted, setIsMuted] = useState(true);  // ← Immer true bei Seitenaufruf
```

**Datei:** `RoomBody.jsx:889`
```js
const player = new SpotifySDK.Player({
    volume: volumeRef.current / 100,  // ← volume=80 → 0.8 (NICHT 0!)
```

**Datei:** `RoomBody.jsx:941-942`
```js
setIsPlayerReady(true);
setIsMuted(false);  // ← Setzt muted auf false wenn Device ready ist
```

**Ablauf:**
1. `isMuted = true` (Initialwert)
2. Spotify Player wird mit `volume: 0.8` erstellt (ignoriert Mute-State!)
3. Wenn Device ready: `setIsMuted(false)`

**Problem:** Es gibt kein `player.setVolume(0)` beim Start, obwohl `isMuted = true`. Der Spotify Player spielt mit voller Lautstärke, während die UI "muted" zeigt. Dann flippt `setIsMuted(false)` den State, und plötzlich stimmt die UI — aber der Übergang ist inkonsistent.

**Warum "manchmal gemutet, manchmal nicht":** Das hängt vom Timing ab:
- Wenn `ready` schnell feuert: `setIsMuted(false)` kommt bevor der User es merkt
- Wenn `ready` langsam ist: User sieht `isMuted=true` in der UI, aber SDK spielt mit Volume 80

**Fix-Vorschlag:**
```js
// Bei Player-Erstellung:
volume: isMutedRef.current ? 0 : volumeRef.current / 100

// ODER nach 'ready':
if (isMutedRef.current) player.setVolume(0);
```

---

### BUG #3: `activateElement()` erst bei User-Klick — Audio-Stille garantiert (KRITISCH)

**Datei:** `RoomBody.jsx:1014-1029`
```js
const activateHandler = () => {
    player.activateElement();
    document.removeEventListener('click', activateHandler, true);
    document.removeEventListener('touchstart', activateHandler, true);
};
document.addEventListener('click', activateHandler, true);
document.addEventListener('touchstart', activateHandler, true);
```

**Problem:** Die Browser Autoplay Policy erfordert einen User-Gesture, bevor Audio abgespielt werden kann. `activateElement()` wird erst beim **nächsten Klick** aufgerufen. Das bedeutet:

1. Player verbindet und meldet sich "ready"
2. Track wird geladen (PUT /me/player/play — erfolgreich!)
3. SDK meldet `player_state_changed: paused=false`
4. **ABER: Kein Audio** — weil `activateElement()` noch nicht aufgerufen wurde
5. Erst nach dem nächsten Klick irgendwo auf der Seite kommt Ton

**Das ist die Hauptursache für "Musik erst nach F5".** Beim Reload interagiert der User typisch durch Klick auf "Unmute" oder Play-Button — was `activateElement()` triggert.

**Zusätzlich:** In `handlePlayPause` (Zeile 1483) wird `activateElement()` als Safety-Net aufgerufen:
```js
if (isSpotify && playerRef.current?.activateElement) {
    playerRef.current.activateElement();
}
```
Aber das hilft nur, wenn der User explizit Play drückt — nicht beim automatischen Start.

**Fix-Vorschlag:** `activateElement()` sollte **sofort** aufgerufen werden, sobald ein User-Klick irgendwo auf der Seite stattfindet — auch VOR der Player-Initialisierung. Alternativ einen expliziten "Tap to start" Overlay zeigen (wie es YouTube-Embeds machen).

---

### BUG #4: Playback-Sync-Effect pausiert standardmäßig (HOCH)

**Datei:** `RoomBody.jsx:1352-1368`
```js
useEffect(() => {
    if (isPlayerReady && playerRef.current) {
        if (hasFullscreenOverlay) {
            pause();
        } else if (userHasInteractedRef.current && previewTrack) {
            spotifyResume();
        } else if (userHasInteractedRef.current && (isPlaying || isLocallyPlaying) && !isLocallyPaused) {
            spotifyResume();
        } else {
            pause();  // ← DEFAULT: Pause!
        }
    }
}, [...]);
```

**Problem:** Der `else`-Branch (Pause) wird getriggert wenn:
- `userHasInteractedRef.current === false` (User hat noch nicht geklickt), ODER
- `isPlaying === false` (Server sagt nicht "playing"), ODER
- `isLocallyPaused === true`

**Szenario:** User öffnet Room → Server state hat `isPlaying: true` → aber `userHasInteractedRef.current` ist noch `false` → Effect pausiert den Player!

**Das erklärt "Musik ist am Anfang paused":** Der Server sagt "playing", aber der Client pausiert, weil noch keine User-Interaktion stattgefunden hat.

**Fix-Vorschlag:** Für Owner sollte `userHasInteractedRef` nicht als Bedingung gelten — der Owner hat durch das Öffnen des Rooms bereits "interagiert". Oder den `isPlaying`-State als alleinigen Trigger nutzen:

```js
} else if (isPlaying && !isLocallyPaused) {
    spotifyResume();  // Keine userHasInteracted-Prüfung für Owner
}
```

---

### BUG #5: Device Polling blockiert `isPlayerReady` bis zu 8 Sekunden (MITTEL)

**Datei:** `RoomBody.jsx:892-942`

Das `ready`-Event vom Spotify SDK feuert, aber `setIsPlayerReady(true)` passiert erst NACH dem kompletten Device-Polling-Loop. Der Loop wartet bis zu 8 Sekunden (8 Versuche × 500-1000ms).

**Auswirkung:** Während des Pollings zeigt die UI keinen Player, keine Controls, und der Track-Change-Effect (Zeile 1321) kann nicht triggern.

**Fix-Vorschlag:** `setIsPlayerReady(true)` sofort nach `ready` setzen (mit Device-ID). Den Polling-Loop im Hintergrund weiterlaufen lassen. Falls `spotifyPlayTrack` einen 404 bekommt, ist die bestehende Retry-Logik (mit Transfer Playback) ohnehin vorhanden.

---

### BUG #6: Post-Play Verification Timing fragil (MITTEL)

**Datei:** `RoomBody.jsx:1266-1280`
```js
const verifyAndResume = async (n, delay) => {
    await new Promise(r => setTimeout(r, delay));
    const state = await playerRef.current.getCurrentState();
    if (state?.paused) await playerRef.current.togglePlay();
};
verifyAndResume(1, 800).then(() => {
    spotifyTrackLoadingRef.current = false;
    verifyAndResume(2, 1700);
});
```

**Problem:** Nach einem erfolgreichen `PUT /me/player/play` wird 800ms und 1700ms gewartet, dann geprüft ob der SDK noch `paused` meldet. Falls ja, wird `togglePlay()` aufgerufen.

Aber: Wenn `activateElement()` noch nicht aufgerufen wurde (BUG #3), wird `togglePlay()` ebenfalls keinen Audio-Output erzeugen. Die Verification "behebt" nichts, führt aber zu Console-Logs die suggerieren, dass alles funktioniert.

---

### BUG #7: `spotifyResume()` vs `spotifyTrackLoadingRef` Race (NIEDRIG)

**Datei:** `RoomBody.jsx:1211-1229`
```js
const spotifyResume = useCallback(async () => {
    if (spotifyTrackLoadingRef.current) return;  // ← Guard
    const state = await p.getCurrentState();
    if (state?.paused) await p.togglePlay();
}, []);
```

**Datei:** `RoomBody.jsx:1277-1278`
```js
verifyAndResume(1, 800).then(() => {
    spotifyTrackLoadingRef.current = false;  // ← Wird erst nach 800ms false
```

**Problem:** Der Main Playback Effect (Zeile 1360-1361) ruft `spotifyResume()` auf wenn `isPlaying` sich ändert. Wenn das passiert während ein Track geladen wird, greift der Guard. Aber das bedeutet auch: Wenn der Server `isPlaying: true` schickt während ein Track-Load läuft, wird die Resume-Anweisung verworfen — und nach dem Load gibt es keinen erneuten Trigger.

---

### BUG #8: Volume-Skala Mismatch YouTube vs Spotify (NIEDRIG)

**Datei:** `RoomBody.jsx:1534-1550`
```js
const handleVolumeChange = (e) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (isSpotify) {
        playerRef.current.setVolume?.(newVolume / 100);  // 0-1 Skala
    } else {
        playerRef.current.setVolume?.(newVolume);          // 0-100 Skala
    }
```

**Problem:** Spotify SDK nutzt 0.0-1.0, YouTube 0-100. Das wird korrekt gehandelt, ABER: beim Unmute (Zeile 1544) wird `playerRef.current.unMute?.()` nur für YouTube aufgerufen — Spotify fehlt. Wenn ein Spotify-User den Volume-Slider bewegt während gemutet:

```js
if (isMuted) {
    if (!isSpotify) playerRef.current.unMute?.();  // ← Spotify: kein unMute!
    setIsMuted(false);
}
```

Das `setIsMuted(false)` wird gesetzt, aber Spotify volume bleibt 0 (weil `handleMuteToggle` vorher `setVolume(0)` gemacht hat). Der Slider bewegt sich, aber der Sound bleibt stumm.

**Fix:** Beim Volume-Change sollte auch für Spotify die Volume auf den neuen Wert gesetzt werden (passiert bereits in Zeile 1539), ABER das alte Volume von 0 muss vorher überschrieben werden.

---

### BUG #9: `isSpotify` nicht in Stall-Detection-Guard (NIEDRIG)

**Datei:** `RoomBody.jsx:1414-1449`

Der Stall-Detection-Interval prüft `playerRef.current.getPlayerState?.()` — das ist eine YouTube-only Methode. Für Spotify gibt es einen Guard bei `isSpotify` in Zeile 1409, ABER der zweite `useEffect` (Zeile 1414) hat KEINEN `isSpotify`-Guard:

```js
useEffect(() => {
    if (!isPlaying || !isPlayerReady || !playerRef.current) return;
    const checkInterval = setInterval(() => {
        const state = playerRef.current.getPlayerState?.();  // undefined für Spotify
```

Da `getPlayerState` für Spotify `undefined` returniert und der Check `state === YouTubeState.BUFFERING` nie true wird, hat das keinen funktionalen Impact — aber es erzeugt unnötige Intervall-Checks alle 8 Sekunden.

---

### BUG #10: OAuth postMessage Cross-Origin Failure (MITTEL)

**Datei:** `index.js:133-134`
```js
window.opener?.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS' }, ${postMessageOrigin});
setTimeout(function() { window.close(); }, 500);
```

**Problem:** Nach dem Spotify OAuth-Redirect (accounts.spotify.com → eigener Server) ist `window.opener` oft `null`, weil der Browser die Referenz bei Cross-Origin-Navigation verliert.

**Workaround vorhanden (Zeile 1085-1119):** Polling-Fallback prüft alle 500ms ob Popup geschlossen wurde, dann fragt es den Server nach Tokens. Das funktioniert, dauert aber einen zusätzlichen Roundtrip.

**Auswirkung:** Gelegentlich muss der User doppelt authentifizieren, oder die Auth scheint "hängen zu bleiben" bis das Popup manuell geschlossen wird.

---

### BUG #11: In-Memory Token Store verliert Tokens bei Server-Restart (MITTEL)

**Datei:** `spotify.js:9`
```js
const tokenStore = new Map();
```

**Problem:** Alle Spotify-Tokens werden im RAM gespeichert. Bei Server-Restart oder Deploy sind alle Tokens weg. Jeder Owner muss sich neu authentifizieren.

**Auswirkung:** Nach jedem Deploy bricht die Spotify-Wiedergabe für alle Räume ab. `SPOTIFY_REAUTH` wird gebroadcastet.

---

## 4. Timing-Diagramm: Warum Playback oft fehlschlägt

```
t=0s     DOM Mount → playerContainerRef gesetzt
         isOwnerRef.current = false → initializeSpotifyPlayer() ABGEBROCHEN

t=0.5s   Server State empfangen → isOwner = true
         Retry-Effect triggert → initializeSpotifyPlayer() GESTARTET

t=1.0s   SDK Script geladen
t=1.5s   Token fetched
t=2.0s   Player connected

t=2.5s   'ready' Event → Device Polling STARTET
t=2.5s   ⚠ activateElement-Handler registriert (wartet auf Klick)

t=3-10s  Device Polling (bis zu 8 Versuche)

t=10s    setIsPlayerReady(true), setIsMuted(false)
         Main Playback Effect evaluiert:
         → userHasInteractedRef = false → PAUSE!

t=???    User klickt irgendwo → activateElement() aufgerufen
         ABER: Player ist bereits gepaused vom Effect!

         User drückt Play → handlePlayPause()
         → activateElement() (Safety Net)
         → PLAY_PAUSE: true an Server
         → spotifyResume() → togglePlay()
         → Audio startet ENDLICH
```

**Ergebnis:** Minimum 2 User-Aktionen nötig (1× irgendwo klicken + 1× Play drücken) bevor Audio zu hören ist.

---

## 5. Priorisierte Fix-Empfehlungen

### Priorität 1 — "Musik sofort abspielen"

1. **`activateElement()` aggressiver aufrufen:**
   - Beim allerersten Klick/Touch auf der Seite (vor Player-Init)
   - Einen "Tap to Start"-Overlay zeigen falls nötig
   - `activateElement()` bei jedem Play/Unmute/Volume-Change aufrufen (teilweise schon vorhanden)

2. **`userHasInteractedRef`-Check für Owner entfernen:**
   - Der Owner sollte automatisch spielen wenn `isPlaying: true` vom Server kommt
   - Die userHasInteracted-Prüfung ist für YouTube relevant (Autoplay-Policy), aber Spotify handhabt das über `activateElement()`

3. **`isMuted` Initial-State an Spotify anpassen:**
   - Entweder `isMuted: false` als Default für Spotify-Rooms
   - Oder Player mit `volume: 0` erstellen wenn `isMuted: true`

### Priorität 2 — "Schnellere Initialisierung"

4. **`setIsPlayerReady(true)` sofort bei 'ready' setzen:**
   - Device-Polling im Hintergrund weiterführen
   - Retry bei 404 in `spotifyPlayTrack` reicht als Fallback

5. **Owner-Check aus `initializeSpotifyPlayer` entfernen:**
   - Stattdessen nur im Retry-Effect prüfen
   - Vermeidet doppelte Initialisierung

### Priorität 3 — "Robustheit"

6. **Tokens in DB persistieren statt In-Memory**
7. **Volume-Unmute-Bug für Spotify fixen** (Zeile 1544)
8. **Stall-Detection-Effect mit `isSpotify`-Guard versehen**
9. **`spotifyTrackLoadingRef` Race bei Resume fixen** — nach Load-Ende erneut isPlaying-State prüfen

---

## 6. Test-Matrix

| Szenario | Erwartetes Verhalten | Aktuelles Verhalten |
|----------|---------------------|---------------------|
| Owner öffnet Spotify-Room mit laufendem Track | Audio startet sofort | Stille bis User klickt + Play drückt |
| Owner öffnet Room, kein Track in Queue | "Connect Spotify" Button | OK (funktioniert) |
| Owner drückt Play nach Pause | Audio resumed | Meistens OK, manchmal 1-2s Delay |
| Guest öffnet Spotify-Room | Albumcover + "Owner controls" | OK |
| Owner reconnected (F5) | Audio startet nach ~5s | Audio startet nach Klick + Play |
| Token läuft ab (nach 60min) | Automatischer Refresh | OK (5min Buffer, Deduplication) |
| Server-Restart | Owner muss neu authentifizieren | SPOTIFY_REAUTH wird gebroadcastet |
| Device geht offline | Automatische Pause | OK (not_ready Handler) |
| Track nicht verfügbar (403) | Skip zum nächsten | OK |
| Browser blockiert Autoplay | Visueller Hinweis | Kein Hinweis, stille Fehler |

---

## 7. Vergleich: Was YouTube besser macht

| Aspekt | YouTube | Spotify |
|--------|---------|---------|
| Autoplay-Erkennung | Expliziter Check nach 2s + UI-Overlay | Kein Autoplay-Overlay |
| Stall-Detection | 8s Intervall mit Retry | Keine Stall-Detection |
| Mute-Default | `isMuted: true` + `player.mute()` | `isMuted: true` aber `volume: 0.8` |
| Init-Reihenfolge | Script → Player → onReady (synchron) | Script → Token → Connect → Ready → Poll (asynchron) |
| Fehler-UI | Error-Overlay mit Codes | Console-Logs ohne UI-Feedback |

---

## 8. Quick-Wins (unter 30 Minuten Aufwand je)

1. **`setIsMuted(false)` beim Spotify-Player-Init** statt bei `ready` → konsistenter State
2. **`activateElement()` in `spotifyResume()` aufrufen** → jeder Resume-Versuch aktiviert auch Audio
3. **`isSpotify`-Guard in Stall-Detection-useEffect** → keine unnötigen YouTube-Checks
4. **Autoplay-Blocked-Overlay für Spotify** → User weiß warum kein Ton kommt
5. **Logging für `userHasInteractedRef`-State** → besseres Debugging
