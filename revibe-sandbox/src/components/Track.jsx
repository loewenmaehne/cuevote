import React from "react";
import PropTypes from "prop-types";
import { ThumbsUp, ThumbsDown } from "lucide-react";

const buildEmbedUrl = (videoId) => `https://www.youtube.com/embed/${videoId}`;
const buildWatchUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;
const buildThumbnailUrl = (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

export function Track({
  track,
  isActive,
  isExpanded,
  vote,
  onVote,
  onToggleExpand,
}) {
  return (
    <div
      onClick={() => onToggleExpand(track.id)}
      className={`transition-all duration-500 ease-in-out p-4 rounded-3xl shadow-lg backdrop-blur-sm cursor-pointer overflow-hidden ${
        vote === "up"
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
              onVote(track.id, "up");
            }}
            className={`transition-transform duration-300 ease-out drop-shadow-md transform relative rounded-full p-1.5 ${
              vote === "up"
                ? "scale-125 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg"
                : "text-orange-400 hover:scale-125 hover:bg-orange-500/20"
            }`}
          >
            <ThumbsUp size={20} />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onVote(track.id, "down");
            }}
            className={`transition-transform duration-300 ease-out transform relative rounded-full p-1.5 ${
              vote === "down"
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
}

Track.propTypes = {
  track: PropTypes.object.isRequired,
  isActive: PropTypes.bool.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  vote: PropTypes.string,
  onVote: PropTypes.func.isRequired,
  onToggleExpand: PropTypes.func.isRequired,
};
