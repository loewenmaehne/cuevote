import { useState, useEffect, useRef, useCallback } from "react";

const YouTubeState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
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

    promise = new Promise((resolve, reject) => {
      const scriptId = "youtube-iframe-api";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://www.youtube.com/iframe_api";
        script.onerror = () => reject(new Error("YouTube API script failed to load"));
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

export function useYouTubePlayer(playerContainer, options = {}) {
  const [player, setPlayer] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [state, setState] = useState(YouTubeState.UNSTARTED);
  const [error, setError] = useState(null);

  const { onStateChange, onReady, onError } = options;

  const onStateChangeRef = useRef(onStateChange);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!playerContainer) return;
    let isMounted = true;
    let playerInstance = null;

    loadYouTubeAPI()
      .then((YT) => {
        if (!isMounted) {
          return;
        }

        try {
          playerInstance = new YT.Player(playerContainer, {
            playerVars: {
              autoplay: 0,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              controls: 0,
              origin: 'http://localhost:5173',
              ...options.playerVars,
            },
            events: {
              onReady: (event) => {
                setIsReady(true);
                setPlayer(event.target);
                onReadyRef.current?.(event);
              },
              onStateChange: (event) => {
                setState(event.data);
                onStateChangeRef.current?.(event);
              },
              onError: (event) => {
                setError(event.data);
                onErrorRef.current?.(event);
              },
            },
          });
        } catch (error) {
          if (isMounted) {
            setError(error);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err);
        }
      });

    return () => {
      isMounted = false;
      if (playerInstance) {
        playerInstance.destroy();
      }
    };
  }, [playerContainer]);

  const controls = {
    loadVideoById: useCallback(
      (videoId, startSeconds = 0) => {
        if (isReady && player) {
          player.loadVideoById({ videoId, startSeconds });
        }
      },
      [isReady, player],
    ),
    cueVideoById: useCallback(
      (videoId, startSeconds = 0) => {
        if (isReady && player) {
          player.cueVideoById({ videoId, startSeconds });
        }
      },
      [isReady, player],
    ),
    play: useCallback(() => {
      if (isReady && player) {
        player.playVideo();
      }
    }, [isReady, player]),
    pause: useCallback(() => {
      if (isReady && player) {
        player.pauseVideo();
      }
    }, [isReady, player]),
    stop: useCallback(() => {
      if (isReady && player) {
        player.stopVideo();
      }
    }, [isReady, player]),
    seekTo: useCallback(
      (seconds) => {
        if (isReady && player) {
          player.seekTo(seconds, true);
        }
      },
      [isReady, player],
    ),
    setVolume: useCallback(
      (volume) => {
        if (isReady && player) {
          player.setVolume(volume);
        }
      },
      [isReady, player],
    ),
    mute: useCallback(() => {
      if (isReady && player) {
        player.mute();
      }
    }, [isReady, player]),
    unMute: useCallback(() => {
      if (isReady && player) {
        player.unMute();
      }
    }, [isReady, player]),
    getDuration: useCallback(() => {
      if (isReady && player) {
        return player.getDuration();
      }
      return 0;
    }, [isReady, player]),
    getCurrentTime: useCallback(() => {
      if (isReady && player) {
        return player.getCurrentTime();
      }
      return 0;
    }, [isReady, player]),
  };

  return {
    player,
    isReady,
    state,
    error,
    controls,
    YouTubeState,
  };
}
