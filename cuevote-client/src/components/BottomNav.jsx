import React from "react";
import PropTypes from "prop-types";
import { List, Send, QrCode, Library, X, ArrowUp, ArrowDown } from "lucide-react";
import { Language } from '../contexts/LanguageContext';

function NavItem({ icon, label, onClick, active, muted }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all duration-200 active:scale-90 relative ${
                active
                    ? "text-orange-500"
                    : muted
                        ? "text-neutral-700"
                        : "text-neutral-400 active:text-neutral-200"
            }`}
        >
            {active && (
                <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-500" />
            )}
            {icon}
            <span className="text-[10px] font-medium tracking-wide">{label}</span>
        </button>
    );
}

NavItem.propTypes = {
    icon: PropTypes.node.isRequired,
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    active: PropTypes.bool,
    muted: PropTypes.bool,
};

export function BottomNav({
    isPlaylistView,
    isLibraryTab,
    onTogglePlaylistView,
    onToggleSuggest,
    onShare,
    onToggleLibraryTab,
    onExitPlaylist,
    onBackToNow,
    showBackToNow,
    backToNowDirection,
    showSuggest,
    suggestionsEnabled,
    isOwner,
    ownerBypass,
}) {
    const { t } = Language.useLanguage();
    const effectiveIsOwner = isOwner && ownerBypass;
    const suggestDisabled = !suggestionsEnabled && !effectiveIsOwner;

    if (isPlaylistView) {
        return (
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[60] safe-pb">
                <div className="mx-2 mb-2 rounded-2xl bg-neutral-900/90 backdrop-blur-2xl border border-neutral-800/60 shadow-[0_-4px_30px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="flex items-stretch">
                        <NavItem
                            icon={isLibraryTab ? <List size={20} strokeWidth={2.2} /> : <Library size={20} strokeWidth={2.2} />}
                            label={isLibraryTab ? t('header.playlist') : t('header.library')}
                            onClick={onToggleLibraryTab}
                            active={isLibraryTab}
                        />

                        {showBackToNow && (
                            <NavItem
                                icon={backToNowDirection === 'up' ? <ArrowUp size={20} strokeWidth={2.2} /> : <ArrowDown size={20} strokeWidth={2.2} />}
                                label={t('playlist.backToNow')}
                                onClick={onBackToNow}
                                active
                            />
                        )}

                        {onExitPlaylist && (
                            <NavItem
                                icon={<X size={20} strokeWidth={2.2} />}
                                label={t('playlist.close')}
                                onClick={onExitPlaylist}
                            />
                        )}
                    </div>
                </div>
            </nav>
        );
    }

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[60] safe-pb">
            <div className="mx-2 mb-2 rounded-2xl bg-neutral-900/90 backdrop-blur-2xl border border-neutral-800/60 shadow-[0_-4px_30px_rgba(0,0,0,0.5)] overflow-hidden">
                <div className="flex items-stretch">
                    <NavItem
                        icon={<List size={20} strokeWidth={2.2} />}
                        label={t('header.playlist')}
                        onClick={onTogglePlaylistView}
                    />

                    <NavItem
                        icon={<Send size={20} strokeWidth={2.2} />}
                        label={t('header.suggest')}
                        onClick={onToggleSuggest}
                        active={showSuggest}
                        muted={suggestDisabled}
                    />

                    <NavItem
                        icon={<QrCode size={20} strokeWidth={2.2} />}
                        label={t('header.share')}
                        onClick={onShare}
                    />
                </div>
            </div>
        </nav>
    );
}

BottomNav.propTypes = {
    isPlaylistView: PropTypes.bool,
    isLibraryTab: PropTypes.bool,
    onTogglePlaylistView: PropTypes.func,
    onToggleSuggest: PropTypes.func,
    onShare: PropTypes.func,
    onToggleLibraryTab: PropTypes.func,
    onExitPlaylist: PropTypes.func,
    onBackToNow: PropTypes.func,
    showBackToNow: PropTypes.bool,
    backToNowDirection: PropTypes.string,
    showSuggest: PropTypes.bool,
    suggestionsEnabled: PropTypes.bool,
    isOwner: PropTypes.bool,
    ownerBypass: PropTypes.bool,
};
