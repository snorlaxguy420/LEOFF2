CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    iaff_local_number TEXT NOT NULL DEFAULT '',
    birth_year INTEGER NULL,
    disclaimer_accepted_at TIMESTAMPTZ NULL,
    display_name TEXT NOT NULL DEFAULT '',
    retirement_check_in_frequency TEXT NOT NULL DEFAULT 'never',
    last_retirement_check_in_sent_at TIMESTAMPTZ NULL,
    plan_tier TEXT NOT NULL DEFAULT 'free',
    premium_source TEXT NULL,
    premium_granted_at TIMESTAMPTZ NULL,
    premium_expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS retirement_check_in_frequency TEXT NOT NULL DEFAULT 'never';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_retirement_check_in_sent_at TIMESTAMPTZ NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS iaff_local_number TEXT NOT NULL DEFAULT '';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS birth_year INTEGER NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS disclaimer_accepted_at TIMESTAMPTZ NULL;

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
    share_token TEXT NULL UNIQUE,
    share_created_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS share_token TEXT NULL UNIQUE;

ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS share_created_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS plans_user_id_idx
    ON plans (user_id);

CREATE INDEX IF NOT EXISTS plans_user_id_updated_at_idx
    ON plans (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS plans_share_token_idx
    ON plans (share_token);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    bucket_key TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    identifier_hash TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL,
    count INTEGER NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_reset_at_idx
    ON rate_limit_buckets (reset_at);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_scope_identifier_idx
    ON rate_limit_buckets (scope, identifier_hash);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    actor_user_id TEXT NULL,
    target_user_id TEXT NULL,
    client_ip_hash TEXT NULL,
    email_hash TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_events_created_at_idx
    ON audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_action_created_at_idx
    ON audit_events (action, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_target_user_created_at_idx
    ON audit_events (target_user_id, created_at DESC);
