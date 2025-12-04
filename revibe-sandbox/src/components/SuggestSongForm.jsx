import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { CheckCircle, Send } from "lucide-react";

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

export function SuggestSongForm({ onSongSuggested, onShowSuggest }) {
  const [songSuggestion, setSongSuggestion] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

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
      onSongSuggested({
        id: crypto.randomUUID ? crypto.randomUUID() : `suggest-${Date.now()}`,
        videoId,
        title: meta.title,
        artist: meta.artist,
        thumbnail: meta.thumbnail,
        lyrics: "",
        metaLoaded: true,
      });
      setSubmissionSuccess(true);
      setSongSuggestion("");
      setTimeout(() => {
        setSubmissionSuccess(false);
        onShowSuggest(false);
      }, 2000);
    } catch {
      setSuggestionError("Unable to load that video. Please try a different link.");
    } finally {
      setIsSubmittingSuggestion(false);
    }
  }, [songSuggestion, onSongSuggested, onShowSuggest]);

  const handleKeyPress = useCallback(
    (event) => {
      if (event.key === "Enter") {
        handleSubmitSuggestion();
      }
    },
    [handleSubmitSuggestion],
  );

  if (submissionSuccess) {
    return (
      <div className="flex items-center justify-center gap-3 text-green-400 text-lg font-semibold mt-3 animate-fadeOut">
        <CheckCircle size={24} /> Suggestion submitted!
      </div>
    );
  }

  return (
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
  );
}

SuggestSongForm.propTypes = {
  onSongSuggested: PropTypes.func.isRequired,
  onShowSuggest: PropTypes.func.isRequired,
};
