import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { deviceDetection } from './utils/deviceDetection';
import { Volume2, VolumeX, ArrowLeft, Lock, X, Maximize2, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { Consent } from './contexts/ConsentContext';
import { Language } from './contexts/LanguageContext';
import { Header } from "./components/Header";
import { SuggestSongForm } from "./components/SuggestSongForm";
import { Player } from "./components/Player";
import { Queue } from "./components/Queue";
import { Suggestions } from "./components/Suggestions";
import { PlaylistView } from "./components/PlaylistView";
import { PrelistenOverlay } from "./components/PrelistenOverlay";
import { SettingsView } from "./components/SettingsView";
import { BannedVideosPage } from "./components/BannedVideos"; // Added this import
import { PlaybackControls } from "./components/PlaybackControls";
import { useWebSocketContext } from "./hooks/useWebSocketContext";

import PlayerErrorBoundary from "./components/PlayerErrorBoundary.jsx";
import { Toast } from "./components/Toast";
import { LoadingScreen } from "./components/LoadingScreen";



const YouTubeState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

function RoomBody() {
  const [CookieBlockedPlaceholderComponent, setCookieBlockedPlaceholder] = useState(null);
  const [pendingRequestsExports, setPendingRequestsExports] = useState(null);
  useEffect(() => {
    import('./components/CookieBlockedPlaceholder').then((m) => setCookieBlockedPlaceholder(() => m.CookieBlockedPlaceholder));
    import('./components/PendingRequests').then((m) => setPendingRequestsExports(m.PendingRequestsExports));
  }, []);
  const { roomId } = useParams();

  const navigate = useNavigate();
  const location = useLocation();
  const activeRoomId = roomId || "synthwave";

  const [localPlaylistView, setLocalPlaylistView] = useState(false);
  const [playlistActiveTab, setPlaylistActiveTab] = useState("playlist");
  const [controlsHeight, setControlsHeight] = useState(96);
  const [showSettings, setShowSettings] = useState(false);
  // const [hasConsent, setHasConsent] = useState(() => !!localStorage.getItem("cuevote_cookie_consent"));
  const { hasConsent, giveConsent } = Consent.useConsent();
  const { t } = Language.useLanguage();

  // console.log("App Component MOUNTED, Room:", activeRoomId);

  // Online Status & Device Class Injection
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    // Inject Device Classes for CSS targeting
    if (deviceDetection.isMobile()) document.body.classList.add('is-mobile');
    else document.body.classList.remove('is-mobile');

    if (deviceDetection.isTablet()) document.body.classList.add('is-tablet');
    else document.body.classList.remove('is-tablet');

    if (deviceDetection.isTV()) document.body.classList.add('is-tv');
    else document.body.classList.remove('is-tv');

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Native Bridge: Sync QR Button State


  // WebSocket connection (Shared)
  const {
    state: serverState,
    isConnected,
    sendMessage,
    lastError,
    lastErrorCode,
    lastErrorTimestamp,
    lastMessage,
    clientId,
    user,
    handleLogout,
    handleLoginSuccess,
    reconnectAttempt,
    forceReconnect,
    progressRef,
  } = useWebSocketContext();

  // Debounce the reconnecting banner — brief mobile disconnects (< 2.5 s) shouldn't flash a banner
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  useEffect(() => {
    if (isConnected) {
      setShowReconnectBanner(false);
      return;
    }
    const timer = setTimeout(() => setShowReconnectBanner(true), 2500);
    return () => clearTimeout(timer);
  }, [isConnected]);

  // Handle Delete Account Success (Moved up to avoid conditional hook call error)
  useEffect(() => {
    if (lastMessage && lastMessage.type === "DELETE_ACCOUNT_SUCCESS") {
      console.log("Account deleted successfully");
      handleLogout();
      navigate('/');
    }
    if (lastMessage && (lastMessage.type === "ROOM_DELETED" || (lastMessage.type === "error" && lastMessage.code === "ROOM_DELETED"))) {
      console.log("Room deleted, navigating to lobby");
      navigate('/');
    }
  }, [lastMessage, handleLogout, navigate]);

  const handleDeleteAccount = () => {
    sendMessage({ type: "DELETE_ACCOUNT", payload: {} });
  };

  const handleDeleteChannel = () => {
    console.log("SENDING DELETE_ROOM message");
    sendMessage({ type: "DELETE_ROOM", payload: {} });
  };

  // Destructure server state (Moved up for useEffect access)
  const {
    roomId: serverRoomId,
    queue = [],
    currentTrack = null,
    isPlaying = false,
    progress: _serverProgress = 0,
    activeChannel = "Synthwave",
    ownerId = null,
    suggestionsEnabled = true,
    musicOnly = false,
    maxDuration = 600,
    allowPrelisten = true,
    ownerBypass = true,
    maxQueueSize = 50,
    smartQueue = true,
    playlistViewMode = false,
    history = [],
    suggestionMode = 'auto',
    pendingSuggestions = [],
    ownerPopups = true,
    duplicateCooldown = 10,
    autoApproveKnown = true,
    autoRefill = false,
    bannedVideos = [], // Added this
    captionsEnabled = false,
    musicSource = 'youtube'
  } = serverState || {};

  const isSpotify = musicSource === 'spotify';

  // Calculate set of ALL source IDs currently in the queue or playing for suggestion "Added" check
  const queueVideoIds = useMemo(() => {
    const ids = new Set();
    const cid = currentTrack?.videoId || currentTrack?.trackId;
    if (cid) ids.add(cid);
    if (queue) {
      queue.forEach(t => {
        const id = t.videoId || t.trackId;
        if (id) ids.add(id);
      });
    }
    return ids;
  }, [queue, currentTrack]);

  const upcomingCount = useMemo(
    () => queue.filter(t => t.id !== currentTrack?.id).length,
    [queue, currentTrack]
  );

  useEffect(() => {
    if (upcomingCount === 0) {
      setIsQueueMinimized(true);
    }
  }, [upcomingCount]);

  const isOwner = user && ownerId && user.id === ownerId;
  // TV always ignores Venue Mode (shows video)
  // iOS Browsers (not native app) are FORCED into Venue Mode because video autoplay/playback is unreliable/broken in browser
  const isVenueMode = (playlistViewMode && !isOwner && !deviceDetection.isTV()) || (deviceDetection.isIOS() && !deviceDetection.isNativeApp());
  // TV always defaults to Fullscreen (CinemaMode), unless manually exited
  const isAnyPlaylistView = isVenueMode || localPlaylistView;

  const [isCinemaMode, setIsCinemaMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return deviceDetection.isTV() || ((deviceDetection.isMobile() && !deviceDetection.isTablet()) && window.matchMedia("(orientation: landscape)").matches);
  });

  // Force exit cinema mode when Venue Mode is activated
  useEffect(() => {
    if (isVenueMode) {
      setIsCinemaMode(false);
    }
  }, [isVenueMode]);

  // Pending Suggestions Handlers
  const handleApproveSuggestion = (trackId) => {
    sendMessage({ type: "APPROVE_SUGGESTION", payload: { trackId } });
  };

  const handleRejectSuggestion = (trackId) => {
    sendMessage({ type: "REJECT_SUGGESTION", payload: { trackId } });
  };

  const handleBanSuggestion = (trackId) => {
    sendMessage({ type: "BAN_SUGGESTION", payload: { trackId } });
  };

  const handleUnbanSong = (sourceId) => {
    if (isSpotify) {
      sendMessage({ type: "UNBAN_SONG", payload: { trackId: sourceId } });
    } else {
      sendMessage({ type: "UNBAN_SONG", payload: { videoId: sourceId } });
    }
  };

  // Trace Render Cycle
  // console.log(`[CLIENT TRACE] App Render.Active: ${activeRoomId}, Server: ${serverRoomId}, Stale ? ${serverState && serverRoomId && (serverRoomId.toString().trim().toLowerCase() !== activeRoomId.toString().trim().toLowerCase())} `);

  // Join Room on Connect or Room Change
  // const location = useLocation();

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const lastPasswordAttemptRef = useRef(null); // Track the last password we sent
  const prevIsConnectedRef = useRef(false);

  useEffect(() => {
    if (isConnected) {
      const isNewConnection = !prevIsConnectedRef.current;
      prevIsConnectedRef.current = true;

      if (!isNewConnection) {
        // Only apply "already in room" guards when NOT reconnecting.
        // After a reconnect the server has forgotten this client, so we must rejoin.
        if (location.state?.alreadyJoined && activeRoomId === serverRoomId) {
          console.log("[App] Skipping join, already joined from Lobby");
          return;
        }
        if (serverRoomId && activeRoomId && serverRoomId.toString().trim().toLowerCase() === activeRoomId.toString().trim().toLowerCase()) {
          console.log("[App] Skipping join, already in target room:", activeRoomId);
          return;
        }
      } else {
        console.log("[App] New connection detected, forcing room join:", activeRoomId);
      }

      const password = location.state?.password;
      lastPasswordAttemptRef.current = password;
      sendMessage({ type: "JOIN_ROOM", payload: { roomId: activeRoomId, password } });
    } else {
      prevIsConnectedRef.current = false;
    }
  }, [isConnected, activeRoomId, sendMessage, location.state, serverRoomId]);

  // Handle Password Required Error
  useEffect(() => {
    if (lastErrorCode === "PASSWORD_REQUIRED") {
      setShowPasswordModal(true);
      if (lastPasswordAttemptRef.current) {
        setPasswordError("Incorrect password");
      } else {
        setPasswordError("");
      }
    }
  }, [lastErrorCode, lastErrorTimestamp]);

  const [showQRModal, setShowQRModal] = useState(false);
  const [headerOverlay, setHeaderOverlay] = useState(false);
  const [settingsOverlay, setSettingsOverlay] = useState(false);

  // Clear modal on successful join
  useEffect(() => {
    if (serverState && serverRoomId && activeRoomId && serverRoomId.toLowerCase() === activeRoomId.toLowerCase()) {
      setShowPasswordModal(false);
      setPasswordError("");
      lastPasswordAttemptRef.current = null; // Reset

      // Auto-open Share Modal if requested (e.g. new channel)
      if (location.state?.showShareOnLoad) {
        setShowQRModal(true);
        // Clear the state so it doesn't trigger again on subsequent updates
        navigate(location.pathname, { replace: true, state: { ...location.state, showShareOnLoad: false } });
      }
    }
  }, [serverState, serverRoomId, activeRoomId, location.state, location.pathname, navigate]);


  const submitPasswordJoin = (e) => {
    e.preventDefault();
    setPasswordError(""); // Clear previous errors
    lastPasswordAttemptRef.current = passwordInput; // Track it
    sendMessage({ type: "JOIN_ROOM", payload: { roomId: activeRoomId, password: passwordInput } });
    // Do NOT close modal here. Wait for success or error.
    // setShowPasswordModal(false); 
    // setPasswordInput("");
  };

  // Connected-but-no-state guard: if WebSocket is connected but we never received
  // state (e.g. JOIN_ROOM was lost, or server response was corrupted), retry.
  useEffect(() => {
    if (!isConnected || serverState) return;
    const timer = setTimeout(() => {
      console.warn("[App] Connected but no state received in 5s. Resending JOIN_ROOM.");
      const password = lastPasswordAttemptRef.current || location.state?.password;
      sendMessage({ type: "JOIN_ROOM", payload: { roomId: activeRoomId, password } });
    }, 5000);
    return () => clearTimeout(timer);
  }, [isConnected, serverState, activeRoomId, sendMessage, location.state]);

  // Stale State Guard: If we switched rooms but serverState is still from the old room, show loading.
  const isStaleState = serverState && serverRoomId && (serverRoomId.toString().trim().toLowerCase() !== activeRoomId.toString().trim().toLowerCase());

  useEffect(() => {
    let timeout;
    if (isConnected && isStaleState) {
      if (import.meta.env.DEV) {
        console.warn(`[STALE DEBUG] Wanted: ${activeRoomId}, Got: ${serverRoomId}. Retrying in 3s...`);
      }
      timeout = setTimeout(() => {
        if (import.meta.env.DEV) {
          console.warn(`[STALE DEBUG] Sending JOIN_ROOM for ${activeRoomId}`);
        }
        const password = lastPasswordAttemptRef.current || location.state?.password;
        sendMessage({ type: "JOIN_ROOM", payload: { roomId: activeRoomId, password } });
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [isConnected, isStaleState, activeRoomId, serverRoomId, sendMessage, location.state]);

  // Local UI state
  const [expandedTrackId, setExpandedTrackId] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showSuggest, setShowSuggest] = useState(false);
  const userHasInteractedRef = useRef(false);

  useEffect(() => {
    const markInteracted = () => { userHasInteractedRef.current = true; };
    window.addEventListener('click', markInteracted, { once: true, capture: true });
    window.addEventListener('keydown', markInteracted, { once: true, capture: true });
    window.addEventListener('touchstart', markInteracted, { once: true, capture: true });
    return () => {
      window.removeEventListener('click', markInteracted, { capture: true });
      window.removeEventListener('keydown', markInteracted, { capture: true });
      window.removeEventListener('touchstart', markInteracted, { capture: true });
    };
  }, []);



  // Suggestion state (must be declared before effects that use it)
  const [manualSuggestions, setManualSuggestions] = useState([]);
  const [activeSuggestionId, setActiveSuggestionId] = useState(null);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [networkThrottle, setNetworkThrottle] = useState(null); // { until: timestamp } when YouTube throttles the venue IP
  const THROTTLE_DISMISS_KEY = 'cuevote_throttle_dismissed_until';
  const isThrottleDismissActive = useCallback(() => {
    try {
      const until = localStorage.getItem(THROTTLE_DISMISS_KEY);
      return until && Date.now() < parseInt(until, 10);
    } catch { return false; }
  }, []);
  const [throttleDismissed, setThrottleDismissed] = useState(isThrottleDismissActive);
  const dismissThrottle = useCallback(() => {
    try { localStorage.setItem(THROTTLE_DISMISS_KEY, String(Date.now() + 30 * 60 * 1000)); } catch {}
    setThrottleDismissed(true);
  }, []);
  const clearThrottleDismiss = useCallback(() => {
    try { localStorage.removeItem(THROTTLE_DISMISS_KEY); } catch {}
    setThrottleDismissed(false);
  }, []);

  // Fix: Use Ref to track showSuggeststate to suppress global toasts when bar is open
  const showSuggestRef = useRef(showSuggest);
  useEffect(() => { showSuggestRef.current = showSuggest; }, [showSuggest]);

  const [toast, setToast] = useState(null);

  useEffect(() => {
    // If Suggest Bar is open, suppress global toasts (errors/messages shown inline)
    if (showSuggestRef.current) return;

    if (lastError) {
      const errorMessage = typeof lastError === 'string'
        ? lastError
        : lastError.message || "An error occurred";
      setToast({ message: errorMessage, type: "error" });
    }
  }, [lastError, lastErrorTimestamp]); // showSuggestRef is stable

  useEffect(() => {
    // If Suggest Bar is open, suppress global toasts
    if (showSuggestRef.current) return;

    if (lastMessage) {
      if (lastMessage.type === 'info') setToast({ message: lastMessage.message, type: "info" });
      else if (lastMessage.type === 'success') {
        if (lastMessage.message === "Added") return; // Suppress redundant "Success" popup for video additions
        setToast({ message: lastMessage.payload || "Success", type: "success" });
      }
      else if (lastMessage.type === 'error') setToast({ message: lastMessage.message, type: "error" });
    }
  }, [lastMessage]);

  // Handle VIDEO_STATUS from server (YouTube only)
  useEffect(() => {
    if (isSpotify) return;
    if (!lastMessage || lastMessage.type !== "VIDEO_STATUS") return;
    const { videoId, status } = lastMessage.payload || {};
    if (!videoId) return;

    // Detect repeated skipping — if 2+ videos are skipped in this session, something systemic is wrong
    recentSkipTimesRef.current.push(Date.now());
    if (recentSkipTimesRef.current.length >= 2) {
      console.warn("[Player] IP block detected — multiple videos skipped by server");
      if (!isThrottleDismissActive()) setIpBlockDetected(true);
    }

    if (isOwner) {
      const title = currentTrack?.title || 'Track';
      if (status === 'ip_blocked' || status === 'check_failed' || status === 'no_api_key') {
        // NETWORK_THROTTLE banner follows immediately — no toast needed to avoid duplicate messaging
      } else {
        setToast({
          message: t('playlist.skippedRestricted', { title }),
          type: "error"
        });
      }
    }
  }, [lastMessage, isOwner, currentTrack, t]);

  // Handle NETWORK_THROTTLE from server (YouTube only)
  useEffect(() => {
    if (isSpotify) return;
    if (!lastMessage || lastMessage.type !== "NETWORK_THROTTLE") return;
    const { until } = lastMessage.payload || {};
    setNetworkThrottle({ until: until || (Date.now() + 15 * 60 * 1000) });
    if (!isThrottleDismissActive()) setIpBlockDetected(true);
  }, [lastMessage, isThrottleDismissActive]);

  // Handle SPOTIFY_REAUTH from server
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "SPOTIFY_REAUTH") return;
    setSpotifyNeedsAuth(true);
  }, [lastMessage]);

  // No auto-clear for network throttle — IP blocks last hours, not minutes.
  // The banner clears only when the owner presses Retry and playback succeeds
  // (server resets state on PLAY_PAUSE:true and UPDATE_DURATION).

  // Handle manual suggestion results from server
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "SUGGESTION_RESULT") return;
    if (!activeSuggestionId) return; // Ignore if no suggestion panel is open

    const suggestions = lastMessage.payload?.suggestions || [];
    setManualSuggestions(suggestions);
    setIsFetchingSuggestions(false);
  }, [lastMessage, activeSuggestionId]);
  const [showPendingPage, setShowPendingPage] = useState(false);
  const [showBannedPage, setShowBannedPage] = useState(false); // Added this
  const [volume, setVolume] = useState(80);
  const [isQueueMinimized, setIsQueueMinimized] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isLocallyPaused, setIsLocallyPaused] = useState(false);
  const [isLocallyPlaying, setIsLocallyPlaying] = useState(false);
  const [previewTrack, setPreviewTrack] = useState(null);
  // const [user, setUser] = useState(null); // Now from Context
  const [progress, setProgress] = useState(0);
  const [playbackError, setPlaybackError] = useState(null); // New State: Track playback errors
  const ipBlockedVideosRef = useRef(new Set());
  const recentSkipTimesRef = useRef([]);
  const trackFailTimesRef = useRef([]);
  const lastSuccessfulPlayRef = useRef(Date.now());
  const [ipBlockDetected, setIpBlockDetected] = useState(false);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true); // Track footer visibility
  const [isWindowTooSmall, setIsWindowTooSmall] = useState(false);

  // Monitor Window Size for TOS Compliance & Reactive Layout
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);

      let tooSmall = false;
      if (isCinemaMode) {
        // Strict TOS Minimum in Cinema Mode (200x200)
        tooSmall = window.innerWidth < 200 || window.innerHeight < 200;
      } else {
        // Standard UI Minimum (360x400)
        tooSmall = window.innerWidth < 360 || window.innerHeight < 400;
      }
      setIsWindowTooSmall(tooSmall);
    };

    // Check initially
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCinemaMode]);

  // Mobile Auto-Fullscreen on Landscape
  useEffect(() => {
    // Only apply to Smartphones (Mobile but not Tablet)
    if (!deviceDetection.isMobile() || deviceDetection.isTablet()) return;

    const mediaQuery = window.matchMedia("(orientation: landscape)");

    const handleOrientationChange = (e) => {
      const isLandscape = e.matches;

      // Auto-Enter Cinema Mode in Landscape
      if (isLandscape) {
        setIsCinemaMode(true);
      }
      // Auto-Exit Cinema Mode in Portrait
      else {
        setIsCinemaMode(false);
      }
    };

    // Check initially
    // We manually trigger it based on current matches to set initial state correctly
    if (mediaQuery.matches && !isCinemaMode) {
      setIsCinemaMode(true);
    }

    // Add Listener
    mediaQuery.addEventListener("change", handleOrientationChange);
    return () => mediaQuery.removeEventListener("change", handleOrientationChange);
  }, [isCinemaMode]); // Dependency mainly for access to current state if needed, though media query is robust

  // Smart Bar Logic: Intercept visibility changes to enforce TOS
  // Smart Bar Logic: Intercept visibility changes to enforce TOS
  // Smart Bar Logic: Reactive constraints
  // If isCinemaMode, we only allow controls if window is tall enough (200px + bar height)
  const canShowControls = !isCinemaMode || (windowHeight >= 200 + controlsHeight);

  // Updated Handler: We blindly accept what the child tells us, 
  // because the child now respects 'canShowControls' which we pass down.
  const handleVisibilityChange = useCallback((visible) => {
    setControlsVisible(visible);
  }, []);

  const handleControlsHeightChange = useCallback((height) => {
    setControlsHeight(height);
  }, []);

  // Handle Escape Key for App-level modals
  useEffect(() => {
    const handleEscape = (e) => {
      // Prevent Backspace from closing modals while typing
      if (e.key === 'Backspace' && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      // Allow "Back", "Escape", or "ArrowLeft" on TV to exit Cinema Mode
      if (e.key === 'Escape' || e.key === 'Backspace' || (deviceDetection.isTV() && e.key === 'ArrowLeft')) {
        if (showPendingPage) setShowPendingPage(false);
        else if (showBannedPage) setShowBannedPage(false);
        else if (showSuggest) setShowSuggest(false);
        else if (showQRModal) setShowQRModal(false);
        else if (showPasswordModal) { /* navigate('/'); */ }
        else if (isCinemaMode) {
          setIsCinemaMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showPendingPage, showBannedPage, showSuggest, showQRModal, showPasswordModal, isCinemaMode]);

  // Auth: Resume Session logic moved to Provider

  // Auth: Handle Login Events logic moved to Provider? 
  // We still need to trigger the context update if we want.
  // Actually, let's update the Provider to handle user state.

  // YouTube Player state
  const playerRef = useRef(null);
  const playerInitIdRef = useRef(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  const isPlayingRef = useRef(isPlaying); // Track latest server state for event handlers
  const isOwnerRef = useRef(isOwner);
  const tRef = useRef(t);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isOwnerRef.current = isOwner;
  }, [isOwner]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const currentTrackRef = useRef(currentTrack);
  useEffect(() => {
    currentTrackRef.current = currentTrack;
    setPlaybackError(null);

    // Track-cycling detection: if 2+ tracks load without any successful playback, something systemic is wrong
    if (currentTrack) {
      trackFailTimesRef.current.push(Date.now());
      if (trackFailTimesRef.current.length >= 2 && Date.now() - lastSuccessfulPlayRef.current > 5000) {
        console.warn("[Player] IP block detected — tracks keep failing without playback");
        if (!isThrottleDismissActive()) setIpBlockDetected(true);
      }
    }
    if (isPlayerReady && playerRef.current) {
      try {
        if (captionsEnabled && currentTrack?.language) {
          console.log("[Player] Setting Caption Language:", currentTrack.language);
          playerRef.current.setOption && playerRef.current.setOption('captions', 'track', { languageCode: currentTrack.language });
        } else {
          // Explicitly clear captions if disabled
          console.log("[Player] Clearing Captions (Disabled)");
          playerRef.current.setOption && playerRef.current.setOption('captions', 'track', {});
        }
      } catch (e) {
        console.error("Failed to set/clear caption language", e);
      }
    }
  }, [currentTrack, isPlayerReady, captionsEnabled]);


  // YouTube API Loading
  const loadYouTubeAPI = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!hasConsent) return reject("No Consent"); // Gate API Load

      if (window.YT && window.YT.Player) {
        return resolve(window.YT);
      }
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onload = () => {
        window.onYouTubeIframeAPIReady = () => resolve(window.YT);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }, [hasConsent]);

  // Player Initialization
  const initializePlayer = useCallback((container) => {
    if (!hasConsent) return;
    const initId = ++playerInitIdRef.current;
    loadYouTubeAPI().then((YT) => {
      if (initId !== playerInitIdRef.current) return;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch (e) { /* already gone */ }
        playerRef.current = null;
      }
      playerRef.current = new YT.Player(container, {
        host: 'https://www.youtube.com',
        playerVars: {
          autoplay: 0,
          controls: 1,
          origin: window.location.origin,
          widget_referrer: window.location.origin,
          cc_load_policy: captionsEnabled ? 1 : 0,
          cc_lang_pref: currentTrackRef.current?.language,
          hl: currentTrackRef.current?.language
        },
        events: {
          onReady: (event) => {
            // console.log("[Player] YouTube Player onReady fired");
            setIsPlayerReady(true);
            event.target.setVolume(volumeRef.current);
            if (isMutedRef.current) {
              event.target.mute();
            } else {
              event.target.unMute();
            }
          },
          onStateChange: (event) => {
            const state = event.data;
            if (state === YouTubeState.PLAYING) {
              setIsLocallyPaused(false);
              lastSuccessfulPlayRef.current = Date.now();
              trackFailTimesRef.current = [];

              // Only set override if the SERVER is not currently playing.
              // If Server IS playing, then this event is likely just a sync result, so we are synced (local=false).
              // If Server is PAUSED (!isPlaying), and we play, it's a manual override.
              if (!isPlayingRef.current) {
                setIsLocallyPlaying(true);
              } else {
                setIsLocallyPlaying(false);
              }

              setAutoplayBlocked(false);
              const duration = event.target.getDuration();
              if (duration && duration > 0) {
                sendMessage({ type: "UPDATE_DURATION", payload: duration });
              }
            } else if (state === YouTubeState.PAUSED) {
              // If user pauses manually in the iframe, respect it locally
              // BUT: if this pause comes from a server sync (i.e. server is paused), we shouldn't treat it as a local override.
              // We only want to set isLocallyPaused=true if we are pausing *against* the server state (i.e. server is playing).
              setIsLocallyPaused(isPlayingRef.current);
              setIsLocallyPlaying(false);
            }
          },
          onError: (event) => {
            console.error("YouTube Player Error:", event.data);
            const errorCode = event.data;
            if ([100, 101, 150].includes(errorCode)) {
              if (isOwnerRef.current) {
                console.warn("[Player] Video error. Sending to server for verification...", currentTrackRef.current?.title);
                sendMessage({
                  type: "PLAYBACK_ERROR",
                  payload: {
                    videoId: currentTrackRef.current?.videoId,
                    errorCode
                  }
                });
              } else {
                console.warn("[Player] Playback Error shown to guest:", errorCode);
                setPlaybackError(errorCode);
              }
              // Track restricted errors for IP block detection (both owner and guest)
              if (errorCode === 101 || errorCode === 150) {
                const videoId = currentTrackRef.current?.videoId;
                if (videoId) {
                  ipBlockedVideosRef.current.add(videoId);
                  if (ipBlockedVideosRef.current.size >= 2) {
                    console.warn("[Player] IP block detected — multiple videos restricted:", [...ipBlockedVideosRef.current]);
                    if (!isThrottleDismissActive()) setIpBlockDetected(true);
                  }
                }
              }
            } else {
              if (!isOwnerRef.current) {
                setPlaybackError(errorCode);
              }
            }
          },
        },
      });
    });
  }, [loadYouTubeAPI, sendMessage, hasConsent, captionsEnabled]);

  // Spotify Player Initialization
  const [spotifyDeviceId, setSpotifyDeviceId] = useState(null);
  const [spotifyNeedsAuth, setSpotifyNeedsAuth] = useState(false);
  const spotifyTokenRef = useRef(null);

  const loadSpotifySDK = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!hasConsent) return reject("No Consent");
      if (window.Spotify) return resolve(window.Spotify);
      // Prevent duplicate script tags if SDK is already loading
      const existing = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
      if (existing) {
        window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.onerror = reject;
      document.head.appendChild(script);
      window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
    });
  }, [hasConsent]);

  const fetchSpotifyToken = useCallback(async () => {
    if (!user?.id) return null;
    const sessionToken = localStorage.getItem("cuevote_session_token");
    if (!sessionToken) return null;
    const serverUrl = import.meta.env.VITE_WS_URL?.replace('wss://', 'https://').replace('ws://', 'http://').replace('/ws', '') || window.location.origin;
    try {
      const res = await fetch(`${serverUrl}/api/spotify/token?userId=${user.id}&session=${encodeURIComponent(sessionToken)}`);
      if (!res.ok) return null;
      const data = await res.json();
      spotifyTokenRef.current = data.token;
      return data.token;
    } catch (e) {
      console.error("[Spotify] Token fetch failed:", e);
      return null;
    }
  }, [user?.id]);

  const initializeSpotifyPlayer = useCallback(async () => {
    if (!hasConsent || !isOwnerRef.current) return;
    const initId = ++playerInitIdRef.current;
    try {
      const SpotifySDK = await loadSpotifySDK();
      if (initId !== playerInitIdRef.current) return;

      const token = await fetchSpotifyToken();
      if (!token) {
        console.warn("[Spotify] No token — user needs to authenticate");
        setSpotifyNeedsAuth(true);
        return;
      }
      setSpotifyNeedsAuth(false);

      const player = new SpotifySDK.Player({
        name: 'CueVote',
        getOAuthToken: async (cb) => {
          const freshToken = await fetchSpotifyToken();
          cb(freshToken);
        },
        volume: volumeRef.current / 100,
      });

      player.addListener('ready', ({ device_id }) => {
        console.log('[Spotify] Ready with Device ID:', device_id);
        setSpotifyDeviceId(device_id);
        setIsPlayerReady(true);
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('[Spotify] Device has gone offline:', device_id);
        setIsPlayerReady(false);
      });

      player.addListener('player_state_changed', (state) => {
        if (!state) return;
        const { paused, position, duration, track_window } = state;
        if (!paused) {
          setIsLocallyPaused(false);
          if (!isPlayingRef.current) setIsLocallyPlaying(true);
          else setIsLocallyPlaying(false);
          if (duration > 0) {
            sendMessage({ type: "UPDATE_DURATION", payload: Math.round(duration / 1000) });
          }
        } else {
          setIsLocallyPaused(isPlayingRef.current);
          setIsLocallyPlaying(false);
        }

        // Detect track end: paused at position 0 with previous tracks means the track finished,
        // OR paused at a position very close to the duration (within 1s tolerance)
        const isAtEnd = paused && (
          (position === 0 && track_window?.previous_tracks?.length > 0) ||
          (duration > 0 && position >= duration - 1000)
        );
        if (isAtEnd) {
          if (isOwnerRef.current) {
            sendMessage({ type: "NEXT_TRACK" });
          }
        }
      });

      player.addListener('initialization_error', ({ message }) => {
        console.error('[Spotify] Init error:', message);
      });

      player.addListener('authentication_error', ({ message }) => {
        console.error('[Spotify] Auth error:', message);
        setSpotifyNeedsAuth(true);
        if (isOwnerRef.current) {
          sendMessage({ type: "PLAYBACK_ERROR", payload: { trackId: currentTrackRef.current?.trackId, errorCode: 'SPOTIFY_AUTH_ERROR' } });
        }
      });

      player.addListener('account_error', ({ message }) => {
        console.error('[Spotify] Account error (Premium required?):', message);
      });

      await player.connect();
      playerRef.current = player;
      console.log("[Spotify] Player initialized");
    } catch (err) {
      console.error("[Spotify] Initialization failed:", err);
    }
  }, [loadSpotifySDK, fetchSpotifyToken, hasConsent, sendMessage]);

  // Spotify auth popup handler
  const spotifyAuthListenerRef = useRef(null);
  const openSpotifyAuth = useCallback(() => {
    if (!user?.id) return;
    // Clean up any previous auth listener
    if (spotifyAuthListenerRef.current) {
      window.removeEventListener('message', spotifyAuthListenerRef.current);
    }
    const serverUrl = import.meta.env.VITE_WS_URL?.replace('wss://', 'https://').replace('ws://', 'http://').replace('/ws', '') || window.location.origin;
    const authWindow = window.open(`${serverUrl}/api/spotify/auth?userId=${user.id}`, 'spotify-auth', 'width=450,height=700');

    const handleMessage = (event) => {
      if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
        setSpotifyNeedsAuth(false);
        initializeSpotifyPlayer();
        window.removeEventListener('message', handleMessage);
        spotifyAuthListenerRef.current = null;
      } else if (event.data?.type === 'SPOTIFY_AUTH_ERROR') {
        console.error('[Spotify] Auth error:', event.data.error);
        window.removeEventListener('message', handleMessage);
        spotifyAuthListenerRef.current = null;
      }
    };
    spotifyAuthListenerRef.current = handleMessage;
    window.addEventListener('message', handleMessage);
  }, [user?.id, initializeSpotifyPlayer]);

  // Cleanup auth listener on unmount
  useEffect(() => {
    return () => {
      if (spotifyAuthListenerRef.current) {
        window.removeEventListener('message', spotifyAuthListenerRef.current);
        spotifyAuthListenerRef.current = null;
      }
    };
  }, []);

  const playerContainerRef = useCallback(node => {
    if (!hasConsent) return;
    if (isSpotify) {
      if (node !== null) {
        initializeSpotifyPlayer();
      } else {
        playerInitIdRef.current++;
        if (playerRef.current && typeof playerRef.current.disconnect === 'function') {
          try { playerRef.current.disconnect(); } catch (e) { /* */ }
          playerRef.current = null;
          setIsPlayerReady(false);
          setSpotifyDeviceId(null);
        }
      }
      return;
    }
    // YouTube path
    if (node !== null) {
      initializePlayer(node);
    } else {
      playerInitIdRef.current++;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) { console.error("Player cleanup error", e); }
        playerRef.current = null;
        setIsPlayerReady(false);
      }
    }
  }, [initializePlayer, initializeSpotifyPlayer, hasConsent, isSpotify]);

  // Clean up old player when music source switches
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerInitIdRef.current++;
        if (typeof playerRef.current.disconnect === 'function') {
          try { playerRef.current.disconnect(); } catch (e) { /* Spotify cleanup */ }
        }
        if (typeof playerRef.current.destroy === 'function') {
          try { playerRef.current.destroy(); } catch (e) { /* YouTube cleanup */ }
        }
        playerRef.current = null;
        setIsPlayerReady(false);
        setSpotifyDeviceId(null);
      }
    };
  }, [isSpotify]);

  // Track the currently playing Spotify track to avoid redundant API calls
  const spotifyCurrentTrackIdRef = useRef(null);

  // Spotify track loading helper
  const spotifyPlayTrack = useCallback(async (trackId, positionMs = 0) => {
    if (!spotifyDeviceId) return;
    const token = await fetchSpotifyToken();
    if (!token) return;
    try {
      const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [`spotify:track:${trackId}`], position_ms: positionMs }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[Spotify] Play track HTTP ${res.status}:`, text);
        if (res.status === 401 || res.status === 403) {
          setSpotifyNeedsAuth(true);
          if (isOwnerRef.current) {
            sendMessage({ type: "PLAYBACK_ERROR", payload: { trackId, errorCode: 'SPOTIFY_AUTH_ERROR' } });
          }
        } else if (res.status === 404) {
          // Device not found — player may have disconnected
          setSpotifyDeviceId(null);
          setIsPlayerReady(false);
        }
      }
    } catch (e) {
      console.error("[Spotify] Play track failed:", e);
    }
  }, [spotifyDeviceId, fetchSpotifyToken, sendMessage]);

  // Main playback logic
  useEffect(() => {
    const targetTrack = previewTrack || currentTrack;
    if (isPlayerReady && playerRef.current && targetTrack) {
      if (isSpotify) {
        const targetId = targetTrack.trackId;
        // Only call Spotify API when the track actually changes (avoid redundant plays on state updates)
        if (targetId && targetId !== spotifyCurrentTrackIdRef.current) {
          spotifyCurrentTrackIdRef.current = targetId;
          const startMs = previewTrack ? 0 : (progressRef.current * 1000);
          spotifyPlayTrack(targetId, startMs);
        }
      } else {
        const currentVideoIdInPlayer = playerRef.current.getVideoData?.()?.video_id;
        if (targetTrack.videoId !== currentVideoIdInPlayer) {
          const startTime = previewTrack ? 0 : progressRef.current;
          playerRef.current.loadVideoById?.(targetTrack.videoId, startTime);
        }
      }
    } else if (isPlayerReady && playerRef.current && !targetTrack) {
      spotifyCurrentTrackIdRef.current = null;
      if (isSpotify) {
        playerRef.current.pause?.();
      } else {
        playerRef.current.stopVideo?.();
      }
    }
  }, [isPlayerReady, currentTrack, previewTrack, progressRef, isSpotify, spotifyPlayTrack]);

  const tvUnmuteVisible = deviceDetection.isTV() && isMuted && isPlayerReady && !isAnyPlaylistView;
  const hasFullscreenOverlay = showQRModal || headerOverlay || settingsOverlay || tvUnmuteVisible;

  useEffect(() => {
    if (isPlayerReady && playerRef.current) {
      if (hasFullscreenOverlay) {
        if (isSpotify) playerRef.current.pause?.();
        else playerRef.current.pauseVideo?.();
      } else if (userHasInteractedRef.current && previewTrack) {
        if (isSpotify) playerRef.current.resume?.();
        else playerRef.current.playVideo?.();
      } else if (userHasInteractedRef.current && (isPlaying || isLocallyPlaying) && !isLocallyPaused) {
        if (isSpotify) playerRef.current.resume?.();
        else playerRef.current.playVideo?.();
      } else {
        if (isSpotify) playerRef.current.pause?.();
        else playerRef.current.pauseVideo?.();
      }
    }
  }, [isPlayerReady, isPlaying, currentTrack, isLocallyPaused, isLocallyPlaying, previewTrack, hasFullscreenOverlay]);

  useEffect(() => {
    if (isSpotify) return; // Spotify syncs via player_state_changed
    if (!isPlayerReady || !playerRef.current || !isPlaying || previewTrack) return;
    const interval = setInterval(() => {
      if (playerRef.current?.getPlayerState?.() === YouTubeState.ENDED) return;
      const localProgress = playerRef.current?.getCurrentTime?.();
      if (localProgress && Math.abs(localProgress - progressRef.current) > 3) {
        playerRef.current?.seekTo?.(progressRef.current);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlayerReady, isPlaying, previewTrack, progressRef, isSpotify]);

  // Autoplay detection (YouTube only — Spotify SDK handles internally)
  useEffect(() => {
    if (isSpotify) { setAutoplayBlocked(false); return; }
    if (isPlaying && isPlayerReady && playerRef.current) {
      const check = setTimeout(() => {
        const state = playerRef.current.getPlayerState?.();
        if (
          state !== undefined &&
          state !== YouTubeState.PLAYING &&
          state !== YouTubeState.BUFFERING
        ) {
          setAutoplayBlocked(true);
        } else {
          setAutoplayBlocked(false);
        }
      }, 2000);
      return () => clearTimeout(check);
    } else {
      setAutoplayBlocked(false);
    }
  }, [isPlaying, isPlayerReady, currentTrack]);

  // Infinite Load Guard (Stall Detection) — YouTube only
  const stallRetriesRef = useRef(0); // Track number of stall retries

  useEffect(() => {
    if (isSpotify) return; // Spotify SDK handles stall detection internally
    // Reset retries when track changes
    stallRetriesRef.current = 0;
  }, [currentTrack]);

  useEffect(() => {
    if (!isPlaying || !isPlayerReady || !playerRef.current) return;

    const checkInterval = setInterval(() => {
      const state = playerRef.current.getPlayerState?.();
      if (state === YouTubeState.BUFFERING || state === YouTubeState.UNSTARTED) {
        stallRetriesRef.current += 1;
        console.warn(`[Player] Stall detected (Attempt ${stallRetriesRef.current}).`);

        const stallLimit = deviceDetection.isTV() ? 6 : (isOwner ? 4 : 2);
        if (stallRetriesRef.current > stallLimit) {
          if (isOwner) {
            console.warn("[Player] Stall limit exceeded for owner. Reporting as playback error.");
            sendMessage({
              type: "PLAYBACK_ERROR",
              payload: {
                videoId: currentTrackRef.current?.videoId,
                errorCode: 'stall'
              }
            });
          } else {
            console.warn("[Player] Stall limit exceeded for guest. Triggering IP block overlay.");
            setPlaybackError(100);
            ipBlockedVideosRef.current.add(currentTrackRef.current?.videoId);
            if (ipBlockedVideosRef.current.size >= 2) {
              if (!isThrottleDismissActive()) setIpBlockDetected(true);
            }
          }
          clearInterval(checkInterval);
          return;
        }

        console.warn("[Player] Force-reloading video...");
        const currentTime = playerRef.current.getCurrentTime?.() || progressRef.current;
        playerRef.current.loadVideoById?.(currentTrackRef.current?.videoId, currentTime);
      } else {
        if (state === YouTubeState.PLAYING) {
          stallRetriesRef.current = 0;
        }
      }
    }, 8000);

    return () => clearInterval(checkInterval);
  }, [isPlaying, isPlayerReady, isOwner, progressRef, sendMessage]);

  // Progress bar update (polls ref to avoid re-renders from progress messages)
  useEffect(() => {
    if (!isPlayerReady) return;
    const update = () => {
      const duration = playerRef.current?.getDuration?.() || 0;
      if (duration > 0) {
        setProgress((progressRef.current / duration) * 100);
      } else {
        setProgress(0);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isPlayerReady, progressRef]);

  // Event Handlers

  const handlePlayPause = () => {
    const isEffectivelyPlaying = (isPlaying || isLocallyPlaying) && !isLocallyPaused;

    if (isOwner) {
      // Owner controls global state based on what THEY see (effective state)
      // If effective state is playing, we send PAUSE.
      // If effective state is paused, we send PLAY.
      sendMessage({ type: "PLAY_PAUSE", payload: !isEffectivelyPlaying });

      // Reset local overrides to resync with the new server state we just requested
      setIsLocallyPaused(false);
      setIsLocallyPlaying(false);
    } else {
      // Guest: Local Toggle Only
      if (isEffectivelyPlaying) {
        // User wants to PAUSE
        setIsLocallyPaused(true);
        setIsLocallyPlaying(false);
        if (isSpotify) playerRef.current?.pause?.();
        else playerRef.current?.pauseVideo?.();
      } else {
        // User wants to PLAY
        setIsLocallyPaused(false);
        setIsLocallyPlaying(true);
        if (isSpotify) playerRef.current?.resume?.();
        else playerRef.current?.playVideo?.();
      }
    }
  };



  const handleMuteToggle = () => {
    if (isSpotify) {
      if (isMuted) playerRef.current?.setVolume?.(volumeRef.current / 100);
      else playerRef.current?.setVolume?.(0);
    } else {
      if (isMuted) playerRef.current?.unMute?.();
      else playerRef.current?.mute?.();
    }
    setIsMuted(!isMuted);
  };



  const handleVolumeChange = (e) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (playerRef.current) {
      if (isSpotify) {
        playerRef.current.setVolume?.(newVolume / 100);
      } else {
        playerRef.current.setVolume?.(newVolume);
      }
      if (isMuted) {
        if (!isSpotify) playerRef.current.unMute?.();
        setIsMuted(false);
      }

    }

  };



  const handleSongSuggested = useCallback((query) => {
    if (!user) {
      setToast({ message: t('suggest.loginRequired'), type: 'error' });
      return;
    }
    sendMessage({ type: "SUGGEST_SONG", payload: { query, userId: user?.id } });
  }, [user, sendMessage, t]);

  const handleLibraryAdd = useCallback((sourceId) => {
    if (isSpotify) {
      return handleSongSuggested(sourceId);
    }
    return handleSongSuggested(`https://www.youtube.com/watch?v=${sourceId}`);
  }, [handleSongSuggested, isSpotify]);

  const handleRemoveFromLibrary = useCallback((sourceId) => {
    console.log("[App] Removing from Library:", sourceId);
    if (isSpotify) {
      sendMessage({ type: "REMOVE_FROM_LIBRARY", payload: { trackId: sourceId } });
    } else {
      sendMessage({ type: "REMOVE_FROM_LIBRARY", payload: { videoId: sourceId } });
    }
  }, [sendMessage, isSpotify]);

  const handleFetchSuggestions = useCallback((track) => {
    // Toggle if clicking same track
    if (activeSuggestionId === track.id) {
      setActiveSuggestionId(null);
      return;
    }

    console.log("[App] handleFetchSuggestions triggered for:", track.title);
    setActiveSuggestionId(track.id);
    setManualSuggestions([]); // Clear previous
    setIsFetchingSuggestions(true);

    sendMessage({
      type: "FETCH_SUGGESTIONS",
      payload: {
        videoId: track.videoId || null,
        trackId: track.trackId || null,
        title: track.title,
        artist: track.artist
      }
    });
  }, [activeSuggestionId, sendMessage]);





  const handleVote = (trackId, type) => {

    sendMessage({ type: "VOTE", payload: { trackId, voteType: type } });

  };




  const handlePreviewTrack = useCallback((track) => {
    setIsLocallyPaused(true);
    setPreviewTrack(track);
  }, []);



  const handleUpdateSettings = (settings) => {
    sendMessage({ type: "UPDATE_SETTINGS", payload: settings });
  };

  const handleStopPreview = useCallback(() => {
    setPreviewTrack(null);
    setIsLocallyPaused(false);
    if (isSpotify) playerRef.current?.seek?.(progressRef.current * 1000);
    else playerRef.current?.seekTo?.(progressRef.current);
  }, [progressRef, isSpotify]);

  // Watch for Room Not Found Error
  useEffect(() => {
    if (lastMessage && lastMessage.type === "error" && lastMessage.code === "ROOM_NOT_FOUND") {
      setRoomNotFound(true);
    }
  }, [lastMessage]);

  // Reset error when changing rooms
  useEffect(() => {
    setRoomNotFound(false);
  }, [activeRoomId]);

  const handleDeleteSong = (trackId) => {
    sendMessage({ type: "DELETE_SONG", payload: { trackId } });
  };

  const handleSeek = (percentage) => {
    if (!playerRef.current) return;
    const duration = isSpotify
      ? (currentTrack?.duration || 0)
      : playerRef.current.getDuration();
    if (!duration) return;
    const seconds = (percentage / 100) * duration;
    if (isOwner) {
      sendMessage({ type: "SEEK_TO", payload: seconds });
      if (isSpotify) playerRef.current.seek?.(seconds * 1000);
      else playerRef.current.seekTo(seconds, true);
    }
  };

  if (roomNotFound) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <h2 className="text-3xl font-bold text-red-500 mb-4">{t('app.channelNotFound')}</h2>
        <p className="text-neutral-400 mb-8">{t('app.notFoundMessage', { roomId: activeRoomId })}</p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={20} /> {t('app.goToLobby')}
        </button>
      </div>
    );
  }

  // TOS Compliance: Window Size Blocker (Desktop only, if not blocked by mobile check)
  if (isWindowTooSmall && !deviceDetection.isTV()) {
    return (
      <div className="flex flex-col h-screen w-full bg-black items-center justify-center p-6 text-center z-[100] relative overflow-hidden">
        <div className="absolute inset-0 bg-neutral-900/50" />
        <div className="relative z-10 max-w-sm space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 animate-bounce">
            <Maximize2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('app.windowTooSmall')}</h2>
          <p className="text-neutral-400">
            {t('app.windowTooSmallMessage')}
          </p>
        </div>
      </div>
    );
  }



  // DEBUG OVERLAY (Temporary)
  // Ensure we can see what the phone thinks it is
  /*
  const showDebug = true; 
  if (showDebug) {
    return (
        <>
            <div style={{position:'fixed', top:0, left: 0, right:0, zIndex: 9999, background: 'rgba(255,0,0,0.8)', color: 'white', padding: '10px', fontSize: '10px', wordBreak: 'break-all'}}>
                UA: {userAgent} <br/>
                Android: {isAndroid.toString()} | TV: {isTV().toString()} | Wrapper: {isWrapper.toString()}
            </div>
            { 
               // Standard render below... 
            }
        </>
    )
  }
  */
  // actually, let's remove the previous react-based debug overlay to avoid confusion
  /* 
  const debugOverlay = ... 
  */



  // Compute user's votes from the queue data
  const userVotes = {};
  if (clientId) {
    queue.forEach(track => {
      if (track.voters && track.voters[clientId]) {
        userVotes[track.id] = track.voters[clientId];
      }
    });
    if (currentTrack && currentTrack.voters && currentTrack.voters[clientId]) {
      userVotes[currentTrack.id] = currentTrack.voters[clientId];
    }
  }

  const passwordModalContent = showPasswordModal ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock size={20} className="text-orange-500" /> {t('app.privateChannel')}
          </h3>
          <button onClick={() => navigate('/')} className="text-neutral-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="mb-4 text-neutral-400 text-sm">
          {t('app.lockedMessage')}
        </div>

        <form onSubmit={submitPasswordJoin} className="space-y-4">
          <div>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder={t('lobby.passwordInputPlaceholder')}
              className={`w-full bg-[#050505] border ${passwordError ? 'border-red-500 focus:border-red-500' : 'border-neutral-800 focus:border-orange-500'} rounded-xl px-4 py-3 text-white focus:outline-none transition-colors`}
              autoFocus
            />
            {passwordError && (
              <div className="text-red-500 text-sm mt-2 font-medium animate-in slide-in-from-top-1">
                {passwordError}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 px-4 py-3 rounded-xl border border-neutral-700 text-neutral-300 font-medium hover:bg-neutral-800 transition-all"
            >
              {t('lobby.cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold hover:from-orange-400 hover:to-orange-500 transition-all"
            >
              {t('app.unlock')}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  if ((!serverState || isStaleState)) {
    return (
      <>
        <LoadingScreen isOnline={isOnline} isConnected={isConnected} reconnectAttempt={reconnectAttempt} onForceReconnect={forceReconnect} />
        {passwordModalContent}
      </>
    );
  }


  // NOTE: handleDeleteSong and handleSeek are now defined before the early return (see above)

  if (showSettings) {
    return (
      <div className="w-full h-screen bg-[#1a1a1a] text-white overflow-hidden">
        <SettingsView
          onClose={() => setShowSettings(false)}
          pendingCount={pendingSuggestions.length}
          suggestionMode={suggestionMode}
          onManageRequests={() => {
            setShowPendingPage(true);
            setShowSettings(false);
          }}
          onUpdateSettings={handleUpdateSettings}
          suggestionsEnabled={suggestionsEnabled}
          autoApproveKnown={autoApproveKnown}
          musicOnly={musicOnly}
          maxDuration={maxDuration}
          maxQueueSize={maxQueueSize}
          duplicateCooldown={duplicateCooldown}
          smartQueue={smartQueue}
          autoRefill={autoRefill}
          playlistViewMode={playlistViewMode}
          allowPrelisten={allowPrelisten}
          votesEnabled={serverState?.votesEnabled ?? true}
          ownerBypass={ownerBypass}
          ownerQueueBypass={serverState?.ownerQueueBypass}
          ownerPopups={ownerPopups}
          onDeleteChannel={handleDeleteChannel}
          captionsEnabled={captionsEnabled}
          isConnected={isConnected}
          onFullscreenOverlay={setSettingsOverlay}
          musicSource={musicSource}
        />
      </div>
    );
  }



  const showThrottleBar = networkThrottle && !ipBlockDetected && !throttleDismissed;

  return (
    <div
      className={`text-white flex flex-col ${isAnyPlaylistView ? "h-[100dvh] h-screen overflow-hidden bg-[#0a0a0a] pb-0" : (isQueueMinimized && !isCinemaMode ? "h-[100dvh] h-screen overflow-hidden bg-black" : "min-h-screen bg-black pb-32")}`}
      style={isQueueMinimized && !isCinemaMode && !isAnyPlaylistView ? { paddingBottom: `${controlsHeight}px` } : undefined}
    >
      {ipBlockDetected && !throttleDismissed && (
        <div className="fixed inset-0 z-[100] bg-[#050505] text-white flex items-center justify-center p-6 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-[#050505] to-[#050505] pointer-events-none" />
          <div className="relative z-10 w-full flex flex-col items-center justify-center text-center max-w-md animate-in fade-in zoom-in-95 duration-500">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
              <WifiOff size={32} className="text-red-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
              {t('player.ipBlockTitle', 'Unable to play on this network')}
            </h2>
            <p className="text-neutral-400 font-medium mb-4 leading-relaxed text-balance">
              {t('player.ipBlockMessage', "YouTube is restricting video playback on your current network. Try switching to mobile data or a different Wi-Fi network.")}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-neutral-500 mb-8 bg-neutral-900/80 border border-neutral-800 rounded-lg px-4 py-2">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span>{t('player.ipBlockYouTubeStatus', 'youtube.com — Playback restricted')}</span>
            </div>
            <div className="flex gap-3 w-full">
              <button
                autoFocus
                onClick={() => window.location.reload()}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold text-lg shadow-lg hover:shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-[#050505]"
              >
                <RefreshCw size={18} />
                {t('player.ipBlockRetry', 'Reload')}
              </button>
              <button
                onClick={() => { dismissThrottle(); setIpBlockDetected(false); }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-[#050505]"
              >
                {t('player.ipBlockDismiss', 'Dismiss')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReconnectBanner && serverState && !isStaleState && (
        <div className={`fixed top-0 left-0 right-0 z-[100] ${!isOnline ? 'bg-red-600/95' : 'bg-orange-600/95'} backdrop-blur-sm text-white text-center py-1.5 text-xs font-medium`}>
          <div className="flex items-center justify-center gap-2">
            {!isOnline ? (
              <>
                <WifiOff size={12} />
                <span>{t('app.noInternet', 'No Internet Connection')}</span>
              </>
            ) : (
              <>
                <RefreshCw size={12} className="animate-spin" />
                <span>{t('app.reconnecting', 'Reconnecting')}...</span>
              </>
            )}
            {reconnectAttempt > 3 && (
              <button
                onClick={forceReconnect}
                className="ml-1 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors"
              >
                {t('app.retry', 'Retry')}
              </button>
            )}
          </div>
        </div>
      )}
      {!isCinemaMode && (
        <div className="sticky top-0 z-[55] bg-[#050505]/95 backdrop-blur-md border-b border-neutral-900 transition-all duration-700 ease-in-out">
          <Header
            onGoHome={() => navigate("/")}
            onShowSuggest={setShowSuggest}
            user={user}
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
            isOwner={isOwner}
            showQRCode={showQRModal}
            onShowQRCode={setShowQRModal}
            showSettings={showSettings}
            onToggleSettings={() => {
              setShowSettings(!showSettings);
              if (!showSettings) setShowSuggest(false);
            }}
            onCloseSettings={() => setShowSettings(false)}
            mode={isAnyPlaylistView ? playlistActiveTab : "default"}
            onPlaylist={() => {
              if (isAnyPlaylistView) {
                setPlaylistActiveTab("playlist");
              } else {
                setLocalPlaylistView(true);
                setPlaylistActiveTab("playlist");
                setShowSettings(false);
                setShowSuggest(false);
              }
            }}
            onLibrary={() => setPlaylistActiveTab("library")}
            onSuggest={() => {
              setShowSuggest(prev => !prev);
              setShowSettings(false);
            }}
            onShare={() => {
              setShowQRModal(true);
              setShowSettings(false);
              setShowSuggest(false);
            }}
            onClosePlaylist={localPlaylistView ? () => {
              setLocalPlaylistView(false);
              setPlaylistActiveTab("playlist");
            } : null}
            showSuggest={showSuggest}
            suggestionsEnabled={suggestionsEnabled}
            ownerBypass={ownerBypass}
            playlistViewMode={playlistViewMode}
            onFullscreenOverlay={setHeaderOverlay}
          />
          {showThrottleBar && (
            <div className="bg-yellow-600/95 text-white text-center py-1.5 text-xs font-medium">
              <div className="flex items-center justify-center gap-2 px-2">
                <AlertTriangle size={12} className="shrink-0" />
                <span className="truncate">{t('app.networkThrottle', "YouTube has blocked this network's IP. Playback paused. Try switching to a mobile hotspot.")}</span>
                {isOwner && (
                  <button
                    onClick={() => { clearThrottleDismiss(); setNetworkThrottle(null); sendMessage({ type: "PLAY_PAUSE", payload: true }); }}
                    className="shrink-0 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    {t('app.retryPlayback', 'Retry')}
                  </button>
                )}
                <button
                  onClick={dismissThrottle}
                  className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
          {showSuggest && (
            <div className="px-4 pb-3">
              <SuggestSongForm
                onSongSuggested={handleSongSuggested}
                onShowSuggest={setShowSuggest}
                serverError={lastError}
                serverMessage={lastMessage}
                isOwner={isOwner && ownerBypass}
                suggestionsEnabled={suggestionsEnabled}
                suggestionMode={suggestionMode}
                isConnected={isConnected}
                currentTrack={currentTrack}
                onRecommend={handleFetchSuggestions}
                suggestions={manualSuggestions}
                isFetchingSuggestions={isFetchingSuggestions}
                queueVideoIds={queueVideoIds}
              />
            </div>
          )}
        </div>
      )}

      {isOwner && pendingSuggestions.length > 0 && ownerPopups && (() => {
        const PendingRequests = pendingRequestsExports?.PendingRequests;
        return PendingRequests ? (
          <PendingRequests
            requests={pendingSuggestions}
            onApprove={handleApproveSuggestion}
            onReject={handleRejectSuggestion}
            onBan={handleBanSuggestion}
            onPreview={handlePreviewTrack}
            onClose={() => handleUpdateSettings({ ownerPopups: false })}
          />
        ) : null;
      })()}

      {showPendingPage && (() => {
        const PendingRequestsPage = pendingRequestsExports?.PendingRequestsPage;
        return PendingRequestsPage ? (
          <PendingRequestsPage
            requests={pendingSuggestions}
            onApprove={handleApproveSuggestion}
            onReject={handleRejectSuggestion}
            onBan={handleBanSuggestion}
            onManageBanned={() => setShowBannedPage(true)}
            onPreview={handlePreviewTrack}
            onClose={() => setShowPendingPage(false)}
          />
        ) : null;
      })()}

      {showPendingPage && previewTrack && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-fadeIn">
          <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative">
            <PlayerErrorBoundary>
              {hasConsent ? (
                playbackError ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-center p-6 space-y-4">
                    <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400">
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <p className="text-white font-medium mb-1">
                        {playbackError === 100 ? t('player.errorNotFound') : (playbackError === 101 || playbackError === 150 ? t('player.errorRestricted') : t('player.errorGeneric'))}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Player
                    playerContainerRef={playerContainerRef}
                    musicSource={musicSource}
                    currentTrack={currentTrack}
                    spotifyNeedsAuth={spotifyNeedsAuth}
                    onSpotifyAuth={openSpotifyAuth}
                  />
                )
              ) : (CookieBlockedPlaceholderComponent ? <CookieBlockedPlaceholderComponent /> : <div className="w-full h-full flex items-center justify-center bg-black text-neutral-500">Loading…</div>)}
            </PlayerErrorBoundary>
          </div>
        </div>
      )}

      {showBannedPage && (
        <BannedVideosPage
          bannedVideos={bannedVideos}
          onUnban={handleUnbanSong}
          onClose={() => setShowBannedPage(false)}
        />
      )}



      <div
        className={isCinemaMode
          ? "fixed inset-0 z-40 bg-black transition-all duration-500 ease-in-out"
          : (isAnyPlaylistView
            ? "flex-1 w-full relative group transition-all duration-500 ease-in-out min-h-0"
            : `w-full relative group transition-all duration-500 ease-in-out min-w-[200px] min-h-[200px] ${isQueueMinimized ? "flex-1 min-h-0" : "flex-shrink-0 aspect-video max-h-[60vh]"}`
          )
        }
        style={{
          bottom: (isCinemaMode && controlsVisible) ? `${controlsHeight}px` : "0px",
          ...(!isCinemaMode && !isAnyPlaylistView && !isQueueMinimized && showThrottleBar
            ? { maxHeight: 'calc(60vh - 1.75rem)' }
            : {})
        }}
      >
        <div
          className={`absolute inset-0 border-4 ${previewTrack ? "border-green-500" : "border-transparent"} transition-colors duration-300 box-border pointer-events-none z-20`}
        ></div>
        {isAnyPlaylistView ? (
          /* Venue Mode: Only Playlist View */
          <div className="w-full h-full flex flex-col overflow-hidden">
            <PlaylistView
              history={history}
              currentTrack={currentTrack}
              queue={queue} // Pass full queue
              user={user}
              onVote={handleVote}
              votes={userVotes} // Pass userVotes map
              isOwner={isOwner}
              // Playback Props
              progress={progress}
              volume={volume}
              isMuted={isMuted}
              activeChannel={activeChannel}
              onMuteToggle={handleMuteToggle}
              onVolumeChange={handleVolumeChange}
              votesEnabled={serverState?.votesEnabled ?? true}
              onPreview={allowPrelisten ? handlePreviewTrack : null}
              onDelete={isOwner ? handleDeleteSong : null}
              onRecommend={handleFetchSuggestions} // Passed handler
              onAdd={handleLibraryAdd}
              // Suggestions Props
              activeSuggestionId={activeSuggestionId}
              suggestions={manualSuggestions}
              isFetchingSuggestions={isFetchingSuggestions}
              queueVideoIds={queueVideoIds}
              disableFloatingUI={!!previewTrack}
              onLibraryDelete={isOwner ? handleRemoveFromLibrary : undefined}
              activeTab={playlistActiveTab}
            />
            {previewTrack && (
              <PrelistenOverlay
                hasConsent={hasConsent}
                playbackError={playbackError}
                playerContainerRef={playerContainerRef}
                isCinemaMode={isCinemaMode}
                t={t}
                musicSource={musicSource}
                previewTrack={previewTrack}
              />
            )}
          </div>
        ) : (
          /* Standard Mode */
          <>
            {!showPendingPage && !showBannedPage && (
              <div className="absolute inset-0">
                {!hasConsent ? (
                  CookieBlockedPlaceholderComponent ? <CookieBlockedPlaceholderComponent /> : <div className="w-full h-full flex items-center justify-center bg-black text-neutral-500">Loading…</div>
                ) : (
                  <>
                    <div style={{ display: (currentTrack || previewTrack) ? 'block' : 'none', width: '100%', height: '100%' }}>
                      <PlayerErrorBoundary>
                        {playbackError ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-center p-6 space-y-4">
                            <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400">
                              <AlertTriangle size={24} />
                            </div>
                            <div>
                              <p className="text-white font-medium mb-1">
                                {playbackError === 100 ? t('player.errorNotFound') : (playbackError === 101 || playbackError === 150 ? t('player.errorRestricted') : t('player.errorGeneric'))}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <Player
                            playerContainerRef={playerContainerRef}
                          />
                        )}
                      </PlayerErrorBoundary>
                    </div>
                    {!(currentTrack || previewTrack) && <div className="flex h-full w-full items-center justify-center text-neutral-500 bg-neutral-900">{t('playlist.queueEmpty')}</div>}
                  </>
                )}
              </div>
            )}

            {autoplayBlocked && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
                <button
                  onClick={() => window.location.reload()}
                  className="px-8 py-3 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-lg shadow-lg hover:from-orange-400 hover:to-orange-500 hover:scale-105 transition-all active:scale-95"
                >
                  {t('app.reloadToJoin')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {!isAnyPlaylistView && !isCinemaMode && (
        <div className={`min-h-0 transition-all duration-700 ease-in-out ${isQueueMinimized ? "flex-none" : "pb-4 flex-1"}`}>
          <Queue
            tracks={queue}
            currentTrack={currentTrack}
            expandedTrackId={expandedTrackId}
            votes={userVotes}
            onVote={handleVote}
            onToggleExpand={(trackId) => setExpandedTrackId(prev => prev === trackId ? null : trackId)}
            isMinimized={isQueueMinimized}
            onPreview={allowPrelisten ? handlePreviewTrack : null}
            votesEnabled={serverState?.votesEnabled ?? true}
            onDelete={isOwner ? handleDeleteSong : null}
            onRecommend={handleFetchSuggestions}
            onAdd={handleLibraryAdd}
            activeSuggestionId={activeSuggestionId}
            suggestions={manualSuggestions}
            isFetchingSuggestions={isFetchingSuggestions}
            queueVideoIds={queueVideoIds}
          />
        </div>
      )}

      {
        previewTrack ? (
          <div className="fixed bottom-0 left-0 w-full bg-green-900/95 backdrop-blur-md border-t border-green-700 px-3 py-2 sm:px-6 sm:py-3 flex items-center justify-between z-[80] select-none">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <button
                onClick={handleStopPreview}
                className="bg-white text-green-900 hover:bg-gray-100 transition-colors rounded-full p-2 sm:p-3 shadow-lg flex-shrink-0 flex items-center gap-2"
                title={t('app.backToRadio')}
              >
                <ArrowLeft size={18} className="sm:w-6 sm:h-6" />
                <span className="font-bold pr-2 hidden sm:inline">{t('app.backToRadio')}</span>
              </button>
              <div className="truncate min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm sm:text-base leading-tight truncate">{previewTrack.title}</h3>
                  <span className="bg-green-500 text-black px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold animate-pulse flex-shrink-0">PREVIEW</span>
                </div>
                <p className="text-green-200 text-xs sm:text-sm truncate">{previewTrack.artist}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 text-green-200 pl-2 sm:pl-4 flex-shrink-0">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleMuteToggle();
                }}
                className="hover:text-white transition-colors"
              >
                {isMuted ? <VolumeX /> : <Volume2 />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={volume}
                onChange={handleVolumeChange}
                className={`accent-green-500 w-24 ${isMuted ? "opacity-50" : ""} `}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          </div>
        ) : (
          !isAnyPlaylistView && !showPendingPage && hasConsent && (
            <PlaybackControls
              isPlaying={(isPlaying || isLocallyPlaying) && !isLocallyPaused}
              onPlayPause={handlePlayPause}
              progress={progress}
              currentTrack={currentTrack}
              activeChannel={activeChannel}
              isMuted={isMuted}
              onMuteToggle={handleMuteToggle}
              volume={volume}
              onVolumeChange={handleVolumeChange}
              isQueueMinimized={isQueueMinimized}
              onQueueToggle={() => setIsQueueMinimized(prev => !prev)}
              upcomingCount={upcomingCount}
              isCinemaMode={isCinemaMode}
              onToggleCinemaMode={() => setIsCinemaMode(!isCinemaMode)}
              onVisibilityChange={handleVisibilityChange}
              isOwner={isOwner}
              onSeek={handleSeek}
              onHeightChange={handleControlsHeightChange}
              canShowControls={canShowControls}
            />
          )
        )
      }
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {/* TV Unmute Overlay - only when video is visible (not in playlist-only view) */}
      {deviceDetection.isTV() && isMuted && isPlayerReady && !isAnyPlaylistView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
          <button
            onClick={() => {
              handleMuteToggle();
              const isEffectivelyPlaying = (isPlaying || isLocallyPlaying) && !isLocallyPaused;
              if (!isEffectivelyPlaying) {
                handlePlayPause();
              }
            }}
            className="group relative bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full px-12 py-6 text-3xl font-bold flex items-center gap-6 shadow-2xl hover:from-orange-400 hover:to-orange-500 hover:scale-105 transition-all duration-300"
          >
            <div className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <VolumeX size={48} className="animate-pulse" />
            {t('app.tapToUnmute')}
            <div className="absolute -inset-4 rounded-full border border-white/20 animate-ping opacity-20" />
            <div className="absolute -inset-8 rounded-full border border-white/10 animate-ping opacity-10 animation-delay-300" />
          </button>
        </div>
      )}

    </div>
  );
}
export default RoomBody;
