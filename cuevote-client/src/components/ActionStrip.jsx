import React from "react";
import PropTypes from "prop-types";
import { List, Send, QrCode, Library, X } from "lucide-react";
import { Language } from '../contexts/LanguageContext';

function Pill({ icon, label, onClick, active, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all active:scale-95 flex-shrink-0 ${
                active
                    ? "bg-orange-500/15 text-orange-500 border border-orange-500/30"
                    : disabled
                        ? "text-neutral-600 border border-neutral-800/50"
                        : "bg-neutral-800/80 text-neutral-300 border border-neutral-700/50 hover:text-white hover:bg-neutral-700/80"
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

Pill.propTypes = {
    icon: PropTypes.node.isRequired,
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    active: PropTypes.bool,
    disabled: PropTypes.bool,
};

export function ActionStrip({
    mode,
    onPlaylist,
    onSuggest,
    onShare,
    onLibrary,
    onClosePlaylist,
    showSuggest,
    suggestionsEnabled,
    isOwner,
    ownerBypass,
    playlistViewMode,
}) {
    const { t } = Language.useLanguage();
    const effectiveIsOwner = isOwner && ownerBypass;
    const suggestDisabled = !suggestionsEnabled && !effectiveIsOwner;

    if (mode === "playlist") {
        return (
            <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar">
                <Pill
                    icon={<List size={16} />}
                    label={t('header.playlist')}
                    onClick={onPlaylist}
                    active
                />
                <Pill
                    icon={<Library size={16} />}
                    label={t('header.library')}
                    onClick={onLibrary}
                />
                <div className="flex-1 min-w-2" />
                {onClosePlaylist && (
                    <Pill
                        icon={<X size={16} />}
                        label={t('playlist.close')}
                        onClick={onClosePlaylist}
                    />
                )}
            </div>
        );
    }

    if (mode === "library") {
        return (
            <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar">
                <Pill
                    icon={<List size={16} />}
                    label={t('header.playlist')}
                    onClick={onPlaylist}
                />
                <Pill
                    icon={<Library size={16} />}
                    label={t('header.library')}
                    onClick={onLibrary}
                    active
                />
                <div className="flex-1 min-w-2" />
                {onClosePlaylist && (
                    <Pill
                        icon={<X size={16} />}
                        label={t('playlist.close')}
                        onClick={onClosePlaylist}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar">
            {!(playlistViewMode && !isOwner) && (
                <Pill
                    icon={<List size={16} />}
                    label={t('header.playlist')}
                    onClick={onPlaylist}
                />
            )}
            <Pill
                icon={<Send size={16} />}
                label={t('header.suggest')}
                onClick={onSuggest}
                active={showSuggest}
                disabled={suggestDisabled}
            />
            <Pill
                icon={<QrCode size={16} />}
                label={t('header.share')}
                onClick={onShare}
            />
        </div>
    );
}

ActionStrip.propTypes = {
    mode: PropTypes.oneOf(["default", "playlist", "library"]).isRequired,
    onPlaylist: PropTypes.func,
    onSuggest: PropTypes.func,
    onShare: PropTypes.func,
    onLibrary: PropTypes.func,
    onClosePlaylist: PropTypes.func,
    showSuggest: PropTypes.bool,
    suggestionsEnabled: PropTypes.bool,
    isOwner: PropTypes.bool,
    ownerBypass: PropTypes.bool,
    playlistViewMode: PropTypes.bool,
};
