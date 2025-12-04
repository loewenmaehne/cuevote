import React, { useState, useCallback, useEffect, useRef } from "react";
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
  console.log("App render");

  // WebSocket connection
  const { state: serverState, sendMessage } = useWebSocket(WEBSOCKET_URL);

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
  const [votes, setVotes] = useState({});
  const [isMuted, setIsMuted] = useState(true);
  const [showSuggest, setShowSuggest] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [progress, setProgress] = useState(0);

  // YouTube Player state
  const playerRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const playerContainerRef = useCallback(node => {
    if (node !== null) {
      console.log("Player container is in the DOM");
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
      console.log("YouTube API loaded, creating player");
      playerRef.current = new YT.Player(container, {
        playerVars: {
          autoplay: 0,
          controls: 0,
          origin: 'http://localhost:5173',
        },
        events: {
          onReady: () => {
            console.log("Player is ready");
            setIsPlayerReady(true);
          },
          onStateChange: (event) => {
            console.log("Player state changed:", event.data);
            if (event.data === YouTubeState.PLAYING) {
              sendMessage({ type: "PLAY_PAUSE", payload: true });
            } else if (event.data === YouTubeState.PAUSED) {
              sendMessage({ type: "PLAY_PAUSE", payload: false });
            } else if (event.data === YouTubeState.ENDED) {
              sendMessage({ type: "NEXT_TRACK" });
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
    if (isPlayerReady && playerRef.current && currentTrack) {
      const currentVideoIdInPlayer = playerRef.current.getVideoData().video_id;
      if (currentTrack.videoId !== currentVideoIdInPlayer) {
        playerRef.current.loadVideoById(currentTrack.videoId, serverProgress);
      }
    } else if (isPlayerReady && playerRef.current && !currentTrack) {
      playerRef.current.stopVideo();
    }
  }, [isPlayerReady, currentTrack]);

  useEffect(() => {
    if (isPlayerReady && playerRef.current) {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlayerReady, isPlaying]);

  useEffect(() => {
    if (isPlayerReady && playerRef.current && isPlaying) {
      const localProgress = playerRef.current.getCurrentTime();
      if (Math.abs(localProgress - serverProgress) > 2) {
        playerRef.current.seekTo(serverProgress);
      }
    }
  }, [isPlayerReady, serverProgress]);
  
  // Autoplay detection
  useEffect(() => {
    if (isPlaying && isPlayerReady && playerRef.current) {
      const check = setTimeout(() => {
        if (playerRef.current.getPlayerState() !== YouTubeState.PLAYING) {
          setAutoplayBlocked(true);
        } else {
          setAutoplayBlocked(false);
        }
      }, 1500);
      return () => clearTimeout(check);
    }
  }, [isPlaying, isPlayerReady]);

  // Progress bar update
  useEffect(() => {
    if (playerRef.current && playerRef.current.getDuration) {
        const duration = playerRef.current.getDuration();
        if (duration > 0) {
            setProgress((serverProgress / duration) * 100);
        } else {
            setProgress(0);
        }
    }
  }, [serverProgress]);

  // Event Handlers
  const handlePlayPause = () => {
    if (isPlaying) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  };

  const handleMuteToggle = () => {
    if (isMuted) playerRef.current.unMute();
    else playerRef.current.mute();
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    playerRef.current.setVolume(newVolume);
  };

  const handleSongSuggested = (newTrack) => {
    sendMessage({ type: "SUGGEST_SONG", payload: newTrack });
  };
  
  if (!serverState) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Connecting to server...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-24">
      <Header
        activeChannel={activeChannel}
        onChannelChange={() => {}}
        showChannels={showChannels}
        onShowChannels={setShowChannels}
        channels={CHANNEL_TAGS}
        onJoinChannel={() => alert("Joined channel")}
        onShowSuggest={setShowSuggest}
      />
      {showSuggest && <SuggestSongForm onSongSuggested={handleSongSuggested} onShowSuggest={setShowSuggest} />}
      
      <div className={`w-full aspect-video bg-black ${isMinimized ? "h-[100vh]" : "aspect-video"}`}>
        <div style={{ display: currentTrack ? 'block' : 'none', width: '100%', height: '100%' }}>
            <Player playerContainerRef={playerContainerRef} />
        </div>
        {!currentTrack && <div className="flex h-full w-full items-center justify-center text-neutral-500">Queue empty</div>}
        {autoplayBlocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
                <p>Autoplay blocked</p>
                <button onClick={handlePlayPause}>Tap to play</button>
            </div>
        )}
      </div>

      <Queue
        tracks={queue}
        currentTrack={currentTrack}
        expandedTrackId={expandedTrackId}
        votes={votes}
        onVote={(trackId, type) => setVotes(prev => ({...prev, [trackId]: prev[trackId] === type ? null : type}))}
        onToggleExpand={(trackId) => setExpandedTrackId(prev => prev === trackId ? null : trackId)}
        isMinimized={isMinimized}
      />
      <PlaybackControls
        isPlaying={isPlaying}
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
    </div>
  );
}

export default App;
