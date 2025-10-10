import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle,
  Pause,
  Play,
  Radio,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from "lucide-react";

const DEMO_TRACKS = [
  {
    id: 1,
    title: "Dreamwave Nights",
    artist: "HOME",
    videoId: "8GW6sLrK40k",
    lyrics: "Floating through the neon night, lost in endless sound and light...",
    thumbnail: null,
    metaLoaded: false,
  },
  {
    id: 2,
    title: "Neon Skyline",
    artist: "The Midnight",
    videoId: "iwc9u1F7LlA",
    lyrics: "Under glowing towers, we find our way through fading hours...",
    thumbnail: null,
    metaLoaded: false,
  },
  {
    id: 3,
    title: "Midnight Motion",
    artist: "Timecop1983",
    videoId: "dwmw2NHbhJk",
    lyrics: "Every beat a memory, pulsing in perpetual harmony...",
    thumbnail: null,
    metaLoaded: false,
  },
];

const CHANNEL_TAGS = ["Synthwave", "Chillhop", "Lo-fi", "Indie", "Funk", "Jazz Fusion"];

const buildEmbedUrl = (videoId) => `https://www.youtube.com/embed/${videoId}`;
const buildWatchUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;
const buildThumbnailUrl = (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

const YouTubeState = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
};

const parseYouTubeId = (input) => {
  if (!input) return null;
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") {
      return url.pathname.replace("/", "") || null;
    }
    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v") || null;
    }
  } catch {
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
};

const fetchVideoMetadata = async (videoId) => {
  const endpoint = `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(endpoint, { mode: "cors" });
  if (!response.ok) {
    const error = new Error(`YouTube video ${videoId} unavailable`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  return {
    title: data.title,
    artist: data.author_name,
    thumbnail: data.thumbnail_url,
    metaLoaded: true,
  };
};

const loadYouTubeAPI = (() => {
  let promise;
  return () => {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("YouTube API requires a browser environment"));
    }
    if (window.YT && window.YT.Player) {
      return Promise.resolve(window.YT);
    }
    if (promise) return promise;

    promise = new Promise((resolve) => {
      const scriptId = "youtube-iframe-api";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://www.youtube.com/iframe_api";
        const firstScript = document.getElementsByTagName("script")[0];
        firstScript?.parentNode?.insertBefore(script, firstScript);
      }

      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
    });

    return promise;
  };
})();

function RevibePlaylistView() {
  const [queue, setQueue] = useState(DEMO_TRACKS);
  const [expandedTrackId, setExpandedTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [votes, setVotes] = useState({});
  const [isMuted, setIsMuted] = useState(true);
  const [showSuggest, setShowSuggest] = useState(false);
  const [songSuggestion, setSongSuggestion] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [activeChannel, setActiveChannel] = useState("Synthwave");
  const [showChannels, setShowChannels] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [volume, setVolume] = useState(80);
  const [suggestionError, setSuggestionError] = useState("");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const tracks = useMemo(() => queue, [queue]);
  const currentTrack = tracks[0] ?? null;

  const headerRef = useRef(null);
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const progressTimerRef = useRef(null);

  const handlePlayerStateChangeRef = useRef(null);
  const handlePlayerReadyRef = useRef(null);
  const handlePlayerErrorRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const updateMissingMetadata = async () => {
      const pending = queue.filter((track) => !track.metaLoaded);
      if (!pending.length) return;
      const results = await Promise.all(
        pending.map(async (track) => {
          try {
            const meta = await fetchVideoMetadata(track.videoId);
            return { videoId: track.videoId, meta };
          } catch (error) {
            return {
              videoId: track.videoId,
              error: {
                status: error?.status,
                message: error?.message || "Video unavailable",
              },
            };
          }
        }),
      );
      if (cancelled) return;
      const resultMap = new Map(results.map((entry) => [entry.videoId, entry]));
      setQueue((prev) => {
        let changed = false;
        const next = [];
        for (const track of prev) {
          const update = resultMap.get(track.videoId);
          if (!update) {
            next.push(track);
            continue;
          }
          if (update.error) {
            if (update.error.status === 404 || update.error.status === 410) {
              changed = true;
              continue;
            }
            next.push(track);
            continue;
          }
          const enhanced = {
            ...track,
            title: update.meta.title ?? track.title,
            artist: update.meta.artist ?? track.artist,
            thumbnail: update.meta.thumbnail ?? track.thumbnail,
            metaLoaded: true,
          };
          if (
            enhanced.title !== track.title ||
            enhanced.artist !== track.artist ||
            enhanced.thumbnail !== track.thumbnail ||
            !track.metaLoaded
          ) {
            changed = true;
          }
          next.push(enhanced);
        }
        return changed ? next : prev;
      });
    };
    updateMissingMetadata();
    return () => {
      cancelled = true;
    };
  }, [queue]);

  useEffect(() => {
    document.body.style.overflow = isMinimized ? "hidden" : "auto";
  }, [isMinimized]);

  useEffect(() => {
    setProgress(0);
  }, [currentTrack?.id]);

  const toggleVote = useCallback((trackId, type) => {
    setVotes((prev) => {
      const current = prev[trackId];
      if (current === type) return { ...prev, [trackId]: null };
      return { ...prev, [trackId]: type };
    });
  }, []);

  const cycleQueue = useCallback(() => {
    setExpandedTrackId(null);
    setQueue((prev) => {
      if (prev.length <= 1) return prev;
      const [first, ...rest] = prev;
      return [...rest, first];
    });
  }, []);

  const toggleExpand = useCallback((trackId) => {
    setExpandedTrackId((prev) => (prev === trackId ? null : trackId));
  }, []);

  const handleSubmitSuggestion = useCallback(async () => {
    const input = songSuggestion.trim();
    if (!input) {
      setSuggestionError("Paste a full YouTube link before submitting.");
      return;
    }
    const videoId = parseYouTubeId(input);
    if (!videoId) {
      setSuggestionError("That doesn't look like a valid YouTube URL.");
      return;
    }
    setSuggestionError("");
    setIsSubmittingSuggestion(true);
    try {
      const meta = await fetchVideoMetadata(videoId);
      setQueue((prev) => [
        ...prev,
        {
          id: crypto.randomUUID ? crypto.randomUUID() : `suggest-${Date.now()}`,
          videoId,
          title: meta.title,
          artist: meta.artist,
          thumbnail: meta.thumbnail,
          lyrics: "",
          metaLoaded: true,
        },
      ]);
      setSubmissionSuccess(true);
      setSongSuggestion("");
      setTimeout(() => {
        setSubmissionSuccess(false);
        setShowSuggest(false);
      }, 2000);
    } catch (error) {
      setSuggestionError("Unable to load that video. Please try a different link.");
    } finally {
      setIsSubmittingSuggestion(false);
    }
  }, [songSuggestion]);

  const handleKeyPress = useCallback(
    (event) => {
      if (event.key === "Enter") {
        handleSubmitSuggestion();
      }
    },
    [handleSubmitSuggestion],
  );

  const handleJoinChannel = useCallback(() => {
    alert("✨ You’ve magically joined the channel! ✨");
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!headerRef.current) return;
      if (headerRef.current.contains(event.target)) return;
      if (event.target.closest(".keep-open")) return;
      setShowChannels(false);
      setShowSuggest(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateProgressMeter = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const duration = player.getDuration?.() ?? 0;
    if (duration <= 0) return;
    const current = player.getCurrentTime?.() ?? 0;
    setProgress(Math.min(100, (current / duration) * 100));
  }, []);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const ensureProgressTimer = useCallback(() => {
    if (progressTimerRef.current || !playerRef.current) return;
    progressTimerRef.current = setInterval(updateProgressMeter, 500);
  }, [updateProgressMeter]);

  const handlePlayerStateChange = useCallback(
    (event) => {
      const { data, target } = event;
      if (data === YouTubeState.PLAYING) {
        setIsPlaying(true);
        ensureProgressTimer();
        const duration = target.getDuration?.() ?? 0;
        if (duration > 0) {
          const current = target.getCurrentTime?.() ?? 0;
          setProgress(Math.min(100, (current / duration) * 100));
        }
        setAutoplayBlocked(false);
        return;
      }

      if (data === YouTubeState.PAUSED) {
        setIsPlaying(false);
        clearProgressTimer();
        updateProgressMeter();
        return;
      }

      if (data === YouTubeState.ENDED) {
        updateProgressMeter();
        clearProgressTimer();
        cycleQueue();
        setTimeout(() => {
          if (!playerRef.current) return;
          setIsPlaying(true);
          playerRef.current.playVideo?.();
        }, 250);
        setAutoplayBlocked(false);
      }
    },
    [clearProgressTimer, cycleQueue, ensureProgressTimer, updateProgressMeter],
  );

  const handlePlayerReady = useCallback(
    (event) => {
      const player = event.target;
      playerRef.current = player;
      setPlayerReady(true);
      player.setVolume(volume);
      if (isMuted) {
        player.mute();
      }
      if (currentTrack) {
        if (isPlaying) {
          player.loadVideoById({ videoId: currentTrack.videoId, startSeconds: 0 });
        } else {
          player.cueVideoById({ videoId: currentTrack.videoId, startSeconds: 0 });
        }
      }
    },
    [currentTrack, isMuted, isPlaying, volume],
  );

  const handlePlayerError = useCallback(() => {
    clearProgressTimer();
    setQueue((prev) => {
      if (prev.length <= 1) {
        setIsPlaying(false);
        return [];
      }
      setIsPlaying(true);
      return prev.slice(1);
    });
    setAutoplayBlocked(false);
  }, [clearProgressTimer]);

  handlePlayerStateChangeRef.current = handlePlayerStateChange;
  handlePlayerReadyRef.current = handlePlayerReady;
  handlePlayerErrorRef.current = handlePlayerError;

  useEffect(() => {
    let isMounted = true;

    loadYouTubeAPI()
      .then((YT) => {
        if (!isMounted || !playerContainerRef.current) return;
        playerRef.current = new YT.Player(playerContainerRef.current, {
          videoId: currentTrack?.videoId ?? "",
          playerVars: {
            autoplay: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            controls: 1,
          },
          events: {
            onReady: (event) => handlePlayerReadyRef.current?.(event),
            onStateChange: (event) => handlePlayerStateChangeRef.current?.(event),
            onError: (event) => handlePlayerErrorRef.current?.(event),
          },
        });
      })
      .catch((error) => {
        console.error("YouTube API failed to load", error);
      });

    return () => {
      isMounted = false;
      clearProgressTimer();
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [clearProgressTimer]);

  useEffect(() => {
    if (!playerReady || !playerRef.current) return;
    if (!currentTrack) {
      playerRef.current.stopVideo?.();
      clearProgressTimer();
      setIsPlaying(false);
      return;
    }
    setProgress(0);
    if (isPlaying) {
      playerRef.current.loadVideoById?.({ videoId: currentTrack.videoId, startSeconds: 0 });
      ensureProgressTimer();
    } else {
      playerRef.current.cueVideoById?.({ videoId: currentTrack.videoId, startSeconds: 0 });
      clearProgressTimer();
    }
    setAutoplayBlocked(false);
  }, [clearProgressTimer, ensureProgressTimer, currentTrack?.videoId, isPlaying, playerReady]);

  useEffect(() => {
    if (!isPlaying) return;
    const player = playerRef.current;
    if (!player) return;
    const check = setTimeout(() => {
      const state = player.getPlayerState?.();
      if (state !== YouTubeState.PLAYING) {
        setAutoplayBlocked(true);
        setIsPlaying(false);
      }
    }, 1200);
    return () => clearTimeout(check);
  }, [isPlaying]);

  useEffect(() => {
    if (!playerReady || !playerRef.current) return;
    if (isMuted) {
      playerRef.current.mute?.();
    } else {
      playerRef.current.unMute?.();
      playerRef.current.setVolume?.(volume);
    }
  }, [isMuted, playerReady, volume]);

  useEffect(() => {
    if (!playerReady || !playerRef.current) return;
    if (isPlaying) {
      playerRef.current.playVideo?.();
      ensureProgressTimer();
    } else {
      playerRef.current.pauseVideo?.();
      clearProgressTimer();
    }
  }, [clearProgressTimer, ensureProgressTimer, isPlaying, playerReady]);

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      setIsMuted((prev) => !prev);
      return;
    }

    if (isMuted) {
      player.unMute?.();
      player.setVolume?.(volume);
      setIsMuted(false);
      setAutoplayBlocked(false);
    } else {
      player.mute?.();
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const handleVolumeChange = useCallback(
    (event) => {
      const nextVolume = Number(event.target.value);
      setVolume(nextVolume);
      const player = playerRef.current;
      if (player) {
        player.setVolume?.(nextVolume);
        if (isMuted && nextVolume > 0) {
          player.unMute?.();
          setIsMuted(false);
          setAutoplayBlocked(false);
        }
      }
    },
    [isMuted],
  );

  const handleMasterPlayToggle = useCallback(() => {
    if (!currentTrack) return;

    const player = playerRef.current;
    if (!player || !playerReady) {
      setIsPlaying((prev) => !prev);
      setAutoplayBlocked(false);
      return;
    }

    if (isPlaying) {
      player.pauseVideo?.();
      setIsPlaying(false);
      setAutoplayBlocked(false);
    } else {
      try {
        player.playVideo?.();
        setIsPlaying(true);
        setTimeout(() => {
          if (!playerRef.current) return;
          const state = playerRef.current.getPlayerState?.();
          if (state !== YouTubeState.PLAYING) {
            setAutoplayBlocked(true);
            setIsPlaying(false);
          }
        }, 800);
      } catch {
        setAutoplayBlocked(true);
        setIsPlaying(false);
      }
    }
  }, [currentTrack, isPlaying, playerReady]);

  const handleResumeAutoplay = useCallback(() => {
    const player = playerRef.current;
    if (!player || !playerReady) return;
    try {
      player.playVideo?.();
      setIsPlaying(true);
      setAutoplayBlocked(false);
    } catch {
      setIsPlaying(false);
    }
  }, [playerReady]);

  const channels = CHANNEL_TAGS;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-24 transition-colors duration-700 ease-in-out overflow-hidden">
      <header
        ref={headerRef}
        className={`p-4 border-b border-neutral-900 bg-[#050505]/95 backdrop-blur-md z-40 transition-all duration-700 ease-in-out flex flex-col items-center gap-3 ${
          isMinimized
            ? "opacity-0 -translate-y-full absolute top-0 left-0 w-full"
            : "opacity-100 translate-y-0 relative"
        }`}
      >
        <div className="flex items-center justify-between w-full max-w-5xl relative">
          <button
            onClick={(event) => {
              event.stopPropagation();
              setShowChannels((prev) => !prev);
              setShowSuggest(false);
            }}
            className="keep-open flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors absolute left-0"
          >
            <Radio size={22} /> {activeChannel}
          </button>

          <h1 className="text-2xl font-bold text-orange-500 tracking-tight mx-auto">
            ReVibe Music
          </h1>

          <button
            onClick={(event) => {
              event.stopPropagation();
              setShowSuggest((prev) => !prev);
              setShowChannels(false);
            }}
            className="keep-open flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors absolute right-0"
          >
            <Send size={18} /> Suggest Song
          </button>
        </div>

        {showChannels && (
          <div className="keep-open flex flex-wrap justify-center gap-3 mt-3 animate-fadeIn">
            {channels.map((channel) => (
              <button
                key={channel}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveChannel(channel);
                }}
                className={`keep-open px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  activeChannel === channel
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                {channel}
              </button>
            ))}
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleJoinChannel();
              }}
              className="keep-open flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:from-orange-400 hover:to-orange-500 transition-all shadow-md"
            >
              <Sparkles size={16} /> Join Channel
            </button>
          </div>
        )}

        {showSuggest && !submissionSuccess && (
          <div className="keep-open w-full max-w-5xl mt-3 animate-fadeIn space-y-2">
            <div className="keep-open flex items-center gap-2">
              <input
                type="text"
                value={songSuggestion}
                onChange={(event) => setSongSuggestion(event.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Paste a full YouTube link..."
                disabled={isSubmittingSuggestion}
                className="keep-open flex-1 px-5 py-2 rounded-full bg-[#121212] text-white border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base disabled:opacity-60"
              />
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleSubmitSuggestion();
                }}
                disabled={isSubmittingSuggestion}
                className="keep-open px-5 py-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-400 hover:to-orange-500 transition-all flex items-center gap-2 text-base disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Send size={18} /> {isSubmittingSuggestion ? "Adding..." : "Submit"}
              </button>
            </div>
            {suggestionError && (
              <p className="keep-open text-sm text-red-400">{suggestionError}</p>
            )}
          </div>
        )}

        {submissionSuccess && (
          <div className="flex items-center justify-center gap-3 text-green-400 text-lg font-semibold mt-3 animate-fadeOut">
            <CheckCircle size={24} /> Suggestion submitted!
          </div>
        )}
      </header>

      <div
        className={`w-full transition-all duration-700 ease-in-out flex items-center justify-center border-b border-neutral-800 bg-black overflow-hidden ${
          isMinimized ? "h-[100vh]" : "aspect-video"
        }`}
      >
        {currentTrack ? (
          <div className="relative h-full w-full">
            <div ref={playerContainerRef} className="h-full w-full" />
            {autoplayBlocked && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm">
                <p className="text-sm text-neutral-300">Safari blocks autoplay until you interact.</p>
                <button
                  onClick={handleResumeAutoplay}
                  className="px-6 py-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-lg hover:from-orange-400 hover:to-orange-500"
                >
                  Tap to start playback
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-500">
            Queue empty
          </div>
        )}
      </div>

      <div
        className={`transition-all duration-700 ease-in-out flex-shrink-0 ${
          isMinimized
            ? "max-h-0 opacity-0 translate-y-10"
            : "flex-1 overflow-y-auto p-6 space-y-4 opacity-100 translate-y-0"
        }`}
        style={{
          maskImage: isMinimized
            ? "none"
            : "linear-gradient(to bottom, white 80%, transparent 100%)",
        }}
      >
        {tracks.map((track, index) => {
          const isActive = index === 0;
          const isExpanded = expandedTrackId === track.id;

          return (
            <div
              key={track.id}
              onClick={() => toggleExpand(track.id)}
              className={`transition-all duration-500 ease-in-out p-4 rounded-3xl shadow-lg backdrop-blur-sm cursor-pointer overflow-hidden ${
                votes[track.id] === "up"
                  ? "bg-gradient-to-br from-orange-500/70 to-orange-600/60 shadow-[0_0_15px_#fb923c]/60"
                  : "bg-[#1e1e1e]/80 hover:bg-[#222]"
              } ${isExpanded ? "scale-[1.02] ring-2 ring-orange-500/60" : ""}`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <img
                    src={track.thumbnail ?? buildThumbnailUrl(track.videoId)}
                    alt={track.title}
                    className="w-16 h-16 rounded-3xl object-cover shadow-md"
                    loading="lazy"
                  />
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {track.title}
                    </h3>
                    <p className="text-sm text-neutral-400">
                      {track.artist}
                      {isActive ? " • Playing" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleVote(track.id, "up");
                    }}
                    className={`transition-transform duration-300 ease-out drop-shadow-md transform relative rounded-full p-1.5 ${
                      votes[track.id] === "up"
                        ? "scale-125 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg"
                        : "text-orange-400 hover:scale-125 hover:bg-orange-500/20"
                    }`}
                  >
                    <ThumbsUp size={20} />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleVote(track.id, "down");
                    }}
                    className={`transition-transform duration-300 ease-out transform relative rounded-full p-1.5 ${
                      votes[track.id] === "down"
                        ? "scale-125 bg-gradient-to-br from-neutral-600 to-neutral-800 text-white shadow-lg"
                        : "text-neutral-500 hover:scale-125 hover:bg-neutral-700/20"
                    }`}
                  >
                    <ThumbsDown size={20} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 bg-[#1a1a1a] rounded-2xl border border-neutral-800 text-neutral-300 mt-4 space-y-3">
                  <div className="aspect-video overflow-hidden rounded-xl">
                    <iframe
                      className="w-full h-full rounded-xl"
                      src={`${buildEmbedUrl(track.videoId)}?autoplay=0&modestbranding=1&rel=0`}
                      title={track.title}
                      loading="lazy"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                  <p className="text-sm italic break-words overflow-hidden text-ellipsis">
                    {track.lyrics}
                  </p>
                  <a
                    href={buildWatchUrl(track.videoId)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-2 text-orange-400 text-sm hover:text-orange-300 transition-colors"
                  >
                    Watch on YouTube
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer
        onClick={(event) => {
          if (event.target.closest("button") || event.target.closest("input")) {
            return;
          }
          setIsMinimized((prev) => !prev);
        }}
        className="fixed bottom-0 left-0 w-full bg-[#050505]/95 backdrop-blur-md border-t border-neutral-900 px-6 py-3 flex flex-col gap-2 z-50 cursor-pointer select-none"
      >
        <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 bg-gradient-to-r from-orange-400 to-orange-600 transition-all"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleMasterPlayToggle();
              }}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-full p-3 transition-all shadow-lg"
              disabled={!currentTrack}
            >
              {isPlaying ? <Pause /> : <Play />}
            </button>
            <div>
              <h3 className="text-base font-semibold leading-tight">
                {currentTrack ? `Now Playing · ${currentTrack.title}` : "Queue Empty"}
              </h3>
              <p className="text-sm text-neutral-400">
                {currentTrack
                  ? `${currentTrack.artist} • ${activeChannel} Channel`
                  : "Add songs to start playback"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-neutral-400">
            <button
              onClick={(event) => {
                event.stopPropagation();
                toggleMute();
              }}
              className="hover:text-orange-400 transition-colors"
              disabled={!currentTrack}
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
              className={`accent-orange-500 w-24 ${isMuted ? "opacity-50" : ""}`}
              onClick={(event) => event.stopPropagation()}
              disabled={!currentTrack}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}

export default RevibePlaylistView;
