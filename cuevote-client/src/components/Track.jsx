import React, { useState } from "react";
import PropTypes from "prop-types";
import { ThumbsUp, ThumbsDown, Headphones, Trash2, Sparkles, Loader2, Check } from "lucide-react";
import { useLanguage } from '../contexts/LanguageContext';
import { useConsent } from '../contexts/ConsentContext';
import { Suggestions } from "./Suggestions";

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
  onDelete,
  onAdd,
  onAddSuggestion, // <--- New Prop for separation of concerns
  onRecommend,
  activeSuggestionId, // <--- New Prop
  suggestions,        // <--- New Prop
  isFetchingSuggestions, // <--- New Prop
  queueVideoIds       // <--- New Prop
}) {
  // Check prioritized status
  const isPriority = track.isOwnerPriority;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isActiveSuggestion = activeSuggestionId === track.id; // Check if active


  const { t } = useLanguage();
  const { hasConsent } = useConsent(); // Get consent state

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
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {hasConsent ? (
            <img
              src={track.thumbnail ?? buildThumbnailUrl(track.videoId)}
              alt={track.title}
              className="w-16 h-16 rounded-3xl object-cover shadow-md flex-shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="w-16 h-16 rounded-3xl bg-neutral-800 flex items-center justify-center flex-shrink-0 shadow-inner">
              <Headphones size={24} className="text-neutral-600" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight truncate">
              {track.title}
            </h3>
            <p className="text-sm text-neutral-400 truncate">
              {track.artist}
              {isActive ? " • " + t('track.playing') : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {track.suggestedByUsername && (
            <span className="text-xs text-neutral-500 font-medium mr-2 whitespace-nowrap">
              {track.suggestedByUsername}
            </span>
          )}

          {!readOnly && votesEnabled && !isActive && (
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

          {(isActive || (readOnly && isActive)) && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-green-500 uppercase tracking-wider">{t('track.now')}</span>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-[#1a1a1a] rounded-2xl border border-neutral-800 text-neutral-300 mt-4 space-y-4">

          {/* Inline Suggestions Accordion (Moved to Top) */}
          {isActiveSuggestion && (
            <div className="border-b border-neutral-800 pb-4 animate-fadeIn">
              <div className="flex items-center justify-between mb-2 px-1">
                <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-400" />
                  {t('suggestions.title', 'Similar Songs')}
                </h4>
              </div>

              {isFetchingSuggestions ? (
                <div className="flex flex-col items-center justify-center py-8 text-neutral-500 gap-3">
                  <Loader2 className="animate-spin text-orange-500" size={24} />
                  <p className="text-xs font-medium">{t('suggestions.loading', 'Finding similar songs...')}</p>
                </div>
              ) : suggestions && suggestions.length > 0 ? (
                <Suggestions suggestions={suggestions} onAdd={onAddSuggestion || onAdd} onPreview={onPreview} queueVideoIds={queueVideoIds} />
              ) : (
                <div className="text-center py-4 text-neutral-500 text-sm">
                  {t('suggestions.empty', 'No suggestions found.')}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {onAdd && !queueVideoIds?.has(track.videoId) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(track.videoId);
                }}
                className="flex-1 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all shadow-lg shadow-orange-900/20 active:scale-95"
              >
                {t('track.add')}
              </button>
            )}
            {onRecommend && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRecommend(track);
                }}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all shadow-lg shadow-purple-900/20"
              >
                <Sparkles size={20} className="text-yellow-300" />
                {t('track.recommend', 'Get Suggestions')}
              </button>
            )}
            {onPreview && !isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(track);
                }}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors"
              >
                <Headphones size={20} className="text-green-400" />
                {t('track.preview')}
              </button>
            )}
            {onDelete && (
              showDeleteConfirm ? (
                <div className="flex gap-3 animate-fadeIn">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(false);
                    }}
                    className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white py-3 rounded-xl font-semibold transition-colors"
                  >
                    {t('track.cancel')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(track.id);
                    }}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 py-3 rounded-xl font-semibold transition-colors"
                  >
                    {t('track.confirmDelete')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="flex-1 bg-neutral-800 hover:bg-red-900/30 text-red-500 hover:text-red-400 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors border border-transparent hover:border-red-500/30"
                >
                  <Trash2 size={20} />
                  {t('track.delete')}
                </button>
              )
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
            {t('track.watch')}
          </a>
        </div>
      )}

    </div >
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
  onDelete: PropTypes.func,
  onAdd: PropTypes.func,
  onAddSuggestion: PropTypes.func,
  onRecommend: PropTypes.func,
  activeSuggestionId: PropTypes.string,
  suggestions: PropTypes.array,
  isFetchingSuggestions: PropTypes.bool,
  queueVideoIds: PropTypes.object, // Set
};
