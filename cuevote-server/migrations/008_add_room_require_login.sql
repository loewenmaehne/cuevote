-- Whether a room requires a signed-in Google account to vote and suggest.
-- 0 (default) lets room-scoped guests take part; the owner can turn it on per
-- room. Owner-only controls are unaffected — those always need the account that
-- owns the room.
ALTER TABLE rooms ADD COLUMN require_login INTEGER DEFAULT 0;
