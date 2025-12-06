import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Volume2, VolumeX, ArrowLeft } from "lucide-react";
import { Header } from "./components/Header";
import { SuggestSongForm } from "./components/SuggestSongForm";
import { Player } from "./components/Player";
import { Queue } from "./components/Queue";
import { PlaybackControls } from "./components/PlaybackControls";
import { useWebSocket } from "./hooks/useWebSocket";

const CHANNEL_TAGS = ["Synthwave", "Chillhop", "Lo-fi", "Indie", "Funk", "Jazz Fusion"];
const WEBSOCKET_URL = "ws://localhost:8080";

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

  // WebSocket connection
  const { state: serverState, sendMessage, lastError, clientId, lastMessage, isConnected } = useWebSocket(WEBSOCKET_URL);

  // Join Room on Connect or Room Change
  useEffect(() => {
      if (isConnected) {
          console.log(`Joining room: ${activeRoomId}`);
          sendMessage({ type: "JOIN_ROOM", payload: { roomId: activeRoomId } });
      }
  }, [isConnected, activeRoomId, sendMessage]);

  // Destructure server state
  const {
    queue = [],
    currentTrack = null,
    isPlaying = false,
    progress: serverProgress = 0,
    activeChannel = "Synthwave", 
  } = serverState || {};

  // Local UI state
  const [expandedTrackId, setExpandedTrackId] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showSuggest, setShowSuggest] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isLocallyPaused, setIsLocallyPaused] = useState(false);
  const [previewTrack, setPreviewTrack] = useState(null);
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState(0);

  // Auth: Resume Session on Connect
  useEffect(() => {
    const token = localStorage.getItem("revibe_auth_token");
    if (serverState && token && !user) {
        console.log("Resuming session...");
        sendMessage({ type: "RESUME_SESSION", payload: { token } });
    }
  }, [serverState, sendMessage, user]);

  // Auth: Handle Login Events
  useEffect(() => {
    if (lastMessage) {
        if (lastMessage.type === "LOGIN_SUCCESS") {
            console.log("Backend Login Success:", lastMessage.payload.user);
            setUser(lastMessage.payload.user);
            if (lastMessage.payload.sessionToken) {
                localStorage.setItem("revibe_auth_token", lastMessage.payload.sessionToken);
            }
        } else if (lastMessage.type === "SESSION_INVALID") {
            console.warn("Session Invalid/Expired");
            localStorage.removeItem("revibe_auth_token");
            setUser(null);
        }
    }
  }, [lastMessage]);

  // YouTube Player state
  const playerRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const playerContainerRef = useCallback(node => {
    if (node !== null) {
      initializePlayer(node);
    }
  }, []);

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
    loadYouTubeAPI().then((YT) => {
      playerRef.current = new YT.Player(container, {
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 0,
          controls: 0,
          origin: 'http://localhost:5173',
        },
        events: {
          onReady: (event) => {
            setIsPlayerReady(true);
            event.target.setVolume(volume);
            if (isMuted) {
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

  const handleStopPreview = () => {
    setPreviewTrack(null);
    setIsLocallyPaused(false);
    playerRef.current?.seekTo?.(serverProgress);
  };

  const handleLoginSuccess = (tokenResponse) => {
    console.log("Sending Access Token to Backend...", tokenResponse);
    sendMessage({ type: "LOGIN", payload: { token: tokenResponse.access_token } });
  };

  const handleLogout = () => {
    const token = localStorage.getItem("revibe_auth_token");
    if (token) {
        sendMessage({ type: "LOGOUT", payload: { token } });
        localStorage.removeItem("revibe_auth_token");
    }
    setUser(null);
  };
  
  if (!serverState) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Connecting to server...</div>;
  }

  // Compute user's votes from the queue data
  const userVotes = {};
  if (clientId) {
    queue.forEach(track => {
        if (track.voters && track.voters[clientId]) {
            userVotes[track.id] = track.voters[clientId];
        }
    });
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-32">
      <Header
        activeChannel={activeChannel}
        onChannelChange={() => {}}
        showChannels={showChannels}
        onShowChannels={() => { navigate("/"); }}
        channels={[]}
        onJoinChannel={() => {}}
        onShowSuggest={setShowSuggest}
        user={user}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />

      <div className="relative z-10 px-6 py-4">
        {showSuggest && <SuggestSongForm onSongSuggested={handleSongSuggested} onShowSuggest={setShowSuggest} serverError={lastError} />}
      </div>
      
      <div className={`w-full relative group transition-all duration-500 ease-in-out ${isMinimized ? "h-0 opacity-0" : "flex-shrink-0 aspect-video max-h-[60vh]"}`}>
        <div className={`absolute inset-0 border-4 ${previewTrack ? "border-green-500" : "border-transparent"} transition-colors duration-300 box-border pointer-events-none z-20`}></div>
        <div className="absolute inset-0">
           <div style={{ display: (currentTrack || previewTrack) ? 'block' : 'none', width: '100%', height: '100%' }}>
                <Player playerContainerRef={playerContainerRef} />
            </div>
            {!(currentTrack || previewTrack) && <div className="flex h-full w-full items-center justify-center text-neutral-500 bg-neutral-900">Queue empty</div>}
        </div>

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
      </div>

      <div className="pb-4">
        <Queue
            tracks={queue}
            currentTrack={currentTrack}
            expandedTrackId={expandedTrackId}
            votes={userVotes}
            onVote={handleVote}
            onToggleExpand={(trackId) => setExpandedTrackId(prev => prev === trackId ? null : trackId)}
            isMinimized={isMinimized}
            onPreview={handlePreviewTrack}
        />
      </div>

      {previewTrack ? (
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
                        className={`accent-green-500 w-24 ${isMuted ? "opacity-50" : ""}`}
                        onClick={(event) => event.stopPropagation()}
                    />
            </div>
        </div>
      ) : (
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
            onMinimizeToggle={() => setIsMinimized(!isMinimized)}
        />
      )}
    </div>
  );
}

export default App;
