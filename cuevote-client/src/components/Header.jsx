import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { Radio, Send, LogOut, Settings, HelpCircle, QrCode, Copy, Check, List, Scale, Library, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useLanguage } from '../contexts/LanguageContext';


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
  onShowQRCode,
  onDeleteAccount, // GDPR: Right to Erasure
  onToggleChannelLibrary,
  onDeleteChannel,
  showSettings,
  onToggleSettings
}) {
  const headerRef = React.useRef(null);
  // const [showSettings, setShowSettings] = React.useState(false); // Lifted to App
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [showProfileModal, setShowProfileModal] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false); // Account Delete
  // const [showDeleteChannelConfirm, setShowDeleteChannelConfirm] = React.useState(false); // Moved to SettingsView
  // const [deleteChannelText, setDeleteChannelText] = React.useState(""); // Moved to SettingsView

  const [exitConfirmIndex, setExitConfirmIndex] = React.useState(0); // 0 = Cancel, 1 = Leave
  // const [showQRCode, setShowQRCode] = React.useState(false); // Removed local state
  const [copied, setCopied] = React.useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = React.useState("");
  const { t } = useLanguage();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!headerRef.current) return;
      if (headerRef.current.contains(event.target)) return;
      if (event.target.closest(".keep-open")) return;
      // Do not close settings if exit confirm is open to avoid conflict
      if (showExitConfirm) return;
      // onShowSuggest(false); // User requested to keep suggest bar open on back key press (click outside)
      // setShowSettings(false); // Handled by onClose prop if we passed it, but for now we rely on explicit toggle or outside click logic in App? 
      // Actually App handles "click outside"? No, Header handles click outside for its own menus.
      // But SettingsView is now separate. Header doesn't control it.
      // So removing setShowSettings(false) here is correct.
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

  // Handle Escape Key for other modals
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        // if (showSettings) setShowSettings(false); // Handled by App
        if (showProfileModal) setShowProfileModal(false);
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        // We can safely call these even if not open, assuming they set boolean state
        onShowSuggest(false);
        onShowQRCode(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showSettings, showProfileModal, showDeleteConfirm, onShowSuggest, onShowQRCode]);

  return (
    <header
      ref={headerRef}
      className="p-2 md:p-4 flex flex-col items-center gap-3 w-full"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-2 lg:gap-4">
        <div className="flex items-center gap-3 justify-start min-w-0">
          <div className="flex items-center flex-shrink-0 transition-all duration-300">
            {user ? (
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-3 px-2 py-1 rounded-full hover:bg-neutral-800/50 hover:border-neutral-700 border border-transparent transition-all group cursor-pointer"
                title={t('header.profileSettings')}
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
                <GoogleAuthButton
                  onLoginSuccess={onLoginSuccess}
                  render={(performLogin, disabled) => (
                    <button
                      onClick={() => !disabled && performLogin()}
                      disabled={disabled}
                      className={`group flex items-center justify-center w-9 h-9 rounded-full border border-neutral-700 bg-neutral-800/50 transition-all shadow-sm ${disabled ? 'opacity-40 grayscale cursor-not-allowed' : 'hover:bg-neutral-700 hover:border-neutral-500 active:scale-95'}`}
                      title={disabled ? t('header.acceptCookies') : t('header.signIn')}
                    >
                      <svg className={`w-5 h-5 transition-colors ${disabled ? 'text-neutral-600' : 'text-neutral-400 group-hover:text-white'}`} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.48 10.92V13.48H16.66C16.47 14.39 15.48 16.03 12.48 16.03C9.82 16.03 7.65 13.84 7.65 11.13C7.65 8.43 9.82 6.23 12.48 6.23C13.99 6.23 15.02 6.88 15.6 7.43L17.47 5.62C16.18 4.42 14.47 3.69 12.48 3.69C8.45 3.69 5.19 7.03 5.19 11.13C5.19 15.23 8.45 18.57 12.48 18.57C16.68 18.57 19.47 15.61 19.47 11.51C19.47 11.14 19.43 10.91 19.37 10.54L12.48 10.92Z" />
                      </svg>
                    </button>
                  )}
                />
              </div>
            )}
            <a
              href="/legal"
              className="flex items-center justify-center p-2 text-neutral-400 hover:text-white transition-colors ml-1"
              title={t('header.legal')}
            >
              <Scale size={20} />
            </a>



          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-3 justify-center min-w-0">
          {/* Playlist View Toggle - Left of Logo */}
          {!(playlistViewMode && !isOwner) && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onTogglePlaylistView();
                setShowSettings(false);
                onShowSuggest(false);
              }}
              className="hidden md:flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors p-1"
              title="Playlist View"
            >
              <List size={20} className="md:w-[22px] md:h-[22px]" />
              <span className="hidden xl:block text-sm font-medium whitespace-nowrap">{t('header.playlist')}</span>
            </button>
          )}

          <h1 className="text-lg md:text-2xl font-bold text-orange-500 tracking-tight whitespace-nowrap text-center">
            CueVote
          </h1>

          {/* Channel Library Toggle - Right of Logo */}
          <button
            onClick={(event) => {
              event.stopPropagation();
              if (onToggleChannelLibrary) onToggleChannelLibrary();
              setShowSettings(false);
              onShowSuggest(false);
            }}
            className="hidden md:flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors p-1"
            title="Channel Library"
          >
            <Library size={20} className="md:w-[22px] md:h-[22px]" />
            <span className="hidden xl:block text-sm font-medium whitespace-nowrap">{t('header.library')}</span>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 lg:gap-4 min-w-0">
          <button
            onClick={(event) => {
              event.stopPropagation();
              setShowExitConfirm(true);
              setExitConfirmIndex(0); // Default to "Cancel" for safety
              setShowSettings(false);
            }}
            className="hidden md:flex keep-open items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors"
            title={activeChannel}
          >
            <Radio size={22} className="flex-shrink-0" />
            <div className={`hidden lg:block overflow-hidden whitespace-nowrap transition-all duration-300 ${activeChannel.length > 15 ? "w-[120px] xl:w-[200px] mask-linear-fade" : "max-w-[120px] xl:max-w-[200px]"}`}>
              {activeChannel.length > 15 ? (
                <div className="w-full overflow-hidden">
                  <span
                    className="animate-marquee inline-block pl-0"
                    style={{ animationDuration: `${Math.max(10, activeChannel.length * 0.4)}s` }}
                  >
                    {activeChannel}&nbsp;&nbsp;&nbsp;&nbsp;{activeChannel}&nbsp;&nbsp;&nbsp;&nbsp;
                  </span>
                </div>
              ) : (
                <span className="truncate block">{activeChannel}</span>
              )}
            </div>
          </button>




          <button
            onClick={(event) => {
              event.stopPropagation();
              onShowQRCode(true);
              setShowSettings(false);
              onShowSuggest(false);
            }}
            className="hidden md:flex keep-open items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors"
            title={t('header.share')}
          >
            <QrCode size={20} />
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
                className={`keep-open flex items-center gap-2 transition-colors flex-shrink-0 ${isDisabled
                  ? "text-neutral-600 hover:text-neutral-500"
                  : "text-orange-500 hover:text-orange-400"
                  }`}
                title={isDisabled ? t('header.suggestionsDisabled') : t('header.suggestSong')}
              >
                <Send size={18} /> <span>{t('header.suggest')}</span>
              </button>
            );
          })()}



          {isOwner && (
            <div className="relative flex items-center gap-2">

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSettings();
                  onShowSuggest(false);
                }}
                className={`keep-open p-2 rounded-full transition-colors ${showSettings ? "text-orange-500 bg-neutral-800" : "text-neutral-400 hover:text-white"}`}
                title={t('header.settings')}
              >
                <Settings size={20} />
              </button>


              {showSettings && (
                <div className="keep-open absolute right-0 top-full mt-2 w-10 h-10 opacity-0 pointer-events-none" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Push-Down Settings Drawer */}
      {/* Push-Down Settings Drawer (Desktop) / Full Screen Overlay (Mobile) */}
      {/* Push-Down Settings Drawer REMOVED */}
      {/* Settings Drawer Removed */}

      {
        showExitConfirm && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 text-center">
              <h3 className="text-xl font-bold text-white mb-2">{t('header.leaveChannel')}</h3>
              <p className="text-neutral-400 mb-6">{t('header.leaveChannelConfirm')}</p>

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
                  {t('lobby.cancel')}
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
                  {t('header.leave')}
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
              <h3 className="text-xl font-bold text-orange-500 mb-4">{t('header.share')}</h3>
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
                  title={t('header.copyUrl')}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>



              <button
                onClick={() => onShowQRCode(false)}
                className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-orange-500 border border-orange-500/20 hover:border-orange-500/50 rounded-lg transition-all font-medium"
              >
                {t('header.close')}
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
                    <LogOut size={18} /> {t('lobby.signOut')}
                  </button>

                  <div className="pt-4 border-t border-neutral-800 mt-4">
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-900/30 text-red-500 hover:bg-red-950/30 hover:border-red-900/50 transition-colors text-sm font-medium"
                    >
                      {t('lobby.deleteAccount')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center animate-in fade-in slide-in-from-bottom-2">
                  <h4 className="text-lg font-bold text-red-500 mb-2">{t('lobby.deleteAccountConfirm')}</h4>
                  <p className="text-sm text-neutral-400 mb-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('lobby.deleteAccountWarning') }} />

                  <div className="mb-6">
                    <label className="block text-xs text-neutral-500 mb-2 font-medium">
                      {t('lobby.deleteAccountType')} <span className="text-neutral-300 font-bold select-none">{t('lobby.deleteAccountPhrase')}</span> {t('lobby.deleteAccountToConfirm')}
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmationText}
                      onChange={(e) => setDeleteConfirmationText(e.target.value)}
                      className="w-full bg-black/30 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder-neutral-700 font-mono"
                      placeholder={t('header.deleteChannelType')}
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
                      {t('lobby.cancel')}
                    </button>
                    <button
                      onClick={() => {
                        console.log("Delete button clicked in Header");
                        onDeleteAccount();
                        setShowProfileModal(false);
                        setShowDeleteConfirm(false);
                        setDeleteConfirmationText("");
                      }}
                      disabled={deleteConfirmationText !== t('lobby.deleteAccountPhrase')}
                      className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 disabled:shadow-none"
                    >
                      {t('lobby.delete')}
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
  onToggleChannelLibrary: PropTypes.func,
};
