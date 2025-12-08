import React from "react";
import PropTypes from "prop-types";
import { useGoogleLogin } from '@react-oauth/google';
import { Radio, Send, LogOut, Settings, HelpCircle } from "lucide-react";

export function Header({
  activeChannel,
  onGoHome,
  onShowSuggest,
  user,
  onLoginSuccess,
  onLogout,
  isOwner,
  suggestionsEnabled,
  musicOnly,
  maxDuration,
  maxQueueSize,
  allowPrelisten,
  smartQueue,
  ownerBypass,
  onUpdateSettings,
}) {
  const headerRef = React.useRef(null);
  const [showSettings, setShowSettings] = React.useState(false);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      onLoginSuccess(tokenResponse);
    },
    onError: () => console.log('Login Failed'),
  });

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (!headerRef.current) return;
      if (headerRef.current.contains(event.target)) return;
      if (event.target.closest(".keep-open")) return;
      onShowSuggest(false);
      setShowSettings(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onShowSuggest]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 p-4 border-b border-neutral-900 bg-[#050505]/95 backdrop-blur-md z-40 transition-all duration-700 ease-in-out flex flex-col items-center gap-3"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4">
        <div className="flex items-center gap-3 justify-start min-w-0">
          <div className="flex items-center flex-shrink-0 transition-all duration-300">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {user.picture && (
                    <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-neutral-700" />
                  )}
                  <span className="text-sm font-medium text-neutral-300 truncate max-w-[120px]">{user.name}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="text-neutral-500 hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => login()}
                  className="group flex items-center justify-center w-9 h-9 rounded-full border border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700 hover:border-neutral-500 transition-all active:scale-95 shadow-sm"
                  title="Sign in with Google"
                >
                  <svg className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.48 10.92V13.48H16.66C16.47 14.39 15.48 16.03 12.48 16.03C9.82 16.03 7.65 13.84 7.65 11.13C7.65 8.43 9.82 6.23 12.48 6.23C13.99 6.23 15.02 6.88 15.6 7.43L17.47 5.62C16.18 4.42 14.47 3.69 12.48 3.69C8.45 3.69 5.19 7.03 5.19 11.13C5.19 15.23 8.45 18.57 12.48 18.57C16.68 18.57 19.47 15.61 19.47 11.51C19.47 11.14 19.43 10.91 19.37 10.54L12.48 10.92Z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-orange-500 tracking-tight whitespace-nowrap text-center">
          ReVibe Music
        </h1>

        <div className="flex items-center justify-end gap-4 min-w-0">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onGoHome();
              onShowSuggest(false);
            }}
            className="keep-open flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors flex-shrink-0 max-w-[160px] overflow-hidden"
            title={activeChannel}
          >
            <Radio size={22} className="flex-shrink-0" />
            {activeChannel.length > 15 ? (
              <div className="overflow-hidden whitespace-nowrap w-full mask-linear-fade">
                <span className="animate-marquee inline-block pl-0">
                  {activeChannel}&nbsp;&nbsp;&nbsp;&nbsp;{activeChannel}&nbsp;&nbsp;&nbsp;&nbsp;
                </span>
              </div>
            ) : (
              <span className="hidden md:inline truncate">{activeChannel}</span>
            )}
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onShowSuggest((prev) => !prev);
              setShowSettings(false);
            }}
            className={`keep-open flex items-center gap-2 transition-colors truncate ${(!suggestionsEnabled && !isOwner)
              ? "text-neutral-600 hover:text-neutral-500"
              : "text-orange-500 hover:text-orange-400"
              }`}
            title={(!suggestionsEnabled && !isOwner) ? "Suggestions disabled by owner (View Only)" : "Suggest a Song"}
          >
            <Send size={18} /> <span className="hidden sm:inline">Suggest</span>
          </button>

          {isOwner && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(!showSettings);
                  onShowSuggest(false);
                }}
                className={`keep-open p-2 rounded-full transition-colors ${showSettings ? "text-orange-500 bg-neutral-800" : "text-neutral-400 hover:text-white"}`}
                title="Channel Settings"
              >
                <Settings size={20} />
              </button>

              {showSettings && (
                <div className="keep-open absolute right-0 top-full mt-2 w-64 bg-[#1a1a1a] border border-neutral-800 rounded-xl shadow-xl p-4 animate-in fade-in slide-in-from-top-2 z-50">
                  <h3 className="text-sm font-bold text-neutral-400 mb-3 uppercase tracking-wider">Channel Settings</h3>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-white">Allow Suggestions</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSettings({ suggestionsEnabled: !suggestionsEnabled });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${suggestionsEnabled ? 'bg-orange-500' : 'bg-neutral-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${suggestionsEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <label className="text-sm font-medium text-white">Music Only</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSettings({ musicOnly: !musicOnly });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${musicOnly ? 'bg-orange-500' : 'bg-neutral-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${musicOnly ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <label className="text-sm font-medium text-white">Max Length</label>
                    <select
                      value={maxDuration}
                      onChange={(e) => onUpdateSettings({ maxDuration: Number(e.target.value) })}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-neutral-800 text-white text-sm rounded-lg px-2 py-1 border border-neutral-700 focus:outline-none focus:border-orange-500"
                    >
                      <option value={0}>No Limit</option>
                      <option value={300}>5 Mins</option>
                      <option value={600}>10 Mins</option>
                      <option value={900}>15 Mins</option>
                      <option value={1800}>30 Mins</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <label className="text-sm font-medium text-white">Max Queue Size</label>
                    <select
                      value={maxQueueSize}
                      onChange={(e) => onUpdateSettings({ maxQueueSize: Number(e.target.value) })}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-neutral-800 text-white text-sm rounded-lg px-2 py-1 border border-neutral-700 focus:outline-none focus:border-orange-500"
                    >
                      <option value={0}>No Limit</option>
                      <option value={10}>10 Songs</option>
                      <option value={25}>25 Songs</option>
                      <option value={50}>50 Songs</option>
                      <option value={100}>100 Songs</option>
                      <option value={250}>250 Songs</option>
                      <option value={500}>500 Songs</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-white">Smart Queue</label>
                      <div className="group relative flex items-center" title="Replace downvoted songs when full">
                        <HelpCircle size={14} className="text-neutral-500 hover:text-neutral-300 cursor-help" />
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSettings({ smartQueue: !smartQueue });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smartQueue ? 'bg-orange-500' : 'bg-neutral-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${smartQueue ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <label className="text-sm font-medium text-white">Allow Prelisten</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSettings({ allowPrelisten: !allowPrelisten });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${allowPrelisten ? 'bg-orange-500' : 'bg-neutral-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowPrelisten ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  {/* Owner Bypass Rules */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-700">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-white">Owner Bypass Rules</label>
                      <div className="group relative flex items-center" title="Ignore filters/limits">
                        <HelpCircle size={14} className="text-neutral-500 hover:text-neutral-300 cursor-help" />
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSettings({ ownerBypass: !ownerBypass });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ownerBypass ? 'bg-orange-500' : 'bg-neutral-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ownerBypass ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header >
  );
}

Header.propTypes = {
  activeChannel: PropTypes.string.isRequired,
  onGoHome: PropTypes.func.isRequired,
  onShowSuggest: PropTypes.func.isRequired,
  user: PropTypes.object,
  onLoginSuccess: PropTypes.func,
  onLogout: PropTypes.func,
  isOwner: PropTypes.bool,
  suggestionsEnabled: PropTypes.bool,
  musicOnly: PropTypes.bool,
  maxDuration: PropTypes.number,
  maxQueueSize: PropTypes.number,
  allowPrelisten: PropTypes.bool,
  smartQueue: PropTypes.bool,
  ownerBypass: PropTypes.bool,
  onUpdateSettings: PropTypes.func,
};
