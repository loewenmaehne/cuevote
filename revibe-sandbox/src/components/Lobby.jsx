import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Radio, Users, Sparkles, AlertCircle, X, LogOut, Search } from "lucide-react";
import { useWebSocketContext } from "../hooks/useWebSocketContext";
import { useGoogleLogin } from '@react-oauth/google';

export function Lobby() {
    const navigate = useNavigate();
    const { sendMessage, lastMessage, isConnected, lastError, user, handleLoginSuccess, handleLogout } = useWebSocketContext();
    const [rooms, setRooms] = useState([]);
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [newRoomName, setNewRoomName] = useState("");
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [columns, setColumns] = useState(4); // Default to 4 for lg screens
    const [searchQuery, setSearchQuery] = useState("");

    const login = useGoogleLogin({
        onSuccess: (tokenResponse) => {
            handleLoginSuccess(tokenResponse);
        },
        onError: () => console.log('Login Failed'),
    });

    // Handle Messages
    useEffect(() => {
        if (isConnected) {
            sendMessage({ type: "LIST_ROOMS" });
        }
    }, [isConnected, sendMessage]);

    useEffect(() => {
        if (lastMessage) {
            if (lastMessage.type === "ROOM_LIST") {
                setRooms(lastMessage.payload);
            } else if (lastMessage.type === "ROOM_CREATED") {
                navigate(`/room/${lastMessage.payload.id}`);
            }
        }
    }, [lastMessage, navigate]);

    // Handle column resize
    useEffect(() => {
        const updateColumns = () => {
            if (window.innerWidth >= 1024) setColumns(4);
            else if (window.innerWidth >= 768) setColumns(3);
            else setColumns(2);
        };

        updateColumns();
        window.addEventListener('resize', updateColumns);
        return () => window.removeEventListener('resize', updateColumns);
    }, []);

    // Filter rooms based on search
    const filteredRooms = rooms.filter(room =>
        room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Handle Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isCreatingRoom) return; // Don't navigate if modal is open
            if (document.activeElement.tagName === 'INPUT') {
                if (e.key === 'Escape') {
                    e.target.blur();
                    return;
                }
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault();
                    document.activeElement.blur();
                    setFocusedIndex(0); // Move focus to Create Button
                    return;
                }
                return; // Let user type in search
            }

            // Total items = create button (1) + filtered rooms
            const totalItems = 1 + filteredRooms.length;

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                setFocusedIndex(prev => Math.min(prev + 1, totalItems - 1));
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setFocusedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocusedIndex(prev => {
                    // If we were at -1 (nothing focused), go to 0
                    if (prev === -1) return 0;
                    return Math.min(prev + columns, totalItems - 1);
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocusedIndex(prev => {
                    // If in the top row, move focus to search
                    if (prev < columns) {
                        document.getElementById('channel-search')?.focus();
                        return -1;
                    }
                    return Math.max(prev - columns, 0);
                });
            } else if (e.key === 'Enter') {
                if (focusedIndex >= 0 && focusedIndex < totalItems) {
                    e.preventDefault();
                    if (focusedIndex === 0) {
                        // Create Room (Index 0)
                        handleCreateRoomClick();
                    } else {
                        // Join Room (Index > 0, so mapped to filteredRooms[index - 1])
                        const roomToJoin = filteredRooms[focusedIndex - 1];
                        if (roomToJoin) {
                            navigate(`/room/${roomToJoin.id}`);
                        }
                    }
                }
            } else if (e.key === '/' || (e.ctrlKey && e.key === 'f') || (e.metaKey && e.key === 'k')) {
                // Focus search
                e.preventDefault();
                document.getElementById('channel-search')?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredRooms, columns, focusedIndex, isCreatingRoom, navigate]);

    // Reset focused index when filtered rooms change
    useEffect(() => {
        setFocusedIndex(0);
    }, [filteredRooms.length]);


    // Auto-scroll to focused item
    useEffect(() => {
        if (focusedIndex >= 0) {
            const element = document.getElementById(`lobby-item-${focusedIndex}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [focusedIndex]);

    const handleCreateRoomClick = () => {
        if (!user) {
            alert("Please sign in (top right corner of a room) to create a channel!");
            return;
        }
        setIsCreatingRoom(true);
    };

    const submitCreateRoom = (e) => {
        e.preventDefault();
        if (!newRoomName.trim()) return;

        sendMessage({
            type: "CREATE_ROOM",
            payload: {
                name: newRoomName,
                description: `Hosted by ${user.name}`,
                color: "from-gray-700 to-black"
            }
        });
        setIsCreatingRoom(false);
        setNewRoomName("");
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center p-8">
            <header className="w-full max-w-5xl flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-orange-500 tracking-tight">
                    ReVibe Music
                </h1>
                {user ? (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            {user.picture && <img src={user.picture} className="w-8 h-8 rounded-full border border-neutral-700" alt={user.name} />}
                            <span className="text-neutral-400 font-medium">Welcome, {user.name}</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-neutral-500 hover:text-red-400 transition-colors p-2"
                            title="Logout"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => login()}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-medium transition-all active:scale-95"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12.48 10.92V13.48H16.66C16.47 14.39 15.48 16.03 12.48 16.03C9.82 16.03 7.65 13.84 7.65 11.13C7.65 8.43 9.82 6.23 12.48 6.23C13.99 6.23 15.02 6.88 15.6 7.43L17.47 5.62C16.18 4.42 14.47 3.69 12.48 3.69C8.45 3.69 5.19 7.03 5.19 11.13C5.19 15.23 8.45 18.57 12.48 18.57C16.68 18.57 19.47 15.61 19.47 11.51C19.47 11.14 19.43 10.91 19.37 10.54L12.48 10.92Z" />
                        </svg>
                        Sign in with Google
                    </button>
                )}
            </header>

            {lastError && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounceIn">
                    <div className="bg-red-900/90 border border-red-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md">
                        <AlertCircle size={20} className="text-red-400" />
                        <span className="font-medium">{lastError}</span>
                    </div>
                </div>
            )}

            <main className="w-full max-w-5xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <h2 className="text-2xl font-semibold">Browse Channels</h2>

                    {/* Search Bar */}
                    <div className="relative w-full md:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-neutral-500" />
                        </div>
                        <input
                            id="channel-search"
                            type="text"
                            className="bg-neutral-900 border border-neutral-800 text-white text-sm rounded-xl block w-full pl-10 p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-neutral-500 transition-all"
                            placeholder="Search channels..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {!isConnected ? (
                    <div className="flex flex-col items-center gap-4 text-neutral-500 animate-pulse">
                        <Radio className="w-12 h-12" />
                        <span>Connecting to server...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                        {/* Create Room Button - Always First */}
                        <button
                            id="lobby-item-0"
                            onClick={() => {
                                handleCreateRoomClick();
                                setFocusedIndex(0);
                            }}
                            onMouseEnter={() => setFocusedIndex(0)}
                            className={`scroll-mt-56 scroll-mb-24 rounded-2xl border p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300 w-full aspect-[4/3] order-first ${focusedIndex === 0
                                ? "border-orange-500 ring-2 ring-orange-500/50 scale-[1.02] bg-neutral-800/50"
                                : user
                                    ? "border-neutral-800 text-neutral-500 cursor-pointer"
                                    : "border-neutral-900 text-neutral-700 cursor-not-allowed"
                                }`}
                            title={user ? "Create a new channel" : "Log in to create a channel"}
                        >
                            <Sparkles size={32} className={focusedIndex === 0 ? "text-orange-500" : ""} />
                            <span className={`font-medium ${focusedIndex === 0 ? "text-white" : ""}`}>
                                {user ? "Create Channel" : "Log in to Create"}
                            </span>
                        </button>

                        {/* Filtered Rooms */}
                        {filteredRooms.length === 0 && searchQuery && (
                            <div className="col-span-full text-center text-neutral-500 py-12 flex flex-col items-center">
                                <Search className="w-8 h-8 mb-2 opacity-50" />
                                <p>No channels found matching "{searchQuery}"</p>
                            </div>
                        )}

                        {filteredRooms.map((channel, i) => {
                            // Adjust index for mapping because Create Button is 0
                            const actualIndex = i + 1;

                            return (
                                <Link
                                    key={channel.id}
                                    id={`lobby-item-${actualIndex}`}
                                    to={`/room/${channel.id}`}
                                    onMouseEnter={() => setFocusedIndex(actualIndex)}
                                    className={`scroll-mt-56 scroll-mb-24 group relative overflow-hidden rounded-2xl bg-neutral-900 border transition-all duration-300 text-left p-6 aspect-[4/3] flex flex-col justify-end block ${actualIndex === focusedIndex
                                        ? "border-orange-500 ring-2 ring-orange-500/50 scale-[1.02] z-10"
                                        : "border-neutral-800"
                                        }`}
                                    onClick={() => setFocusedIndex(actualIndex)}
                                >
                                    <div className="absolute inset-0">
                                        {channel.currentTrack?.thumbnail ? (
                                            <>
                                                <img
                                                    src={channel.currentTrack.thumbnail}
                                                    alt={channel.name}
                                                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500 scale-105 group-hover:scale-110 transform transition-transform"
                                                />
                                                <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors duration-500" />
                                            </>
                                        ) : (
                                            <div className={`absolute inset-0 bg-gradient-to-br ${channel.color} opacity-20 group-hover:opacity-30 transition-opacity duration-500`} />
                                        )}
                                    </div>

                                    <div className="relative z-10 space-y-2 w-full">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0 pr-2">
                                                {actualIndex === focusedIndex && channel.name.length > 20 ? (
                                                    <div className="overflow-hidden whitespace-nowrap w-full mask-linear-fade">
                                                        <span className="animate-billboard inline-block pl-0">
                                                            <h3 className="text-2xl font-bold text-orange-400 inline">
                                                                {channel.name}&nbsp;&nbsp;&nbsp;&nbsp;{channel.name}&nbsp;&nbsp;&nbsp;&nbsp;
                                                            </h3>
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <h3 className={`text-2xl font-bold transition-colors truncate ${actualIndex === focusedIndex ? "text-orange-400" : "text-white"}`}>
                                                        {channel.name}
                                                    </h3>
                                                )}
                                            </div>
                                            <Radio className={`transition-colors flex-shrink-0 ${actualIndex === focusedIndex ? "text-white" : "text-neutral-500"}`} />
                                        </div>
                                        <p className="text-neutral-400 text-sm line-clamp-2">{channel.description}</p>

                                        <div className="flex items-center gap-2 pt-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                                            <Users size={14} /> <span>{channel.listeners || 0} Live</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Create Room Modal */}
            {
                isCreatingRoom && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white">Create New Channel</h3>
                                <button onClick={() => setIsCreatingRoom(false)} className="text-neutral-500 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={submitCreateRoom} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1">Channel Name</label>
                                    <input
                                        type="text"
                                        value={newRoomName}
                                        onChange={(e) => setNewRoomName(e.target.value)}
                                        placeholder="e.g. Late Night Vibes"
                                        className="w-full bg-[#050505] border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                                        autoFocus
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreatingRoom(false)}
                                        className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!newRoomName.trim()}
                                        className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold hover:from-orange-400 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Create Channel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
