import React from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Users, Sparkles } from "lucide-react";

const DEFAULT_CHANNELS = [
  { id: "synthwave", name: "Synthwave", description: "Retro beats and neon lights", color: "from-purple-500 to-pink-600" },
  { id: "lofi", name: "Lofi", description: "Chill beats to study/relax to", color: "from-green-400 to-cyan-500" },
  { id: "pop", name: "Pop", description: "Top 40 and popular hits", color: "from-yellow-400 to-orange-500" },
  { id: "the-super-long-synthwave-station-for-testing-marquee-effect", name: "The Super Long Synthwave Station for Testing Marquee Effect", description: "Testing long text scrolling", color: "from-blue-500 to-indigo-600" },
];

export function Lobby() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center p-8">
      <header className="w-full max-w-5xl flex items-center justify-between mb-12">
        <h1 className="text-3xl font-bold text-orange-500 tracking-tight">
          ReVibe Music
        </h1>
        {/* Add User/Login logic here later if needed in Lobby */}
      </header>

      <main className="w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6">Browse Channels</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEFAULT_CHANNELS.map((channel) => (
            <button
              key={channel.id}
              onClick={() => navigate(`/room/${channel.id}`)}
              className="group relative overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-orange-500/50 transition-all duration-300 text-left p-6 aspect-[4/3] flex flex-col justify-end"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${channel.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
              
              <div className="relative z-10 space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors">
                    {channel.name}
                    </h3>
                    <Radio className="text-neutral-500 group-hover:text-white transition-colors" />
                </div>
                <p className="text-neutral-400 text-sm">{channel.description}</p>
                
                <div className="flex items-center gap-2 pt-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    <Users size={14} /> <span>Live Now</span>
                </div>
              </div>
            </button>
          ))}
          
          <button
            onClick={() => alert("Custom channels coming soon!")}
            className="rounded-2xl border-2 border-dashed border-neutral-800 hover:border-neutral-600 transition-colors p-6 flex flex-col items-center justify-center gap-4 text-neutral-500 hover:text-neutral-300"
          >
            <Sparkles size={32} />
            <span className="font-medium">Create Channel</span>
          </button>
        </div>
      </main>
    </div>
  );
}
