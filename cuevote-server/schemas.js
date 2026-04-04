const { z } = require('zod');

const LoginPayload = z.object({
  token: z.string().min(1).max(4096),
});

const ResumeSessionPayload = z.object({
  token: z.string().min(1).max(256),
});

const LogoutPayload = z.object({
  token: z.string().min(1).max(256),
});

const JoinRoomPayload = z.object({
  roomId: z.string().min(1).max(200),
  password: z.string().max(200).optional(),
});

const CreateRoomPayload = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().max(100).optional(),
  isPrivate: z.boolean().optional(),
  password: z.string().max(200).optional(),
  captionsEnabled: z.boolean().optional(),
  languageFlag: z.string().max(50).optional(),
  musicSource: z.enum(['youtube', 'spotify']).optional(),
});

const ListRoomsPayload = z.object({
  type: z.enum(['public', 'private', 'my_channels']).optional(),
}).optional();

const SuggestSongPayload = z.object({
  query: z.string().min(1).max(500),
});

const VotePayload = z.object({
  trackId: z.string().min(1).max(100),
  voteType: z.enum(['up', 'down']),
});

const SeekToPayload = z.number().finite().nonnegative();

const UpdateSettingsPayload = z.object({
  suggestionsEnabled: z.boolean().optional(),
  musicOnly: z.boolean().optional(),
  maxDuration: z.number().int().min(0).max(86400).optional(),
  allowPrelisten: z.boolean().optional(),
  ownerBypass: z.boolean().optional(),
  maxQueueSize: z.number().int().min(0).max(1000).optional(),
  smartQueue: z.boolean().optional(),
  playlistViewMode: z.boolean().optional(),
  suggestionMode: z.enum(['auto', 'manual']).optional(),
  ownerPopups: z.boolean().optional(),
  duplicateCooldown: z.number().int().min(0).max(1000).optional(),
  ownerQueueBypass: z.boolean().optional(),
  votesEnabled: z.boolean().optional(),
  autoApproveKnown: z.boolean().optional(),
  autoRefill: z.boolean().optional(),
  captionsEnabled: z.boolean().optional(),
  musicSource: z.enum(['youtube', 'spotify']).optional(),
}).refine(obj => Object.keys(obj).length > 0, {
  message: 'At least one setting must be provided',
});

const TrackIdPayload = z.object({
  trackId: z.string().min(1).max(100),
});

const VideoIdPayload = z.object({
  videoId: z.string().min(1).max(50).optional(),
  trackId: z.string().min(1).max(100).optional(),
}).refine(obj => obj.videoId || obj.trackId, {
  message: 'Either videoId or trackId must be provided',
});

const FetchSuggestionsPayload = z.object({
  videoId: z.string().min(1).max(50).optional(),
  trackId: z.string().min(1).max(100).optional(),
  title: z.string().max(500).optional(),
  artist: z.string().max(500).optional(),
}).refine(obj => obj.videoId || obj.trackId, {
  message: 'Either videoId or trackId must be provided',
});

const UpdateDurationPayload = z.number().finite().positive().max(86400);

const PlayPausePayload = z.boolean();

const WebSocketMessage = z.object({
  type: z.string().min(1).max(50),
  payload: z.any().optional(),
  msgId: z.string().max(100).optional(),
});

module.exports = {
  LoginPayload,
  ResumeSessionPayload,
  LogoutPayload,
  JoinRoomPayload,
  CreateRoomPayload,
  ListRoomsPayload,
  SuggestSongPayload,
  VotePayload,
  SeekToPayload,
  UpdateSettingsPayload,
  TrackIdPayload,
  VideoIdPayload,
  FetchSuggestionsPayload,
  UpdateDurationPayload,
  PlayPausePayload,
  WebSocketMessage,
};
