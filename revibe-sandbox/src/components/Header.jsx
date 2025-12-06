import React from "react";
import PropTypes from "prop-types";
import { useGoogleLogin } from '@react-oauth/google';
import { Radio, Send, Sparkles, LogOut, LogIn } from "lucide-react";

export function Header({
  activeChannel,
  onChannelChange,
  onShowSuggest,
  showChannels,
  onShowChannels,
  channels,
  onJoinChannel,
  user,
  onLoginSuccess,
  onLogout,
}) {
  const headerRef = React.useRef(null);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
        try {
            const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            const data = await userInfo.json();
            // Map Google API response to our user format
            onLoginSuccess({
                name: data.name,
                email: data.email,
                picture: data.picture,
                sub: data.sub
            });
        } catch (error) {
            console.error("Failed to fetch user info:", error);
        }
    },
    onError: () => console.log('Login Failed'),
  });

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
      className="sticky top-0 p-4 border-b border-neutral-900 bg-[#050505]/95 backdrop-blur-md z-40 transition-all duration-700 ease-in-out flex flex-col items-center gap-3"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4">
        <div className="flex items-center gap-3 justify-start min-w-0">
            {/* Fixed width container for User Slot to prevent layout shift of subsequent items */}
            <div className="w-[40px] lg:w-[180px] flex items-center flex-shrink-0 transition-all duration-300">
                {user ? (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            {user.picture && (
                                <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-neutral-700" />
                            )}
                            <span className="text-sm font-medium text-neutral-300 hidden lg:block truncate max-w-[120px]">{user.name}</span>
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

            <button
            onClick={(event) => {
                event.stopPropagation();
                onShowChannels((prev) => !prev);
                onShowSuggest(false);
            }}
            className="keep-open flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors flex-shrink-0"
            >
            <Radio size={22} /> 
            <span className="hidden md:inline truncate">{activeChannel}</span>
            </button>
        </div>

        <h1 className="text-2xl font-bold text-orange-500 tracking-tight whitespace-nowrap">
          ReVibe Music
        </h1>

        <div className="flex justify-end min-w-0">
            <button
            onClick={(event) => {
                event.stopPropagation();
                onShowSuggest((prev) => !prev);
                onShowChannels(false);
            }}
            className="keep-open flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors truncate"
            >
            <Send size={18} /> <span className="hidden sm:inline">Suggest Song</span>
            </button>
        </div>
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
  user: PropTypes.object,
  onLoginSuccess: PropTypes.func,
  onLogout: PropTypes.func,
};
