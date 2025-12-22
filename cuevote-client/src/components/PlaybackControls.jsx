import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import PropTypes from "prop-types";
import { Pause, Play, Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-react";
import { isMobile } from '../utils/deviceDetection';
import { useLanguage } from '../contexts/LanguageContext';

export function PlaybackControls({
  isPlaying,
  onPlayPause,
  progress,
  currentTrack,
  activeChannel,
  isMuted,
  onMuteToggle,
  volume,
  onVolumeChange,
  isCinemaMode = false,
  onToggleCinemaMode,
  onVisibilityChange,
  isOwner = false,
  onSeek,
  onHeightChange,
  canShowControls = true,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [tempVisible, setTempVisible] = useState(false);
  const hideTimeoutRef = useRef(null);
  const progressBarRef = useRef(null);
  const overlayRef = useRef(null);
  const isHoveredRef = useRef(false);
  const { t } = useLanguage();

  // Function to show controls temporarily (e.g. on song start or mouse leave)
  const activateTemporaryVisibility = () => {
    if (isHoveredRef.current) return; // Don't hide if hovered (checked via Ref for sync access)
    // console.log("[PlaybackControls] Activating temporary visibility. Starting 3s timer.");
    setTempVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      // console.log("[PlaybackControls] Timer expired. Setting tempVisible = false");
      setTempVisible(false);
    }, 3000);
  };

  // Show temporarily when track changes
  useEffect(() => {
    if (currentTrack) {
      // console.log("[PlaybackControls] Track changed, activating visibility.");
      activateTemporaryVisibility();
    }
  }, [currentTrack?.id]);

  // Clean up timeout
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (isMobile()) return; // Disable hover logic on mobile
    // if (!isHovered) console.log("[PlaybackControls] Mouse Enter");
    setIsHovered(true);
    isHoveredRef.current = true;
    setTempVisible(true); // Keep it visible without timeout while hovered
    if (hideTimeoutRef.current) {
      // console.log("[PlaybackControls] Clearing timer due to hover");
      clearTimeout(hideTimeoutRef.current);
    }
  };

  const handleMouseLeave = () => {
    if (isMobile()) return; // Disable hover logic on mobile
    // console.log("[PlaybackControls] Mouse Leave");
    setIsHovered(false);
    isHoveredRef.current = false;
    activateTemporaryVisibility(); // Start timeout once mouse leaves
  };

  const handleTouchInteraction = () => {
    // On mobile, explicit touch resets the timer to keep controls visible
    activateTemporaryVisibility();
  };



  // Calculate visibility before using it in effects
  const shouldShow = (!isCinemaMode || isHovered || tempVisible) && canShowControls;

  // Notify parent of visibility changes
  useEffect(() => {
    if (onVisibilityChange) {
      onVisibilityChange(shouldShow);
    }
  }, [shouldShow, onVisibilityChange]);

  // Handle window blur (e.g. clicking into iframe) as a "leave" event
  useEffect(() => {
    const handleWindowBlur = () => {
      // console.log(`[PlaybackControls] Window Blur. isHovered=${isHovered}`);
      if (isHovered) {
        handleMouseLeave();
      }
    };
    window.addEventListener("blur", handleWindowBlur);
    return () => window.removeEventListener("blur", handleWindowBlur);
  }, [isHovered]);

  const handleSeekClick = (e) => {
    if (!isOwner || !onSeek) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(100, (x / width) * 100));
    onSeek(percentage);
  };

  // Dragging support could be added here with mouse move logic, 
  // but click-to-seek is often sufficient and cleaner for this context. 
  // Adding simple drag support:
  const handleMouseMove = (e) => {
    if (e.buttons === 1) { // Left Button Pressed
      handleSeekClick(e);
    }
  }


  const footerRef = useRef(null);

  // Measure Footer Height for App Layout
  useLayoutEffect(() => {
    if (!footerRef.current) return;

    const updateHeight = () => {
      if (footerRef.current && onHeightChange) {
        onHeightChange(footerRef.current.offsetHeight);
      }
    };

    // Initial measure
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(footerRef.current);

    return () => observer.disconnect();
  }, [onHeightChange, shouldShow]); // Re-run if visibility changes to ensure 0 or full height is reported

  return (
    <>


      {isCinemaMode && (
        <div
          ref={overlayRef}
          className="fixed bottom-0 left-0 w-full h-2 z-[60] bg-transparent"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchInteraction}
        />
      )}
      <footer
        ref={footerRef}
        className={`fixed bottom-0 left-0 w-full bg-[#050505]/95 backdrop-blur-md border-t border-neutral-900 px-6 py-3 flex flex-col gap-2 z-[70] select-none transition-transform duration-500 ease-in-out ${shouldShow ? 'translate-y-0' : 'translate-y-full'}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchInteraction}
      >
        {/* Progress Bar */}
        <div
          ref={progressBarRef}
          className={`w-full bg-neutral-900 rounded-full h-2 overflow-hidden relative ${isOwner ? 'cursor-pointer group' : ''}`}
          onClick={handleSeekClick}
          onMouseMove={isOwner ? handleMouseMove : undefined}
        >
          <div
            className="h-2 bg-gradient-to-r from-orange-400 to-orange-600 transition-all relative"
            style={{ width: `${progress}%` }}
          >
            {/* Handle for owners */}
            {isOwner && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-sm transition-opacity" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onPlayPause();
              }}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-full p-3 transition-all shadow-lg"
              disabled={!currentTrack}
            >
              {isPlaying ? <Pause /> : <Play />}
            </button>

            <div>
              <h3 className="text-base font-semibold leading-tight">
                {currentTrack ? `Now Playing · ${currentTrack.title}` : t('playlist.queueEmpty')}
              </h3>
              <p className="text-sm text-neutral-400">
                {currentTrack
                  ? `${currentTrack.artist} • ${activeChannel} Channel`
                  : t('playlist.addSongs')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-neutral-400">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onMuteToggle();
              }}
              className="hover:text-orange-400 transition-colors"
              disabled={!currentTrack}
            >
              {isMuted ? <VolumeX /> : <Volume2 />}
            </button>
            {!isMobile() && (
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={volume}
                onChange={onVolumeChange}
                className={`accent-orange-500 w-24 ${isMuted ? "opacity-50" : ""}`}
                onClick={(event) => event.stopPropagation()}
                disabled={!currentTrack}
              />
            )}
            {!isMobile() && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCinemaMode();
                }}
                className="hover:text-white transition-colors ml-2"
                title={isCinemaMode ? "Exit Cinema Mode" : "Cinema Mode"}
              >
                {isCinemaMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}

PlaybackControls.propTypes = {
  isPlaying: PropTypes.bool.isRequired,
  onPlayPause: PropTypes.func.isRequired,
  progress: PropTypes.number.isRequired,
  currentTrack: PropTypes.object,
  activeChannel: PropTypes.string.isRequired,
  isMuted: PropTypes.bool.isRequired,
  onMuteToggle: PropTypes.func.isRequired,
  volume: PropTypes.number.isRequired,
  onVolumeChange: PropTypes.func.isRequired,
  isCinemaMode: PropTypes.bool,
  onToggleCinemaMode: PropTypes.func,
  onVisibilityChange: PropTypes.func,
  isOwner: PropTypes.bool,
  onSeek: PropTypes.func,
  onHeightChange: PropTypes.func,
};
