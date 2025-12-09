import React, { useCallback, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { CheckCircle, Send, Clock } from "lucide-react";

export function SuggestSongForm({ onSongSuggested, serverError, serverMessage, isOwner, suggestionsEnabled }) {
  const [songSuggestion, setSongSuggestion] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);


  // Clear local error when user types
  const handleInputChange = (e) => {
    setSongSuggestion(e.target.value);
    if (suggestionError) setSuggestionError("");
    if (infoMessage) setInfoMessage("");
  };

  const handleSubmitSuggestion = useCallback(async () => {
    const input = songSuggestion.trim();
    if (!input) {
      setSuggestionError("Please enter a YouTube link or song name.");
      return;
    }

    setSuggestionError("");
    setInfoMessage("");
    setIsSubmittingSuggestion(true);

    // Delegate everything to server (Validation, Search, Metadata)
    onSongSuggested(input);

    // Optimistic Success UI - Only if NOT manual review? 
    // Actually, we don't know if manual review is on here easily without more props.
    // But if we get an immediate response, we can handle it.
    // For now, let's show optimistic success, but if we get "info" message later, we update it.

    // Changing strategy: Don't set optimistic success immediately if we expect a different message?
    // Let's keep optimistic success for "Added", but if we get "info" type message, we change the text.

    setSubmissionSuccess(true);
    setSongSuggestion("");

    // Reset UI after delay
    setTimeout(() => {
      setSubmissionSuccess(false);
      setIsSubmittingSuggestion(false);
      setInfoMessage("");
    }, 3000);

  }, [songSuggestion, onSongSuggested]);

  const handleKeyPress = useCallback(
    (event) => {
      if (event.key === "Enter") {
        handleSubmitSuggestion();
      }
    },
    [handleSubmitSuggestion],
  );

  // Handle Server Messages (Error or Info)
  useEffect(() => {
    if (serverError) {
      setSubmissionSuccess(false);
      setIsSubmittingSuggestion(false); // Stop spinning/disabled
    }

    if (serverMessage && serverMessage.type === "info") {
      // It's a non-error message (e.g. "Suggestion submitted for review")
      setInfoMessage(serverMessage.message);
      setSubmissionSuccess(true); // Treat as success state strictly for UI green check
      setSongSuggestion(""); // Clear input if not already
      setIsSubmittingSuggestion(false);

      // Clear after delay
      setTimeout(() => {
        setSubmissionSuccess(false);
        setInfoMessage("");
      }, 3000);
    }
  }, [serverError, serverMessage]);

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
            ? (infoMessage ? "bg-blue-600 hover:bg-blue-500" : "bg-green-600 hover:bg-green-500")
            : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500"
            }`}
        >
          {submissionSuccess ? (
            <>
              {infoMessage ? <Clock size={18} /> : <CheckCircle size={18} />}
              {infoMessage || "Added"}
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
  serverMessage: PropTypes.object,
  isOwner: PropTypes.bool,
  suggestionsEnabled: PropTypes.bool,
};
