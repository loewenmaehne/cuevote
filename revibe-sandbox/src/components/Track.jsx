import React from "react";
import PropTypes from "prop-types";
import { ThumbsUp, ThumbsDown, Headphones } from "lucide-react";

const buildWatchUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;
const buildThumbnailUrl = (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

export function Track({
  track,
  isActive,
  isExpanded,
  vote,
  onVote,
  onToggleExpand,
  onPreview,
  readOnly = false,
  votesEnabled = true,
}) {
  // Check prioritized status
  const isPriority = track.isOwnerPriority;

  return (
    <div
      onClick={() => onToggleExpand(track.id)}
      className={`transition-all duration-500 ease-in-out p-4 rounded-3xl shadow-lg backdrop-blur-sm cursor-pointer overflow-hidden border ${isActive
        ? "border-green-500 bg-[#0a0a0a] shadow-[0_0_15px_rgba(34,197,94,0.3)]"
        : isPriority
          ? "border-red-500/50 bg-[#1a1a1a] shadow-[0_0_10px_rgba(239,68,68,0.15)] ring-1 ring-red-500/30"
          : vote === "up"
            ? "border-transparent bg-gradient-to-br from-orange-500/70 to-orange-600/60 shadow-[0_0_15px_#fb923c]/60"
            : "border-transparent bg-[#1e1e1e]/80 hover:bg-[#222]"
        } ${isExpanded
          ? isActive
            ? "scale-[1.02] ring-2 ring-green-500/60"
            : isPriority
              ? "scale-[1.02] ring-2 ring-red-500/60"
              : "scale-[1.02] ring-2 ring-orange-500/60"
          : ""
        } ${readOnly ? "opacity-90" : ""}`}
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
          {track.suggestedByUsername && (
            <span className="text-xs text-neutral-500 font-medium mr-2 hidden sm:block">
              {track.suggestedByUsername}
            </span>
          )}

          {!readOnly && votesEnabled && (
            <>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onVote(track.id, "up");
                }}
                className={`transition-transform duration-300 ease-out drop-shadow-md transform relative rounded-full p-1.5 ${vote === "up"
                  ? "scale-125 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg"
                  : "text-orange-400 hover:scale-125 hover:bg-orange-500/20"
                  }`}
              >
                <ThumbsUp size={20} />
              </button>

              <span className={`text-sm font-bold w-6 text-center ${(track.score || 0) > 0 ? "text-orange-400" :
                (track.score || 0) < 0 ? "text-neutral-500" : "text-neutral-600"
                }`}>
                {track.score || 0}
              </span>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onVote(track.id, "down");
                }}
                className={`transition-transform duration-300 ease-out transform relative rounded-full p-1.5 ${vote === "down"
                  ? "scale-125 bg-gradient-to-br from-neutral-600 to-neutral-800 text-white shadow-lg"
                  : "text-neutral-500 hover:scale-125 hover:bg-neutral-700/20"
                  }`}
              >
                <ThumbsDown size={20} />
              </button>
            </>
          )}

          {readOnly && isActive && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Now</span>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-[#1a1a1a] rounded-2xl border border-neutral-800 text-neutral-300 mt-4 space-y-3">
          <div className="flex gap-3">
            {onPreview && !readOnly && !isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(track);
                }}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors"
              >
                <Headphones size={20} className="text-green-400" />
                Preview Song
              </button>
            )}
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
}

Track.propTypes = {
  track: PropTypes.object.isRequired,
  isActive: PropTypes.bool.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  vote: PropTypes.string,
  onVote: PropTypes.func.isRequired,
  onToggleExpand: PropTypes.func.isRequired,
  onPreview: PropTypes.func,
  readOnly: PropTypes.bool,
};
