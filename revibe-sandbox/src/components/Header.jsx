import React from "react";
import PropTypes from "prop-types";
import { useGoogleLogin } from '@react-oauth/google';
import { Radio, Send, LogOut } from "lucide-react";

export function Header({
  activeChannel,
  onGoHome,
  onShowSuggest,
  user,
  onLoginSuccess,
  onLogout,
}) {
  const headerRef = React.useRef(null);

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
            }}
            className="keep-open flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors truncate"
            >
            <Send size={18} /> <span className="hidden sm:inline">Suggest</span>
            </button>
        </div>
      </div>
    </header>
  );
}

Header.propTypes = {
  activeChannel: PropTypes.string.isRequired,
  onGoHome: PropTypes.func.isRequired,
  onShowSuggest: PropTypes.func.isRequired,
  user: PropTypes.object,
  onLoginSuccess: PropTypes.func,
  onLogout: PropTypes.func,
};
