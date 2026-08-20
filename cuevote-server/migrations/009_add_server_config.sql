-- Small key/value store for server-side values that must survive a restart but
-- do not belong in .env — currently the HMAC secret that signs guest tokens,
-- generated on first use when GUEST_TOKEN_SECRET is not configured.
CREATE TABLE IF NOT EXISTS server_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);
