-- Local metadata only. Times are Unix milliseconds UTC; booleans are 0/1.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recent_documents (
    path TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    name TEXT NOT NULL,
    last_opened_at INTEGER NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1))
);

CREATE TABLE IF NOT EXISTS recovery_snapshots (
    document_id TEXT PRIMARY KEY,
    version_token TEXT NOT NULL,
    name TEXT NOT NULL,
    document_json TEXT NOT NULL,
    source_path TEXT,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shape_usage (
    shape_type TEXT PRIMARY KEY,
    use_count INTEGER NOT NULL DEFAULT 0,
    last_used_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS window_state (
    id INTEGER PRIMARY KEY CHECK(id=1),
    x INTEGER,
    y INTEGER,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    maximized INTEGER NOT NULL CHECK(maximized IN (0,1)),
    fullscreen INTEGER NOT NULL CHECK(fullscreen IN (0,1)),
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    document_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
