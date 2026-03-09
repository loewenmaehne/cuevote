import React from "react";
import PropTypes from "prop-types";
import { List, Send, Share2, Library, X, ArrowUp, ArrowDown } from "lucide-react";
import { Language } from '../contexts/LanguageContext';

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
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-neutral-800 safe-pb">
                <div className="flex items-stretch">
                    <button
                        onClick={onToggleLibraryTab}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors active:scale-95 ${
                            isLibraryTab ? "text-orange-500" : "text-neutral-500"
                        }`}
                    >
                        <Library size={20} />
                        <span className="text-[10px] font-semibold">{t('header.library')}</span>
                    </button>

                    {showBackToNow && (
                        <button
                            onClick={onBackToNow}
                            className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-orange-500 transition-colors active:scale-95"
                        >
                            {backToNowDirection === 'up' ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
                            <span className="text-[10px] font-semibold">{t('playlist.backToNow')}</span>
                        </button>
                    )}

                    {onExitPlaylist && (
                        <button
                            onClick={onExitPlaylist}
                            className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-neutral-500 transition-colors active:scale-95"
                        >
                            <X size={20} />
                            <span className="text-[10px] font-semibold">{t('playlist.close')}</span>
                        </button>
                    )}
                </div>
            </nav>
        );
    }

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-[#050505]/95 backdrop-blur-xl border-t border-neutral-800 safe-pb">
            <div className="flex items-stretch">
                <button
                    onClick={onTogglePlaylistView}
                    className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-neutral-500 transition-colors active:scale-95"
                >
                    <List size={20} />
                    <span className="text-[10px] font-semibold">{t('header.playlist')}</span>
                </button>

                <button
                    onClick={onToggleSuggest}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors active:scale-95 ${
                        showSuggest
                            ? "text-orange-500"
                            : suggestDisabled
                                ? "text-neutral-700"
                                : "text-neutral-500"
                    }`}
                >
                    <Send size={20} />
                    <span className="text-[10px] font-semibold">{t('header.suggest')}</span>
                </button>

                <button
                    onClick={onShare}
                    className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-neutral-500 transition-colors active:scale-95"
                >
                    <Share2 size={20} />
                    <span className="text-[10px] font-semibold">{t('header.share')}</span>
                </button>
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
