export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  role?: 'admin' | 'mod' | 'user';
  created_at?: number;
}

export interface Session {
  token: string;
  user_id: string;
  expires_at: number;
  name?: string;
  email?: string;
  picture?: string;
  role?: string;
}

export interface RoomData {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  is_public?: number;
  password?: string | null;
  last_active_at?: number;
  created_at?: number;
  color?: string;
  captions_enabled?: number;
  auto_refill?: number;
  language_flag?: string;
  lobby_preview?: string | null;
}

export interface Video {
  id: string;
  title: string | null;
  artist: string | null;
  thumbnail: string | null;
  duration: number | null;
  category_id: string | null;
  language: string | null;
  fetched_at?: number;
}

export interface Track {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  score: number;
  voters: Record<string, 'up' | 'down'>;
  suggestedBy: string | null;
  suggestedByUsername: string;
  language?: string | null;
  isOwnerPriority?: boolean;
  startedAt?: number;
  playedAt?: number;
  category_id?: string;
}

export interface RoomState {
  roomId: string;
  queue: Track[];
  history: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  activeChannel: string;
  ownerId: string | null;
  suggestionsEnabled: boolean;
  musicOnly: boolean;
  maxDuration: number;
  allowPrelisten: boolean;
  ownerBypass: boolean;
  ownerQueueBypass: boolean;
  votesEnabled: boolean;
  smartQueue: boolean;
  ownerPopups: boolean;
  playlistViewMode: boolean;
  maxQueueSize: number;
  suggestionMode: 'auto' | 'manual';
  pendingSuggestions: Track[];
  duplicateCooldown: number;
  autoApproveKnown: boolean;
  autoRefill: boolean;
  captionsEnabled: boolean;
  bannedVideos: BannedVideo[];
  isRefilling?: boolean;
}

export interface BannedVideo {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  bannedAt: number;
}

export interface RoomMetadata {
  description: string;
  color: string;
  owner_id: string;
  is_public: number;
  password: string | null;
  captions_enabled: number;
  language_flag: string;
}

export interface RoomSettings {
  captions_enabled?: boolean;
  auto_refill?: boolean;
  language_flag?: string;
}

export interface HistoryTrack extends Video {
  videoId: string;
  playedAt: number;
  played_at?: number;
}

export interface RoomSummary {
  id: string;
  name: string;
  description: string;
  color: string;
  listeners: number;
  currentTrack: { thumbnail: string; title: string; artist: string } | null;
  isActive: boolean;
  language_flag: string;
  is_protected?: boolean;
}

export interface SavedRoomState {
  queue: Track[];
  currentTrack: Track | null;
  progress: number;
  isPlaying: boolean;
}

export interface WebSocketClient extends WebSocket {
  id: string;
  roomId?: string;
  lastRoomId?: string;
  user?: User;
  isAlive?: boolean;
  _msgCount?: number;
  _msgWindowStart?: number;
  lastSuggestionTime?: number;
}
