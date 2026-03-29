CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    plan_tier TEXT NOT NULL DEFAULT 'free',
    premium_source TEXT NULL,
    premium_granted_at TIMESTAMPTZ NULL,
    premium_expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx
    ON sessions (user_id);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx
    ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
    ON password_reset_tokens (user_id);

CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx
    ON password_reset_tokens (expires_at);

CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    simulation_state JSONB NOT NULL,
    workspace_state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS plans_user_id_idx
    ON plans (user_id);

CREATE INDEX IF NOT EXISTS plans_user_id_updated_at_idx
    ON plans (user_id, updated_at DESC);
