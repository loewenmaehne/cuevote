import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Radio, Users, Sparkles, AlertCircle } from "lucide-react";
import { useWebSocket } from "../hooks/useWebSocket";

const WEBSOCKET_URL = "ws://localhost:8080";

export function Lobby() {
  const navigate = useNavigate();
  const { sendMessage, lastMessage, isConnected, lastError } = useWebSocket(WEBSOCKET_URL);
  const [rooms, setRooms] = useState([]);
  const [user, setUser] = useState(null);

  // Resume Session
  useEffect(() => {
    const token = localStorage.getItem("revibe_auth_token");
    if (isConnected && token && !user) {
        sendMessage({ type: "RESUME_SESSION", payload: { token } });
    }
  }, [isConnected, sendMessage, user]);

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
        } else if (lastMessage.type === "LOGIN_SUCCESS") {
            setUser(lastMessage.payload.user);
        }
    }
  }, [lastMessage, navigate]);

  const handleCreateRoom = () => {
      if (!user) {
          alert("Please sign in (top right corner of a room) to create a channel!");
          return;
      }
      const name = prompt("Enter channel name:");
      if (name) {
          sendMessage({ 
              type: "CREATE_ROOM", 
              payload: { 
                  name, 
                  description: `Hosted by ${user.name}`, 
                  color: "from-gray-700 to-black" 
              } 
          });
      }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center p-8">
      <header className="w-full max-w-5xl flex items-center justify-between mb-12">
        <h1 className="text-3xl font-bold text-orange-500 tracking-tight">
          ReVibe Music
        </h1>
        {user && (
            <div className="flex items-center gap-3">
                {user.picture && <img src={user.picture} className="w-8 h-8 rounded-full" alt={user.name} />}
                <span className="text-neutral-400">Welcome, {user.name}</span>
            </div>
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
        <h2 className="text-2xl font-semibold mb-6">Browse Channels</h2>
        
        {rooms.length === 0 ? (
            <div className="text-neutral-500">Loading active channels...</div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((channel) => (
                <Link
                key={channel.id}
                to={`/room/${channel.id}`}
                className="group relative overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-orange-500/50 transition-all duration-300 text-left p-6 aspect-[4/3] flex flex-col justify-end block"
                >
                <div className={`absolute inset-0 bg-gradient-to-br ${channel.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
                
                <div className="relative z-10 space-y-2 w-full">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors truncate pr-2">
                        {channel.name}
                        </h3>
                        <Radio className="text-neutral-500 group-hover:text-white transition-colors flex-shrink-0" />
                    </div>
                    <p className="text-neutral-400 text-sm line-clamp-2">{channel.description}</p>
                    
                    <div className="flex items-center gap-2 pt-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        <Users size={14} /> <span>{channel.listeners || 0} Live</span>
                    </div>
                </div>
                </Link>
            ))}
            
            <button
                onClick={handleCreateRoom}
                className={`rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-4 transition-colors w-full aspect-[4/3] ${
                    user 
                    ? "border-neutral-800 hover:border-neutral-600 text-neutral-500 hover:text-neutral-300 cursor-pointer" 
                    : "border-neutral-900 text-neutral-700 cursor-not-allowed"
                }`}
                title={user ? "Create a new channel" : "Log in to create a channel"}
            >
                <Sparkles size={32} />
                <span className="font-medium">
                    {user ? "Create Channel" : "Log in to Create"}
                </span>
            </button>
            </div>
        )}
      </main>
    </div>
  );
}
