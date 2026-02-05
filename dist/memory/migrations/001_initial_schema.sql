-- Migration 001: Initial schema
-- Captures the original Shipyard Memory schema as the first migration.

CREATE TABLE IF NOT EXISTS exchanges (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    project_path TEXT,
    user_message TEXT NOT NULL,
    assistant_message TEXT NOT NULL,
    tool_names TEXT,
    timestamp INTEGER NOT NULL,
    git_branch TEXT,
    source_file TEXT,
    line_start INTEGER,
    line_end INTEGER,
    embedding BLOB,
    indexed_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_exchanges USING vec0(
    id TEXT PRIMARY KEY,
    embedding FLOAT[384]
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_path TEXT,
    started_at INTEGER NOT NULL,
    exchange_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS import_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exchanges_timestamp ON exchanges(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_exchanges_session ON exchanges(session_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_project ON exchanges(project_path);
CREATE INDEX IF NOT EXISTS idx_exchanges_git_branch ON exchanges(git_branch);

INSERT OR IGNORE INTO import_state (key, value) VALUES ('import_completed', 'false');
