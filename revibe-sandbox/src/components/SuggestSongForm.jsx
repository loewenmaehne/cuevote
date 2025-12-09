import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { CheckCircle, Send } from "lucide-react";

export function SuggestSongForm({ onSongSuggested, serverError, isOwner, suggestionsEnabled }) {
  const [songSuggestion, setSongSuggestion] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

  // Clear local error when user types
  const handleInputChange = (e) => {
    setSongSuggestion(e.target.value);
    if (suggestionError) setSuggestionError("");
  };

  const handleSubmitSuggestion = useCallback(async () => {
    const input = songSuggestion.trim();
    if (!input) {
      setSuggestionError("Please enter a YouTube link or song name.");
      return;
    }

    setSuggestionError("");
    setIsSubmittingSuggestion(true);

    // Delegate everything to server (Validation, Search, Metadata)
    onSongSuggested(input);

    // Optimistic Success UI
    setSubmissionSuccess(true);
    setSongSuggestion("");

    // Reset UI after delay
    setTimeout(() => {
      setSubmissionSuccess(false);
      setIsSubmittingSuggestion(false);
    }, 2000);

  }, [songSuggestion, onSongSuggested]);

  const handleKeyPress = useCallback(
    (event) => {
      if (event.key === "Enter") {
        handleSubmitSuggestion();
      }
    },
    [handleSubmitSuggestion],
  );

  // If server returns an error (e.g. Livestream rejected) after we showed success, 
  // revert back to default state immediately.
  React.useEffect(() => {
    if (serverError) {
      setSubmissionSuccess(false);
    }
  }, [serverError]);

  const activeError = suggestionError || serverError;

  return (
    <div className="keep-open w-full max-w-5xl mx-auto mt-3 animate-fadeIn space-y-2">
      <div className="keep-open flex items-center gap-2">
        <input
          type="text"
          value={songSuggestion}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}

          placeholder={!suggestionsEnabled && !isOwner ? "Suggestions disabled by owner" : "Type a song name..."}
          disabled={isSubmittingSuggestion || (!suggestionsEnabled && !isOwner)}
          className="keep-open flex-1 px-5 py-2 rounded-full bg-[#121212] text-white border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base disabled:opacity-60 disabled:cursor-not-allowed"
        />              <button
          onClick={(event) => {
            event.stopPropagation();
            handleSubmitSuggestion();
          }}
          disabled={isSubmittingSuggestion || (!suggestionsEnabled && !isOwner)}
          className={`keep-open px-5 py-2 rounded-full text-white transition-all flex items-center gap-2 text-base disabled:cursor-not-allowed disabled:opacity-70 ${submissionSuccess
            ? "bg-green-600 hover:bg-green-500"
            : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500"
            }`}
        >
          {submissionSuccess ? (
            <>
              <CheckCircle size={18} /> Added
            </>
          ) : (
            <>
              <Send size={18} /> {isSubmittingSuggestion ? "Adding..." : "Submit"}
            </>
          )}
        </button>
      </div>
      {
        activeError && (
          <p className="keep-open text-sm text-red-400">{activeError}</p>
        )
      }
    </div >
  );
}
SuggestSongForm.propTypes = {
  onSongSuggested: PropTypes.func.isRequired,
  onShowSuggest: PropTypes.func.isRequired,
  serverError: PropTypes.string,
  isOwner: PropTypes.bool,
  suggestionsEnabled: PropTypes.bool,
};
