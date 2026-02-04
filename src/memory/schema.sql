-- Shipyard Memory Database Schema
-- SQLite with sqlite-vec extension for vector similarity search

-- Core exchanges table
CREATE TABLE IF NOT EXISTS exchanges (
    id TEXT PRIMARY KEY,                    -- MD5 hash of source file + line range
    session_id TEXT NOT NULL,               -- Groups exchanges within a session
    project_path TEXT,                      -- Absolute path of project
    user_message TEXT NOT NULL,             -- Full user message text
    assistant_message TEXT NOT NULL,        -- Full assistant response text
    tool_names TEXT,                        -- JSON array of tool names used
    timestamp INTEGER NOT NULL,             -- Unix timestamp of exchange
    git_branch TEXT,                        -- Git branch at time of exchange
    source_file TEXT,                       -- Path to source JSONL file
    line_start INTEGER,                     -- Starting line in source
    line_end INTEGER,                       -- Ending line in source
    embedding BLOB,                         -- 384-dim float32 embedding
    indexed_at INTEGER NOT NULL             -- When this exchange was indexed
);

-- Virtual table for vector similarity search via sqlite-vec
CREATE VIRTUAL TABLE IF NOT EXISTS vec_exchanges USING vec0(
    id TEXT PRIMARY KEY,
    embedding FLOAT[384]
);

-- Sessions table for tracking import state
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_path TEXT,
    started_at INTEGER NOT NULL,
    exchange_count INTEGER DEFAULT 0
);

-- Import tracking
CREATE TABLE IF NOT EXISTS import_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_exchanges_timestamp ON exchanges(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_exchanges_session ON exchanges(session_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_project ON exchanges(project_path);
CREATE INDEX IF NOT EXISTS idx_exchanges_git_branch ON exchanges(git_branch);

-- Configuration defaults
INSERT OR IGNORE INTO import_state (key, value) VALUES ('schema_version', '1');
INSERT OR IGNORE INTO import_state (key, value) VALUES ('import_completed', 'false');
