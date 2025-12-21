import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { isTV } from './utils/deviceDetection';
import { Volume2, VolumeX, ArrowLeft, Lock, X, Music, PlayCircle, Maximize2 } from "lucide-react";
import { useConsent } from './contexts/ConsentContext';
import { CookieBlockedPlaceholder } from './components/CookieBlockedPlaceholder';
import { useLanguage } from './contexts/LanguageContext';
import { Header } from "./components/Header";
import { SuggestSongForm } from "./components/SuggestSongForm";
import { Player } from "./components/Player";
import { Queue } from "./components/Queue";
import { PlaylistView } from "./components/PlaylistView"; // Added this import
import { SettingsView } from "./components/SettingsView";
import { PendingRequests, PendingRequestsPage } from "./components/PendingRequests";
import { BannedSongsPage } from "./components/BannedSongs"; // Added this import
import { ChannelLibrary } from "./components/ChannelLibrary"; // Added this import
import { PlaybackControls } from "./components/PlaybackControls";
import { useWebSocketContext } from "./hooks/useWebSocketContext";
import PlayerErrorBoundary from "./components/PlayerErrorBoundary.jsx";
import { Toast } from "./components/Toast";



const YouTubeState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

function App() {

  const { roomId } = useParams();

  const navigate = useNavigate();
  const location = useLocation();
  const activeRoomId = roomId || "synthwave";

  const [localPlaylistView, setLocalPlaylistView] = useState(false);
  const [showSettings, setShowSettings] = useState(false); // Refactored state from Header
  // const [hasConsent, setHasConsent] = useState(() => !!localStorage.getItem("cuevote_cookie_consent"));
  const { hasConsent, giveConsent } = useConsent();
  const { t } = useLanguage();

  // console.log("App Component MOUNTED, Room:", activeRoomId);

  // WebSocket connection (Shared)
  const {
    state: serverState,
    isConnected,
    sendMessage,
    lastError,
    lastErrorCode,
    lastErrorTimestamp, // <--- Added this
    lastMessage, // <--- Added this
    clientId,
    user,
    handleLogout,
    handleLoginSuccess,
  } = useWebSocketContext();



  // console.log("Server State:", serverState);

  // Handle Delete Account Success (Moved up to avoid conditional hook call error)
  useEffect(() => {
    if (lastMessage && lastMessage.type === "DELETE_ACCOUNT_SUCCESS") {
      console.log("Account deleted successfully");
      handleLogout();
      navigate('/');
    }
    if (lastMessage && lastMessage.type === "ROOM_DELETED") {
      console.log("Room deleted successfully");
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
    progress: serverProgress = 0,
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
    bannedSongs = [], // Added this
    captionsEnabled = false
  } = serverState || {};


  const isOwner = user && ownerId && user.id === ownerId;
  // TV always ignores Venue Mode (shows video)
  const isVenueMode = playlistViewMode && !isOwner && !isTV();
  // TV always defaults to Fullscreen (CinemaMode), unless manually exited
  const isAnyPlaylistView = isVenueMode || localPlaylistView;

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

  const handleUnbanSong = (videoId) => {
    sendMessage({ type: "UNBAN_SONG", payload: { videoId } });
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

  useEffect(() => {
    if (isConnected) {
      // If we joined from the lobby (verified password there), we don't need to join again.
      // However, we should ensure the server state matches.
      if (location.state?.alreadyJoined && activeRoomId === serverRoomId) {
        console.log("[App] Skipping join, already joined from Lobby");
        return;
      }

      // NEW: If we are already in the target room (according to server state), skip redundant join.
      // This prevents the "double unlock" bug where a state update triggers a second join without password.
      if (serverRoomId && activeRoomId && serverRoomId.toString().trim().toLowerCase() === activeRoomId.toString().trim().toLowerCase()) {
        console.log("[App] Skipping join, already in target room:", activeRoomId);
        return;
      }

      // console.log(`Joining room: ${ activeRoomId } `);
      const password = location.state?.password;
      lastPasswordAttemptRef.current = password; // Track it
      sendMessage({ type: "JOIN_ROOM", payload: { roomId: activeRoomId, password } });
    }
  }, [isConnected, activeRoomId, sendMessage, location.state, serverRoomId]);

  // Handle Password Required Error
  useEffect(() => {
    if (lastErrorCode === "PASSWORD_REQUIRED") {
      setShowPasswordModal(true);
      // Only show "Incorrect password" if we actually TRIED a password.
      if (lastPasswordAttemptRef.current) {
        setPasswordError("Incorrect password");
      } else {
        setPasswordError(""); // Reset error if we just bumped into the lock without a key
      }
    }
  }, [lastErrorCode, lastErrorTimestamp]);

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
  }, [serverState, serverRoomId, activeRoomId, location.state]);


  const submitPasswordJoin = (e) => {
    e.preventDefault();
    setPasswordError(""); // Clear previous errors
    lastPasswordAttemptRef.current = passwordInput; // Track it
    sendMessage({ type: "JOIN_ROOM", payload: { roomId: activeRoomId, password: passwordInput } });
    // Do NOT close modal here. Wait for success or error.
    // setShowPasswordModal(false); 
    // setPasswordInput("");
  };

  // Stale State Guard: If we switched rooms but serverState is still from the old room, show loading.
  const isStaleState = serverState && serverRoomId && (serverRoomId.toString().trim().toLowerCase() !== activeRoomId.toString().trim().toLowerCase());

  useEffect(() => {
    let timeout;
    if (isConnected && isStaleState) {
      console.warn(`[STALE DEBUG]Wanted: ${activeRoomId}, Got: ${serverRoomId}.Retrying in 3s...`);
      timeout = setTimeout(() => {
        console.warn(`[STALE DEBUG] Sending JOIN_ROOM for ${activeRoomId}`);
        sendMessage({ type: "JOIN_ROOM", payload: { roomId: activeRoomId } });
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [isConnected, isStaleState, activeRoomId, serverRoomId, sendMessage]);

  // Local UI state
  const [expandedTrackId, setExpandedTrackId] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showSuggest, setShowSuggest] = useState(false);

  // Fix: Use Ref to track showSuggeststate to suppress global toasts when bar is open
  const showSuggestRef = useRef(showSuggest);
  useEffect(() => { showSuggestRef.current = showSuggest; }, [showSuggest]);

  const [toast, setToast] = useState(null);

  useEffect(() => {
    // If Suggest Bar is open, suppress global toasts (errors/messages shown inline)
    if (showSuggestRef.current) return;

    if (lastError) {
      setToast({ message: lastError.message || "An error occurred", type: "error" });
    }
  }, [lastError, lastErrorTimestamp]); // showSuggestRef is stable

  useEffect(() => {
    // If Suggest Bar is open, suppress global toasts
    if (showSuggestRef.current) return;

    if (lastMessage) {
      if (lastMessage.type === 'info') setToast({ message: lastMessage.message, type: "info" });
      else if (lastMessage.type === 'success') {
        if (lastMessage.message === "Added") return; // Suppress redundant "Success" popup for song additions
        setToast({ message: lastMessage.payload || "Success", type: "success" });
      }
      else if (lastMessage.type === 'error') setToast({ message: lastMessage.message, type: "error" });
    }
  }, [lastMessage]);
  const [showPendingPage, setShowPendingPage] = useState(false);
  const [showBannedPage, setShowBannedPage] = useState(false); // Added this
  const [isCinemaMode, setIsCinemaMode] = useState(isTV());
  const [volume, setVolume] = useState(80);
  // minimized state removed
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isLocallyPaused, setIsLocallyPaused] = useState(false);
  const [isLocallyPlaying, setIsLocallyPlaying] = useState(false);
  const [previewTrack, setPreviewTrack] = useState(null);
  // const [user, setUser] = useState(null); // Now from Context
  const [progress, setProgress] = useState(0);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false); // <--- Added this
  const [showChannelLibrary, setShowChannelLibrary] = useState(false); // <--- Added this
  const [controlsVisible, setControlsVisible] = useState(true); // Track footer visibility
  const [isWindowTooSmall, setIsWindowTooSmall] = useState(false);

  // Monitor Window Size for TOS Compliance
  useEffect(() => {
    const checkSize = () => {
      // Minimum dimensions: 360x400 to ensure player isn't obscured by bars
      const tooSmall = window.innerWidth < 360 || window.innerHeight < 400;
      setIsWindowTooSmall(tooSmall);
    };

    // Check initially
    checkSize();

    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Handle Escape Key for App-level modals
  useEffect(() => {
    const handleEscape = (e) => {
      // Prevent Backspace from closing modals while typing
      if (e.key === 'Backspace' && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      // Allow "Back" or "Escape" on TV to exit Cinema Mode
      if (isCinemaMode && (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'ArrowLeft')) {
        // Special handling: if ArrowLeft, only exit if no specialized UI is focused?
        // Safer to just use Escape/Backspace (standard Android TV Back)
      }

      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (showPendingPage) setShowPendingPage(false);
        else if (showBannedPage) setShowBannedPage(false);
        else if (showSuggest) setShowSuggest(false);
        else if (showQRModal) setShowQRModal(false);
        else if (showChannelLibrary) setShowChannelLibrary(false);
        else if (showPasswordModal) { /* navigate('/'); */ }
        else if (isCinemaMode) {
          setIsCinemaMode(false); // <--- Add this!
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showPendingPage, showBannedPage, showSuggest, showQRModal, showPasswordModal]);

  // Auth: Resume Session logic moved to Provider

  // Auth: Handle Login Events logic moved to Provider? 
  // We still need to trigger the context update if we want.
  // Actually, let's update the Provider to handle user state.

  // YouTube Player state
  const playerRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  const isPlayingRef = useRef(isPlaying); // Track latest server state for event handlers

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const currentTrackRef = useRef(currentTrack);
  useEffect(() => {
    currentTrackRef.current = currentTrack;
    if (isPlayerReady && playerRef.current && currentTrack?.language) {
      try {
        console.log("[Player] Setting Caption Language:", currentTrack.language);
        playerRef.current.setOption && playerRef.current.setOption('captions', 'track', { languageCode: currentTrack.language });
      } catch (e) { console.error("Failed to set caption language", e); }
    }
  }, [currentTrack, isPlayerReady]);


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
    if (!hasConsent) return; // Gate Initialization
    // console.log("[Player] Initializing...", container);
    loadYouTubeAPI().then((YT) => {
      // console.log("[Player] YT loaded, creating player instance");
      playerRef.current = new YT.Player(container, {
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 0,
          controls: 0,
          origin: window.location.origin,
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
          },
        },
      });
    });
  }, [loadYouTubeAPI, sendMessage, hasConsent, captionsEnabled, currentTrack?.language]);

  const playerContainerRef = useCallback(node => {
    if (!hasConsent) return; // Gate Ref Handling
    console.log("[Player] Container ref called", node);
    if (node !== null) {
      initializePlayer(node);
    } else {
      // console.log("[Player] Container ref null (unmount)");
      // Cleanup on unmount
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) { console.error("Player cleanup error", e); }
        playerRef.current = null;
        setIsPlayerReady(false); // Reset player ready state so it triggers updates when re-initialized
      }
    }
  }, [initializePlayer]);

  // Main playback logic
  useEffect(() => {
    const targetTrack = previewTrack || currentTrack;
    if (isPlayerReady && playerRef.current && targetTrack) {
      const currentVideoIdInPlayer = playerRef.current.getVideoData?.()?.video_id;
      if (targetTrack.videoId !== currentVideoIdInPlayer) {
        const startTime = previewTrack ? 0 : serverProgress;
        playerRef.current.loadVideoById?.(targetTrack.videoId, startTime);
      }
    } else if (isPlayerReady && playerRef.current && !targetTrack) {
      playerRef.current.stopVideo?.();
    }
  }, [isPlayerReady, currentTrack, previewTrack, serverProgress]);

  useEffect(() => {
    if (isPlayerReady && playerRef.current) {
      if (previewTrack) {
        playerRef.current.playVideo?.();
      } else if ((isPlaying || isLocallyPlaying) && !isLocallyPaused) {
        playerRef.current.playVideo?.();
      } else {
        playerRef.current.pauseVideo?.();
      }
    }
  }, [isPlayerReady, isPlaying, currentTrack, isLocallyPaused, isLocallyPlaying, previewTrack]);

  useEffect(() => {
    if (isPlayerReady && playerRef.current && isPlaying && !previewTrack) {
      if (playerRef.current.getPlayerState?.() === YouTubeState.ENDED) return;
      const localProgress = playerRef.current.getCurrentTime?.();
      if (localProgress && Math.abs(localProgress - serverProgress) > 2) {
        playerRef.current.seekTo?.(serverProgress);
      }
    }
  }, [isPlayerReady, serverProgress, isPlaying, previewTrack]);

  // Autoplay detection
  useEffect(() => {
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

  // Progress bar update
  useEffect(() => {
    if (playerRef.current && playerRef.current.getDuration) {
      const duration = playerRef.current.getDuration?.();
      if (duration > 0) {
        setProgress((serverProgress / duration) * 100);
      }
    } else {
      setProgress(0);
    }
  }, [serverProgress]);

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
        playerRef.current?.pauseVideo?.();
      } else {
        // User wants to PLAY
        setIsLocallyPaused(false);
        setIsLocallyPlaying(true);
        playerRef.current?.playVideo?.();
      }
    }
  };



  const handleMuteToggle = () => {

    if (isMuted) playerRef.current?.unMute?.();

    else playerRef.current?.mute?.();

    setIsMuted(!isMuted);

  };



  const handleVolumeChange = (e) => {

    const newVolume = Number(e.target.value);

    setVolume(newVolume);

    if (playerRef.current) {

      playerRef.current.setVolume?.(newVolume);

      if (isMuted) {

        playerRef.current.unMute?.();

        setIsMuted(false);

      }

    }

  };



  const handleSongSuggested = (query) => {
    sendMessage({ type: "SUGGEST_SONG", payload: { query, userId: user?.id } });
  };

  const handleLibraryAdd = (videoId) => {
    console.log("[App] Adding from Library:", videoId);
    handleSongSuggested(`https://www.youtube.com/watch?v=${videoId}`);
    setShowChannelLibrary(false);
  };

  const handleRemoveFromLibrary = (videoId) => {
    console.log("[App] Removing from Library:", videoId);
    sendMessage({ type: "REMOVE_FROM_LIBRARY", payload: { videoId } });
  };



  const handleVote = (trackId, type) => {

    sendMessage({ type: "VOTE", payload: { trackId, voteType: type } });

  };




  const handlePreviewTrack = (track) => {

    setIsLocallyPaused(true);

    setPreviewTrack(track);

  };



  const handleUpdateSettings = (settings) => {
    sendMessage({ type: "UPDATE_SETTINGS", payload: settings });
  };

  const handleStopPreview = () => {
    setPreviewTrack(null);
    setIsLocallyPaused(false);
    playerRef.current?.seekTo?.(serverProgress);
  };

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
  if (isWindowTooSmall && !isTV()) { // Adjusted to ignore TV as TV might report weird sizes but is trusted
    return (
      <div className="flex flex-col h-screen w-full bg-black items-center justify-center p-6 text-center z-[100] relative overflow-hidden">
        <div className="absolute inset-0 bg-neutral-900/50" />
        <div className="relative z-10 max-w-sm space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 animate-bounce">
            <Maximize2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white">Window Too Small</h2>
          <p className="text-neutral-400">
            Please resize your window to continue using CueVote. We need a bit more space to show the video player correctly.
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



  // Strict Consent Blocking - "Friendlier Welcome Gate"
  if (!hasConsent) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#050505] items-center justify-center p-6 relative overflow-hidden select-none">
        {/* Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/20 via-[#050505] to-[#050505] pointer-events-none" />

        <div className="relative z-10 max-w-lg text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-white">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-400">CueVote</span>
            </h1>
            <p className="text-xl text-neutral-400 font-medium">The Democratic Jukebox</p>
          </div>

          <div className="p-8 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 mb-4">
              <Music size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Enable Audio & Video</h2>
              <p className="text-neutral-400 text-sm leading-relaxed">
                To play music from YouTube and participate in the playlist, we need to use cookies.
              </p>
            </div>

            <button
              onClick={giveConsent}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold text-lg shadow-lg hover:shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <PlayCircle size={24} className="fill-current" />
              Enable & Join Party
            </button>

            <p className="text-xs text-neutral-600">
              By joining, you agree to our <a href="/legal" target="_blank" className="underline hover:text-neutral-400">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
          <h2 className="text-2xl font-bold mb-4">{t('app.switching')}</h2>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        </div>
        {passwordModalContent}
      </div>
    );
  }


  const handleDeleteSong = (trackId) => {
    sendMessage({ type: "DELETE_SONG", payload: { trackId } });
  };






  const handleSeek = (percentage) => {
    if (!playerRef.current) return;
    const duration = playerRef.current.getDuration();
    if (!duration) return;
    const seconds = (percentage / 100) * duration;

    // Send to server (Owner only check server-side, but frontend check is good too)
    if (isOwner) {
      sendMessage({ type: "SEEK_TO", payload: seconds });
      // Seek locally immediately for responsiveness
      playerRef.current.seekTo(seconds, true);
    }
  };

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
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen text-white flex flex-col ${isAnyPlaylistView || showChannelLibrary ? "bg-[#0a0a0a] pb-0" : "bg-black pb-32"}`}>
      {!isCinemaMode && (
        <div className="sticky top-0 z-[55] bg-[#050505]/95 backdrop-blur-md border-b border-neutral-900 transition-all duration-700 ease-in-out">
          <Header
            activeChannel={activeChannel}
            onGoHome={() => navigate("/")}
            onShowSuggest={setShowSuggest}
            user={user}
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount} // GDPR
            isOwner={isOwner}
            suggestionsEnabled={suggestionsEnabled}
            musicOnly={musicOnly}
            maxDuration={maxDuration}
            allowPrelisten={allowPrelisten}
            ownerBypass={ownerBypass}
            maxQueueSize={maxQueueSize}
            smartQueue={smartQueue}
            playlistViewMode={playlistViewMode}
            history={history} // Passed history to Header
            duplicateCooldown={duplicateCooldown}
            onUpdateSettings={handleUpdateSettings}
            suggestionMode={suggestionMode}
            ownerPopups={ownerPopups}
            ownerQueueBypass={serverState?.ownerQueueBypass}
            votesEnabled={serverState?.votesEnabled ?? true}
            onManageRequests={() => setShowPendingPage(true)}
            pendingCount={pendingSuggestions.length}
            autoApproveKnown={autoApproveKnown}
            autoRefill={autoRefill}
            onTogglePlaylistView={() => {
              console.log("[App] Toggling Playlist View", !localPlaylistView);
              if (!localPlaylistView) setShowChannelLibrary(false);
              setLocalPlaylistView(!localPlaylistView);
            }}
            showQRCode={showQRModal}
            onShowQRCode={setShowQRModal}
            onToggleChannelLibrary={() => {
              if (!showChannelLibrary) setLocalPlaylistView(false); // Close Playlist View
              setShowChannelLibrary(!showChannelLibrary);
            }}
            onDeleteChannel={handleDeleteChannel}
            showSettings={showSettings}
            onToggleSettings={() => {
              setShowSettings(!showSettings);
              if (!showSettings) setShowSuggest(false); // Close suggest if opening settings
            }}
            captionsEnabled={captionsEnabled}
          />
          {showSuggest && (
            <div className="px-6 pb-4">
              <SuggestSongForm onSongSuggested={handleSongSuggested} onShowSuggest={setShowSuggest} serverError={lastError} serverMessage={lastMessage} isOwner={isOwner && ownerBypass} suggestionsEnabled={suggestionsEnabled} suggestionMode={suggestionMode} />
            </div>
          )}
        </div>
      )}

      {isOwner && pendingSuggestions.length > 0 && ownerPopups && (
        <PendingRequests
          requests={pendingSuggestions}
          onApprove={handleApproveSuggestion}
          onReject={handleRejectSuggestion}
          onBan={handleBanSuggestion}
          onPreview={handlePreviewTrack}
          onClose={() => handleUpdateSettings({ ownerPopups: false })}
        />
      )}

      {showPendingPage && (
        <PendingRequestsPage
          requests={pendingSuggestions}
          onApprove={handleApproveSuggestion}
          onReject={handleRejectSuggestion}
          onBan={handleBanSuggestion}
          onManageBanned={() => setShowBannedPage(true)}
          onPreview={handlePreviewTrack}
          onClose={() => setShowPendingPage(false)}
        />
      )}

      {showPendingPage && previewTrack && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-fadeIn">
          <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative">
            <PlayerErrorBoundary>
              {hasConsent ? (
                <Player
                  playerContainerRef={playerContainerRef}
                />
              ) : <CookieBlockedPlaceholder />}
            </PlayerErrorBoundary>
          </div>
        </div>
      )}

      {showBannedPage && (
        <BannedSongsPage
          bannedSongs={bannedSongs}
          onUnban={handleUnbanSong}
          onClose={() => setShowBannedPage(false)}
        />
      )}



      <div
        className={isCinemaMode
          ? "fixed inset-0 z-40 bg-black transition-all duration-500 ease-in-out"
          : (isAnyPlaylistView || showChannelLibrary
            ? "flex-1 w-full relative group transition-all duration-500 ease-in-out min-h-0"
            : "w-full relative group transition-all duration-500 ease-in-out flex-shrink-0 aspect-video max-h-[60vh]"
          )
        }
        style={{
          // In Cinema Mode, lift the bottom if controls are visible to avoid overlay violation
          bottom: (isCinemaMode && controlsVisible) ? "6rem" : "0px"
        }}
      >
        <div className={`absolute inset - 0 border - 4 ${previewTrack ? "border-green-500" : "border-transparent"} transition - colors duration - 300 box - border pointer - events - none z - 20`}></div>
        {showChannelLibrary ? (
          /* Channel Library View */
          <div className="w-full h-full flex flex-col overflow-hidden">
            <ChannelLibrary
              history={history}
              activeChannel={activeChannel}
              onExit={() => setShowChannelLibrary(false)}
              onAdd={handleLibraryAdd}
              isOwner={isOwner}
              onDelete={isOwner ? handleRemoveFromLibrary : undefined}
              onPreview={allowPrelisten ? handlePreviewTrack : null}
            />
            {previewTrack && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-fadeIn">
                <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative">
                  <PlayerErrorBoundary>
                    {hasConsent ? (
                      <Player
                        playerContainerRef={playerContainerRef}
                      />
                    ) : <CookieBlockedPlaceholder />}
                  </PlayerErrorBoundary>
                </div>
              </div>
            )}
          </div>
        ) : isAnyPlaylistView ? (
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
              onExit={localPlaylistView ? () => setLocalPlaylistView(false) : null}
              onDelete={isOwner ? handleDeleteSong : null} // Added Delete feature
            />
            {previewTrack && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-fadeIn">
                <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative">
                  <PlayerErrorBoundary>
                    {hasConsent ? (
                      <Player
                        playerContainerRef={playerContainerRef}
                      />
                    ) : <CookieBlockedPlaceholder />}
                  </PlayerErrorBoundary>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Standard Mode */
          <>
            {!showPendingPage && !showBannedPage && (
              <div className="absolute inset-0">
                {!hasConsent ? (
                  <CookieBlockedPlaceholder />
                ) : (
                  <>
                    <div style={{ display: (currentTrack || previewTrack) ? 'block' : 'none', width: '100%', height: '100%' }}>
                      <PlayerErrorBoundary>
                        <Player
                          playerContainerRef={playerContainerRef}
                        />
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
                  Reload to Join
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="pb-4 min-h-0 flex-1">
        {isAnyPlaylistView || isCinemaMode || showChannelLibrary ? null : ( // Hide queue if playlistViewMode/isCinemaMode/ChannelLibrary is active
          <Queue
            tracks={queue}
            currentTrack={currentTrack}
            expandedTrackId={expandedTrackId}
            votes={userVotes}
            onVote={handleVote}
            onToggleExpand={(trackId) => setExpandedTrackId(prev => prev === trackId ? null : trackId)}
            isMinimized={false}
            onPreview={allowPrelisten ? handlePreviewTrack : null}
            votesEnabled={serverState?.votesEnabled ?? true}
            onDelete={isOwner ? handleDeleteSong : null}
          />
        )}

      </div>

      {
        previewTrack ? (
          <div className="fixed bottom-0 left-0 w-full bg-green-900/95 backdrop-blur-md border-t border-green-700 px-3 py-2 sm:px-6 sm:py-3 flex items-center justify-between z-[80] select-none">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <button
                onClick={handleStopPreview}
                className="bg-white text-green-900 hover:bg-gray-100 transition-colors rounded-full p-2 sm:p-3 shadow-lg flex-shrink-0 flex items-center gap-2"
                title="Back to Radio"
              >
                <ArrowLeft size={18} className="sm:w-6 sm:h-6" />
                <span className="font-bold pr-2 hidden sm:inline">Back to Radio</span>
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
          !isAnyPlaylistView && !showChannelLibrary && !showPendingPage && hasConsent && (
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
              onMinimizeToggle={null}
              isCinemaMode={isCinemaMode}
              onToggleCinemaMode={() => setIsCinemaMode(!isCinemaMode)}
              onVisibilityChange={setControlsVisible}
              isOwner={isOwner}
              onSeek={handleSeek}
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
      {/* TV Unmute Overlay */}
      {isTV() && isMuted && isPlayerReady && (
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
            <Volume2 size={48} className="relative z-10" />
            <span className="relative z-10">{t('app.unmuteAndPlay')}</span>
          </button>
        </div>
      )}

      {/* CookieConsent handled globally in main.jsx */}
      {passwordModalContent}
    </div >
  );
}
export default App;
