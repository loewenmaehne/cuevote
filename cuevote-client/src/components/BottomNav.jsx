import React from "react";
import PropTypes from "prop-types";
import { List, Library, X, ArrowUp, ArrowDown } from "lucide-react";
import { Language } from '../contexts/LanguageContext';

export function BottomNav({
    isLibraryTab,
    onToggleLibraryTab,
    onExitPlaylist,
    onBackToNow,
    showBackToNow,
    backToNowDirection,
}) {
    const { t } = Language.useLanguage();

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[60] safe-pb">
            <div className="mx-3 mb-3 flex items-center gap-2">
                <button
                    onClick={onToggleLibraryTab}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 shadow-lg backdrop-blur-xl ${
                        isLibraryTab
                            ? "bg-orange-500 text-white shadow-orange-500/25"
                            : "bg-neutral-900/90 text-neutral-300 border border-neutral-700/50 shadow-black/40"
                    }`}
                >
                    {isLibraryTab ? <List size={16} /> : <Library size={16} />}
                    <span>{isLibraryTab ? t('header.playlist') : t('header.library')}</span>
                </button>

                {showBackToNow && (
                    <button
                        onClick={onBackToNow}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold bg-orange-500 text-white shadow-lg shadow-orange-500/25 transition-all active:scale-95"
                    >
                        {backToNowDirection === 'up' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        <span>{t('playlist.backToNow')}</span>
                    </button>
                )}

                <div className="flex-1" />

                {onExitPlaylist && (
                    <button
                        onClick={onExitPlaylist}
                        className="p-2.5 rounded-full bg-neutral-900/90 text-neutral-400 border border-neutral-700/50 shadow-lg shadow-black/40 backdrop-blur-xl transition-all active:scale-95 hover:text-white"
                        title={t('playlist.close')}
                    >
                        <X size={18} />
                    </button>
                )}
            </div>
        </nav>
    );
}

BottomNav.propTypes = {
    isLibraryTab: PropTypes.bool,
    onToggleLibraryTab: PropTypes.func,
    onExitPlaylist: PropTypes.func,
    onBackToNow: PropTypes.func,
    showBackToNow: PropTypes.bool,
    backToNowDirection: PropTypes.string,
};
