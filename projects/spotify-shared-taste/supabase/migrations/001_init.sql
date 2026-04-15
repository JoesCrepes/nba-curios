-- Lobbies
CREATE TABLE lobbies (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  status     TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'done'))
);

-- Participants (non-sensitive columns — safe to expose via Realtime)
CREATE TABLE participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id     TEXT NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  is_organizer BOOLEAN DEFAULT false,
  connected_at TIMESTAMPTZ,
  track_count  INT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Participant tokens + track data (sensitive — never exposed to browser)
CREATE TABLE participant_secrets (
  participant_id UUID PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
  access_token   TEXT NOT NULL,
  refresh_token  TEXT NOT NULL,
  tracks         JSONB NOT NULL DEFAULT '[]'
);

-- Short-lived OAuth nonces for CSRF protection
CREATE TABLE oauth_nonces (
  nonce          TEXT PRIMARY KEY,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  lobby_code     TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Auto-delete nonces older than 10 minutes (requires pg_cron or handle in app)
-- For simplicity, the callback handler deletes nonces on use.

-- RLS: participants table is readable by anyone (for Realtime)
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read participants" ON participants FOR SELECT USING (true);

-- RLS: lobbies readable by anyone
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read lobbies" ON lobbies FOR SELECT USING (true);

-- RLS: secrets and nonces — no anon access
ALTER TABLE participant_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_nonces ENABLE ROW LEVEL SECURITY;

-- Enable Realtime for participants (so lobby page updates live)
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
