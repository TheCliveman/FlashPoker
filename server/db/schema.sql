-- Basic persistence for Poker Club
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  chips INTEGER NOT NULL DEFAULT 5000
);

CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  variant TEXT NOT NULL,
  max_seats INTEGER NOT NULL,
  speed TEXT NOT NULL,
  straddle_mode TEXT,
  blind_levels JSONB NOT NULL,
  hand_no INTEGER NOT NULL DEFAULT 0,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat INTEGER,
  sitting BOOLEAN NOT NULL DEFAULT FALSE,
  stack INTEGER NOT NULL DEFAULT 0,
  folded BOOLEAN NOT NULL DEFAULT FALSE,
  all_in BOOLEAN NOT NULL DEFAULT FALSE,
  round_committed INTEGER NOT NULL DEFAULT 0,
  total_committed INTEGER NOT NULL DEFAULT 0,
  timebanks INTEGER NOT NULL DEFAULT 3,
  cards TEXT[],
  PRIMARY KEY (table_id, user_id)
);
-- Indexes
CREATE INDEX IF NOT EXISTS idx_players_table ON players(table_id);


-- Hand histories
CREATE TABLE IF NOT EXISTS hands (
  id BIGSERIAL PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  hand_no INTEGER NOT NULL,
  variant TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  board TEXT[],
  pots JSONB,
  winners JSONB
);

CREATE TABLE IF NOT EXISTS actions (
  id BIGSERIAL PRIMARY KEY,
  hand_id BIGINT NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT,
  seat INTEGER,
  street TEXT,
  action TEXT NOT NULL,
  amount INTEGER,
  info JSONB
);

CREATE INDEX IF NOT EXISTS idx_actions_hand ON actions(hand_id);


-- Join tokens for invite links
CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  max_uses INTEGER NOT NULL DEFAULT 100,
  used_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_invites_table ON invites(table_id);
