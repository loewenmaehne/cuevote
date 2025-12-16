import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Volume2, VolumeX, ArrowLeft, Lock, X } from "lucide-react";
import { Header } from "./components/Header";
import { SuggestSongForm } from "./components/SuggestSongForm";
import { Player } from "./components/Player";
import { Queue } from "./components/Queue";
import { PlaylistView } from "./components/PlaylistView"; // Added this import
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
  const activeRoomId = roomId || "synthwave";
  const [localPlaylistView, setLocalPlaylistView] = useState(false);

  console.log("App Component MOUNTED, Room:", activeRoomId);

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

  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (lastError) {
      setToast({ message: lastError.message || "An error occurred", type: "error" });
    }
  }, [lastError, lastErrorTimestamp]);

  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'info') setToast({ message: lastMessage.message, type: "info" });
      else if (lastMessage.type === 'success') {
        if (lastMessage.message === "Added") return; // Suppress redundant "Success" popup for song additions
        setToast({ message: lastMessage.payload || "Success", type: "success" });
      }
      else if (lastMessage.type === 'error') setToast({ message: lastMessage.message, type: "error" });
    }
  }, [lastMessage]);

  console.log("Server State:", serverState);

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
  } = serverState || {};


  const isOwner = user && ownerId && user.id === ownerId;
  const isVenueMode = playlistViewMode && !isOwner;
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
  console.log(`[CLIENT TRACE] App Render.Active: ${activeRoomId}, Server: ${serverRoomId}, Stale ? ${serverState && serverRoomId && (serverRoomId.toString().trim().toLowerCase() !== activeRoomId.toString().trim().toLowerCase())} `);

  // Join Room on Connect or Room Change
  const location = useLocation();

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
  const [showPendingPage, setShowPendingPage] = useState(false);
  const [showBannedPage, setShowBannedPage] = useState(false); // Added this
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [volume, setVolume] = useState(80);
  // minimized state removed
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isLocallyPaused, setIsLocallyPaused] = useState(false);
  const [previewTrack, setPreviewTrack] = useState(null);
  // const [user, setUser] = useState(null); // Now from Context
  const [progress, setProgress] = useState(0);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false); // <--- Added this
  const [showChannelLibrary, setShowChannelLibrary] = useState(false); // <--- Added this
  const [controlsVisible, setControlsVisible] = useState(true); // Track footer visibility

  // Handle Escape Key for App-level modals
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (showPendingPage) setShowPendingPage(false);
        if (showBannedPage) setShowBannedPage(false);
        if (showSuggest) setShowSuggest(false);
        if (showQRModal) setShowQRModal(false);
        if (showChannelLibrary) setShowChannelLibrary(false);
        // Password Modal is tricky - usually mandatory but if user wants to cancel joining, maybe? 
        // Logic in View was: Cancel -> navigate('/'). So we can replicate that?
        if (showPasswordModal) {
          // Optional: Uncomment if Escape should effectively "Cancel" the join
          // navigate('/'); 
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

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);


  // YouTube API Loading
  const loadYouTubeAPI = useCallback(() => {
    return new Promise((resolve, reject) => {
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
  }, []);

  // Player Initialization
  const initializePlayer = useCallback((container) => {
    console.log("[Player] Initializing...", container);
    loadYouTubeAPI().then((YT) => {
      console.log("[Player] YT loaded, creating player instance");
      playerRef.current = new YT.Player(container, {
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 0,
          controls: 0,
          origin: 'http://localhost:5173',
        },
        events: {
          onReady: (event) => {
            console.log("[Player] YouTube Player onReady fired");
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
              setAutoplayBlocked(false);
              const duration = event.target.getDuration();
              if (duration && duration > 0) {
                sendMessage({ type: "UPDATE_DURATION", payload: duration });
              }
            } else if (state === YouTubeState.PAUSED) {
              // If user pauses manually in the iframe, respect it locally
              setIsLocallyPaused(true);
            }
          },
          onError: (event) => {
            console.error("YouTube Player Error:", event.data);
          },
        },
      });
    });
  }, [loadYouTubeAPI, sendMessage]);

  const playerContainerRef = useCallback(node => {
    console.log("[Player] Container ref called", node);
    if (node !== null) {
      initializePlayer(node);
    } else {
      console.log("[Player] Container ref null (unmount)");
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
      } else if (isPlaying && !isLocallyPaused) {
        playerRef.current.playVideo?.();
      } else {
        playerRef.current.pauseVideo?.();
      }
    }
  }, [isPlayerReady, isPlaying, currentTrack, isLocallyPaused, previewTrack]);

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

    if (isLocallyPaused) {

      setIsLocallyPaused(false);

      playerRef.current?.seekTo?.(serverProgress);

      playerRef.current?.playVideo?.();

    }

    else {

      setIsLocallyPaused(true);

      playerRef.current?.pauseVideo?.();

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
        <h2 className="text-3xl font-bold text-red-500 mb-4">Channel does not exist</h2>
        <p className="text-neutral-400 mb-8">The channel you are looking for ({activeRoomId}) could not be found.</p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={20} /> Go to Lobby
        </button>
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
            <Lock size={20} className="text-orange-500" /> Private Channel
          </h3>
          <button onClick={() => navigate('/')} className="text-neutral-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="mb-4 text-neutral-400 text-sm">
          This channel is password protected. Please enter the password to join.
        </div>

        <form onSubmit={submitPasswordJoin} className="space-y-4">
          <div>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter password..."
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
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold hover:from-orange-400 hover:to-orange-500 transition-all"
            >
              Unlock
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
          <h2 className="text-2xl font-bold mb-4">Switching Channels...</h2>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        </div>
        {passwordModalContent}
      </div>
    );
  }


  const handleDeleteSong = (trackId) => {
    sendMessage({ type: "DELETE_SONG", payload: { trackId } });
  };






  return (
    <div className={`min-h-screen text-white flex flex-col ${isAnyPlaylistView ? "bg-[#0a0a0a] pb-0" : "bg-black pb-32"}`}>
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
          onBan={handleBanSuggestion} // Added this
          onClose={() => handleUpdateSettings({ ownerPopups: false })}
        />
      )}

      {showPendingPage && (
        <PendingRequestsPage
          requests={pendingSuggestions}
          onApprove={handleApproveSuggestion}
          onReject={handleRejectSuggestion}
          onBan={handleBanSuggestion}
          onManageBanned={() => setShowBannedPage(true)} // Added this
          onClose={() => setShowPendingPage(false)}
        />
      )}

      {showBannedPage && (
        <BannedSongsPage
          bannedSongs={bannedSongs}
          onUnban={handleUnbanSong}
          onClose={() => setShowBannedPage(false)}
        />
      )}

      {showChannelLibrary && (
        <ChannelLibrary
          history={history}
          activeChannel={activeChannel}
          onExit={() => setShowChannelLibrary(false)}
          onAdd={handleLibraryAdd}
          isOwner={isOwner}
          onDelete={isOwner ? handleRemoveFromLibrary : undefined}
        />
      )}

      <div
        className={isCinemaMode
          ? "fixed inset-0 z-40 bg-black transition-all duration-500 ease-in-out"
          : (isAnyPlaylistView
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
              onExit={localPlaylistView ? () => setLocalPlaylistView(false) : null}
            />
            {previewTrack && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-fadeIn">
                <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative">
                  <PlayerErrorBoundary>
                    <Player
                      playerContainerRef={playerContainerRef}
                    />
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
                <div style={{ display: (currentTrack || previewTrack) ? 'block' : 'none', width: '100%', height: '100%' }}>
                  <PlayerErrorBoundary>
                    <Player
                      playerContainerRef={playerContainerRef}
                    />
                  </PlayerErrorBoundary>
                  {/* <div className="flex h-full w-full items-center justify-center text-neutral-500 bg-neutral-900">Player Disabled for Debug</div> */}
                </div>
                {!(currentTrack || previewTrack) && <div className="flex h-full w-full items-center justify-center text-neutral-500 bg-neutral-900">Queue empty</div>}
              </div>
            )}

            {autoplayBlocked && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
                <button
                  onClick={() => playerRef.current?.playVideo?.()}
                  className="px-8 py-3 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-lg shadow-lg hover:from-orange-400 hover:to-orange-500 hover:scale-105 transition-all active:scale-95"
                >
                  Tap to Join Session
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="pb-4">
        {isAnyPlaylistView || isCinemaMode ? null : ( // Hide queue if playlistViewMode/isCinemaMode is active
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
          <div className="fixed bottom-0 left-0 w-full bg-green-900/95 backdrop-blur-md border-t border-green-700 px-3 py-2 sm:px-6 sm:py-3 flex items-center justify-between z-50 select-none">
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
                className={`accent - green - 500 w - 24 ${isMuted ? "opacity-50" : ""} `}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          </div>
        ) : (
          !isAnyPlaylistView && (
            <PlaybackControls
              isPlaying={isPlaying && !isLocallyPaused}
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
      {passwordModalContent}
    </div >
  );
}
export default App;
