import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { useGoogleLogin } from '@react-oauth/google';
import { Radio, Send, LogOut, Settings, HelpCircle, QrCode, Copy, Check, List, Scale } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

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
  playlistViewMode,

  ownerBypass,
  suggestionMode,
  onUpdateSettings,
  ownerPopups,
  onManageRequests,
  pendingCount,
  duplicateCooldown,
  ownerQueueBypass,
  votesEnabled,
  autoApproveKnown,
  autoRefill,
  onTogglePlaylistView,
  showQRCode, // <--- Added prop
  onShowQRCode, // <--- Added prop
  onDeleteAccount, // GDPR: Right to Erasure
}) {
  const headerRef = React.useRef(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [showProfileModal, setShowProfileModal] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [exitConfirmIndex, setExitConfirmIndex] = React.useState(0); // 0 = Cancel, 1 = Leave
  // const [showQRCode, setShowQRCode] = React.useState(false); // Removed local state
  const [copied, setCopied] = React.useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = React.useState("");

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      onLoginSuccess(tokenResponse);
    },
    onError: () => console.log('Login Failed'),
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!headerRef.current) return;
      if (headerRef.current.contains(event.target)) return;
      if (event.target.closest(".keep-open")) return;
      // Do not close settings if exit confirm is open to avoid conflict
      if (showExitConfirm) return;
      onShowSuggest(false);
      setShowSettings(false);
      // Close QR code if clicked outside (unless it's the QR code modal content)
      if (!event.target.closest(".qr-code-modal")) {
        onShowQRCode(false);
        setCopied(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onShowSuggest, showExitConfirm, onShowQRCode]); // Added onShowQRCode to dependency array

  // Handle Keyboard Navigation for Exit Confirmation
  useEffect(() => {
    if (!showExitConfirm) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setExitConfirmIndex(1); // Move to Leave
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setExitConfirmIndex(0); // Move to Cancel
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (exitConfirmIndex === 1) {
          onGoHome();
          setShowExitConfirm(false);
          onShowSuggest(false);
        } else {
          setShowExitConfirm(false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowExitConfirm(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showExitConfirm, exitConfirmIndex, onGoHome, onShowSuggest]);

  return (
    <header
      ref={headerRef}
      className="p-4 flex flex-col items-center gap-3 w-full"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4">
        <div className="flex items-center gap-3 justify-start min-w-0">
          <div className="flex items-center flex-shrink-0 transition-all duration-300">
            {user ? (
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-3 px-2 py-1 rounded-full hover:bg-neutral-800/50 hover:border-neutral-700 border border-transparent transition-all group cursor-pointer"
                title="Profile & Settings"
              >
                <div className="flex items-center gap-2">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-neutral-700" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-500 border border-neutral-700">
                      {user.name?.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm font-medium text-neutral-300 truncate max-w-[120px] group-hover:text-white transition-colors">{user.name}</span>
                </div>
              </button>
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
            <a
              href="/legal"
              className="flex items-center justify-center p-2 text-neutral-400 hover:text-white transition-colors ml-1"
              title="Legal Information"
            >
              <Scale size={20} />
            </a>
            {/* Playlist View Toggle - Next to User Widget */}
            {!(playlistViewMode && !isOwner) && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePlaylistView();
                  setShowSettings(false);
                  onShowSuggest(false);
                }}
                className="flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors ml-2"
                title="Playlist View"
              >
                <List size={22} />
              </button>
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
              setShowExitConfirm(true);
              setExitConfirmIndex(0); // Default to "Cancel" for safety
              setShowSettings(false);
            }}
            className="keep-open flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors flex-shrink-0 max-w-[160px] overflow-hidden"
            title={activeChannel}
          >
            <Radio size={22} className="flex-shrink-0" />
            {activeChannel.length > 15 ? (
              <div className="overflow-hidden whitespace-nowrap w-full mask-linear-fade">
                <span
                  className="animate-marquee inline-block pl-0"
                  style={{ animationDuration: `${Math.max(10, activeChannel.length * 0.4)}s` }}
                >
                  {activeChannel}&nbsp;&nbsp;&nbsp;&nbsp;{activeChannel}&nbsp;&nbsp;&nbsp;&nbsp;
                </span>
              </div>
            ) : (
              <span className="hidden md:inline truncate">{activeChannel}</span>
            )}
          </button>



          {/* Suggest Button */}
          {(() => {
            // Treat owner as regular user if bypass is disabled
            const effectiveIsOwner = isOwner && ownerBypass;
            const isDisabled = !suggestionsEnabled && !effectiveIsOwner;

            return (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onShowSuggest((prev) => !prev);
                  setShowSettings(false);
                }}
                className={`keep-open flex items-center gap-2 transition-colors truncate ${isDisabled
                  ? "text-neutral-600 hover:text-neutral-500"
                  : "text-orange-500 hover:text-orange-400"
                  }`}
                title={isDisabled ? "Suggestions disabled by owner (View Only)" : "Suggest a Song"}
              >
                <Send size={18} /> <span className="hidden sm:inline">Suggest</span>
              </button>
            );
          })()}

          <button
            onClick={(event) => {
              event.stopPropagation();
              onShowQRCode(true);
              setShowSettings(false);
              onShowSuggest(false);
            }}
            className="keep-open flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors"
            title="Share Channel"
          >
            <QrCode size={20} />
          </button>



          {isOwner && (
            <div className="relative flex items-center gap-2">

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
                <div className="keep-open absolute right-0 top-full mt-2 w-64 max-h-[60vh] overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#1a1a1a] border border-neutral-800 rounded-xl shadow-xl p-4 animate-in fade-in slide-in-from-top-2 z-[100]">
                  <h3 className="text-sm font-bold text-neutral-400 mb-3 uppercase tracking-wider">Channel Settings</h3>

                  {(pendingCount > 0 || suggestionMode === 'manual') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onManageRequests();
                        setShowSettings(false);
                      }}
                      className="w-full mb-3 flex items-center justify-between p-2 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors border border-orange-500/20"
                    >
                      <span className="text-sm font-medium">Review Requests</span>
                      <span className="text-xs font-bold bg-orange-500 text-black px-1.5 rounded-full">{pendingCount}</span>
                    </button>
                  )}

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

                  {suggestionsEnabled && (
                    <>
                      <div className="flex items-center justify-between mt-3 pl-2 border-l-2 border-neutral-700 ml-1">
                        <label className="text-sm font-medium text-neutral-300">Manual Review</label>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateSettings({ suggestionMode: suggestionMode === 'manual' ? 'auto' : 'manual' });
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${suggestionMode === 'manual' ? 'bg-orange-500' : 'bg-neutral-600'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${suggestionMode === 'manual' ? 'translate-x-6' : 'translate-x-1'}`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-3 pl-2 border-l-2 border-neutral-700 ml-1">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-neutral-300">Approve known</label>
                          <div className="group relative flex items-center">
                            <HelpCircle size={14} className="text-neutral-500 hover:text-neutral-300 cursor-help" />
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none">
                              Automatically approve songs that have been approved before
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateSettings({ autoApproveKnown: !autoApproveKnown });
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoApproveKnown ? 'bg-orange-500' : 'bg-neutral-600'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoApproveKnown ? 'translate-x-6' : 'translate-x-1'}`}
                          />
                        </button>
                      </div>
                    </>
                  )}



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
                    <label className="text-sm font-medium text-white">Prevent Repetition</label>
                    <select
                      value={duplicateCooldown ?? 10}
                      onChange={(e) => onUpdateSettings({ duplicateCooldown: Number(e.target.value) })}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-neutral-800 text-white text-sm rounded-lg px-2 py-1 border border-neutral-700 focus:outline-none focus:border-orange-500"
                    >
                      <option value={0}>No Limit</option>
                      <option value={5}>5 Songs</option>
                      <option value={10}>10 Songs</option>
                      <option value={20}>20 Songs</option>
                      <option value={50}>50 Songs</option>
                      <option value={100}>100 Songs</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-white">Smart Queue</label>
                      <div className="group relative flex items-center">
                        <HelpCircle size={14} className="text-neutral-500 hover:text-neutral-300 cursor-help" />
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none">
                          Replace downvoted songs when full
                        </div>
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
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-white">Auto Refill</label>
                      <div className="group relative flex items-center">
                        <HelpCircle size={14} className="text-neutral-500 hover:text-neutral-300 cursor-help" />
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none">
                          Automatically add songs from history when queue is empty. Starts at 5 songs.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSettings({ autoRefill: !autoRefill });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoRefill ? 'bg-orange-500' : 'bg-neutral-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoRefill ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>



                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-white">Venue Mode</label>
                      <div className="group relative flex items-center">
                        <HelpCircle size={14} className="text-neutral-500 hover:text-neutral-300 cursor-help" />
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none">
                          Guests see playlist only (No Video)
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSettings({ playlistViewMode: !playlistViewMode });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${playlistViewMode ? 'bg-orange-500' : 'bg-neutral-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${playlistViewMode ? 'translate-x-6' : 'translate-x-1'}`}
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

                  <div className="flex items-center justify-between mt-3">
                    <label className="text-sm font-medium text-white">Allow Voting</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSettings({ votesEnabled: !votesEnabled });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${votesEnabled ? 'bg-orange-500' : 'bg-neutral-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${votesEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  {/* Owner Bypass Rules */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-700">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-white">Owner Bypass Rules</label>
                      <div className="group relative flex items-center">
                        <HelpCircle size={14} className="text-neutral-500 hover:text-neutral-300 cursor-help" />
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none">
                          Ignore filters/limits
                        </div>
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

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-white">Owner Bypass Queue</label>
                      <div className="group relative flex items-center">
                        <HelpCircle size={14} className="text-neutral-500 hover:text-neutral-300 cursor-help" />
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none">
                          Owner songs play next (Top Priority)
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSettings({ ownerQueueBypass: !ownerQueueBypass });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ownerQueueBypass ? 'bg-orange-500' : 'bg-neutral-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ownerQueueBypass ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  {/* Popups Toggle */}
                  <div className="flex items-center justify-between mt-3">
                    <label className="text-sm font-medium text-neutral-300">Popups</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSettings({ ownerPopups: !ownerPopups });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ownerPopups ? 'bg-orange-500' : 'bg-neutral-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ownerPopups ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Exit Confirmation Modal */}
      {
        showExitConfirm && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 text-center">
              <h3 className="text-xl font-bold text-white mb-2">Leave Channel?</h3>
              <p className="text-neutral-400 mb-6">Are you sure you want to return to the lobby?</p>

              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowExitConfirm(false);
                  }}
                  className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all border ${exitConfirmIndex === 0
                    ? "bg-neutral-700 text-white ring-2 ring-orange-500/50 border-transparent"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border-transparent"
                    }`}
                  onMouseEnter={() => setExitConfirmIndex(0)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("[Header] Leave confirmed, navigating home...");
                    onGoHome();
                    setShowExitConfirm(false);
                    onShowSuggest(false);
                  }}
                  className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all border ${exitConfirmIndex === 1
                    ? "bg-orange-500 text-white ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/20 border-transparent"
                    : "bg-red-900/30 text-red-400 hover:bg-red-900/50 border-red-900/50"
                    }`}
                  onMouseEnter={() => setExitConfirmIndex(1)}
                >
                  Leave
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }
      {/* QR Code Modal */}
      {
        showQRCode && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={() => onShowQRCode(false)}
          >
            <div
              className="qr-code-modal bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 text-center flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-orange-500 mb-4">Share Channel</h3>
              <div className="relative group">
                <div className="relative bg-neutral-900 p-4 rounded-xl mb-4 border border-orange-500/50">
                  <QRCodeSVG
                    value={window.location.href}
                    size={200}
                    level={"H"}
                    includeMargin={false}
                    fgColor={"#ffffff"}
                    bgColor={"transparent"}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-6 bg-neutral-800/50 p-2 pl-4 rounded-xl w-full max-w-[280px] border border-neutral-800">
                <p className="text-neutral-400 text-sm overflow-x-auto whitespace-nowrap flex-1 font-mono no-scrollbar">{window.location.href}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className={`p-2 rounded-lg transition-all ${copied
                    ? "bg-green-500/10 text-green-500"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                    }`}
                  title="Copy URL"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <button
                onClick={() => onShowQRCode(false)}
                className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-orange-500 border border-orange-500/20 hover:border-orange-500/50 rounded-lg transition-all font-medium"
              >
                Close
              </button>
            </div>
          </div>,
          document.body
        )
      }
      {
        showProfileModal && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={() => setShowProfileModal(false)}
          >
            <div
              className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center mb-6">
                {user?.picture ? (
                  <img src={user.picture} alt={user.name} className="w-20 h-20 rounded-full border-2 border-neutral-700 mb-4 shadow-xl" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-neutral-800 flex items-center justify-center text-3xl font-bold text-neutral-500 mb-4 border-2 border-neutral-700">
                    {user?.name?.charAt(0)}
                  </div>
                )}
                <h3 className="text-xl font-bold text-white">{user?.name}</h3>
                <p className="text-sm text-neutral-400">{user?.email}</p>
              </div>

              {!showDeleteConfirm ? (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      onLogout();
                      setShowProfileModal(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-colors border border-black/20"
                  >
                    <LogOut size={18} /> Sign Out
                  </button>

                  <div className="pt-4 border-t border-neutral-800 mt-4">
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-900/30 text-red-500 hover:bg-red-950/30 hover:border-red-900/50 transition-colors text-sm font-medium"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center animate-in fade-in slide-in-from-bottom-2">
                  <h4 className="text-lg font-bold text-red-500 mb-2">Are you absolutely sure?</h4>
                  <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
                    This action cannot be undone. It will permanently delete your account and <strong>all channels</strong> you have created.
                  </p>

                  <div className="mb-6">
                    <label className="block text-xs text-neutral-500 mb-2 font-medium">
                      Type <span className="text-neutral-300 font-bold select-none">Delete this account and all my channels forever</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmationText}
                      onChange={(e) => setDeleteConfirmationText(e.target.value)}
                      className="w-full bg-black/30 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder-neutral-700 font-mono"
                      placeholder="Type the confirmation phrase..."
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmationText("");
                      }}
                      className="flex-1 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        console.log("Delete button clicked in Header");
                        onDeleteAccount();
                        setShowProfileModal(false);
                        setShowDeleteConfirm(false);
                        setDeleteConfirmationText("");
                      }}
                      disabled={deleteConfirmationText !== "Delete this account and all my channels forever"}
                      className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 disabled:shadow-none"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      }
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
  playlistViewMode: PropTypes.bool,
  ownerBypass: PropTypes.bool,
  suggestionMode: PropTypes.string,
  onUpdateSettings: PropTypes.func,
  ownerPopups: PropTypes.bool,
  onManageRequests: PropTypes.func,
  pendingCount: PropTypes.number,
  duplicateCooldown: PropTypes.number,
  ownerQueueBypass: PropTypes.bool,
  votesEnabled: PropTypes.bool,
  autoApproveKnown: PropTypes.bool,
  autoRefill: PropTypes.bool,
  onTogglePlaylistView: PropTypes.func,
  showQRCode: PropTypes.bool,
  onShowQRCode: PropTypes.func,
  onDeleteAccount: PropTypes.func,
};
