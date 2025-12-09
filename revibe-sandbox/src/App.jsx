import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Volume2, VolumeX, ArrowLeft } from "lucide-react";
import { Header } from "./components/Header";
import { SuggestSongForm } from "./components/SuggestSongForm";
import { Player } from "./components/Player";
import { Queue } from "./components/Queue";
import { PlaylistView } from "./components/PlaylistView"; // Added this import
import { PendingRequests, PendingRequestsPage } from "./components/PendingRequests";
import { PlaybackControls } from "./components/PlaybackControls";
import { useWebSocketContext } from "./hooks/useWebSocketContext";
import PlayerErrorBoundary from "./components/PlayerErrorBoundary.jsx";

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

  console.log("App Component MOUNTED, Room:", activeRoomId);

  // WebSocket connection (Shared)
  const {
    state: serverState,
    isConnected,
    sendMessage,
    lastError,
    lastMessage, // <--- Added this
    clientId,
    user,
    handleLogout,
    handleLoginSuccess,
  } = useWebSocketContext();

  console.log("Server State:", serverState);

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
  } = serverState || {};

  const isOwner = user && ownerId && user.id === ownerId;

  // Pending Suggestions Handlers
  const handleApproveSuggestion = (trackId) => {
    sendMessage({ type: "APPROVE_SUGGESTION", payload: { trackId } });
  };

  const handleRejectSuggestion = (trackId) => {
    sendMessage({ type: "REJECT_SUGGESTION", payload: { trackId } });
  };

  // Trace Render Cycle
  console.log(`[CLIENT TRACE] App Render.Active: ${activeRoomId}, Server: ${serverRoomId}, Stale ? ${serverState && serverRoomId && (serverRoomId.toString().trim().toLowerCase() !== activeRoomId.toString().trim().toLowerCase())} `);

  // Join Room on Connect or Room Change
  useEffect(() => {
    if (isConnected) {
      // console.log(`Joining room: ${ activeRoomId } `);
      sendMessage({ type: "JOIN_ROOM", payload: { roomId: activeRoomId } });
    }
  }, [isConnected, activeRoomId, sendMessage]);

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
  // showChannels removed
  const [volume, setVolume] = useState(80);
  // minimized state removed
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isLocallyPaused, setIsLocallyPaused] = useState(false);
  const [previewTrack, setPreviewTrack] = useState(null);
  // const [user, setUser] = useState(null); // Now from Context
  const [progress, setProgress] = useState(0);
  const [roomNotFound, setRoomNotFound] = useState(false);

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
            if (event.data === YouTubeState.PLAYING) {
              setAutoplayBlocked(false);
              const duration = event.target.getDuration();
              if (duration && duration > 0) {
                sendMessage({ type: "UPDATE_DURATION", payload: duration });
              }
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

  if (!serverState || isStaleState) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <h2 className="text-2xl font-bold mb-4">Switching Channels...</h2>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
      </div>
    </div>;
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


  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-32">
      <Header
        activeChannel={activeChannel}
        onGoHome={() => navigate("/")}
        onShowSuggest={setShowSuggest}
        user={user}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
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
      />

      <div className="relative z-10 px-6 py-4">
        {showSuggest && <SuggestSongForm onSongSuggested={handleSongSuggested} onShowSuggest={setShowSuggest} serverError={lastError} serverMessage={lastMessage} isOwner={isOwner && ownerBypass} suggestionsEnabled={suggestionsEnabled} suggestionMode={suggestionMode} />}
      </div>

      {isOwner && pendingSuggestions.length > 0 && ownerPopups && (
        <PendingRequests
          requests={pendingSuggestions}
          onApprove={handleApproveSuggestion}
          onReject={handleRejectSuggestion}
          onClose={() => handleUpdateSettings({ ownerPopups: false })}
        />
      )}

      {showPendingPage && (
        <PendingRequestsPage
          requests={pendingSuggestions}
          onApprove={handleApproveSuggestion}
          onReject={handleRejectSuggestion}
          onClose={() => setShowPendingPage(false)}
        />
      )}

      <div className={playlistViewMode && !isOwner
        ? "flex-1 w-full relative group transition-all duration-500 ease-in-out min-h-0"
        : "w-full relative group transition-all duration-500 ease-in-out flex-shrink-0 aspect-video max-h-[60vh]"
      }>
        <div className={`absolute inset - 0 border - 4 ${previewTrack ? "border-green-500" : "border-transparent"} transition - colors duration - 300 box - border pointer - events - none z - 20`}></div>
        {playlistViewMode && !isOwner ? (
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
            />
          </div>
        ) : (
          /* Standard Mode */
          <>
            {!showPendingPage && (
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
        {playlistViewMode && !isOwner ? null : ( // Hide queue if playlistViewMode is active and not owner
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
          />
        )}
      </div>

      {
        previewTrack ? (
          <div className="fixed bottom-0 left-0 w-full bg-green-900/95 backdrop-blur-md border-t border-green-700 px-6 py-3 flex items-center justify-between z-50 select-none">
            <div className="flex items-center gap-4">
              <button
                onClick={handleStopPreview}
                className="bg-white text-green-900 hover:bg-gray-100 transition-colors rounded-full p-3 shadow-lg flex items-center gap-2"
                title="Back to Radio"
              >
                <ArrowLeft size={24} />
                <span className="font-bold pr-2">Back to Radio</span>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base leading-tight">{previewTrack.title}</h3>
                  <span className="bg-green-500 text-black px-2 py-0.5 rounded text-xs font-bold animate-pulse">PREVIEW</span>
                </div>
                <p className="text-green-200 text-sm">{previewTrack.artist}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-green-200">
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
          !(playlistViewMode && !isOwner) && (
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
            />
          )
        )
      }
    </div >
  );
}
export default App;
