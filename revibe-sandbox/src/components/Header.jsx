import React from "react";
import PropTypes from "prop-types";
import { Radio, Send, Sparkles } from "lucide-react";

export function Header({
  activeChannel,
  onChannelChange,
  onShowSuggest,
  showChannels,
  onShowChannels,
  channels,
  onJoinChannel,
}) {
  const headerRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (!headerRef.current) return;
      if (headerRef.current.contains(event.target)) return;
      if (event.target.closest(".keep-open")) return;
      onShowChannels(false);
      onShowSuggest(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onShowChannels, onShowSuggest]);

  return (
    <header
      ref={headerRef}
      className="p-4 border-b border-neutral-900 bg-[#050505]/95 backdrop-blur-md z-40 transition-all duration-700 ease-in-out flex flex-col items-center gap-3"
    >
      <div className="flex items-center justify-between w-full max-w-5xl relative">
        <button
          onClick={(event) => {
            event.stopPropagation();
            onShowChannels((prev) => !prev);
            onShowSuggest(false);
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
            onShowSuggest((prev) => !prev);
            onShowChannels(false);
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
                onChannelChange(channel);
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
              onJoinChannel();
            }}
            className="keep-open flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:from-orange-400 hover:to-orange-500 transition-all shadow-md"
          >
            <Sparkles size={16} /> Join Channel
          </button>
        </div>
      )}
    </header>
  );
}

Header.propTypes = {
  activeChannel: PropTypes.string.isRequired,
  onChannelChange: PropTypes.func.isRequired,
  onShowSuggest: PropTypes.func.isRequired,
  showChannels: PropTypes.bool.isRequired,
  onShowChannels: PropTypes.func.isRequired,
  channels: PropTypes.arrayOf(PropTypes.string).isRequired,
  onJoinChannel: PropTypes.func.isRequired,
};
