-- 001_initial.sql：初始迁移，建立 7 张元数据表。
--
-- 连接级 PRAGMA 由 Rust 侧打开数据库时执行（不在迁移文件内）：
--   PRAGMA foreign_keys = ON;
--   PRAGMA journal_mode = WAL;
--   PRAGMA busy_timeout = 5000;
--
-- 约定：时间列一律 INTEGER（Unix 毫秒 UTC）；布尔列一律 INTEGER 0/1；
-- JSON 字段为 UTF-8 文本。图形本体保存在 .flowdiagram 文件中，此处仅存元数据。

-- 迁移版本记录（详细设计 §9.2 给定结构）
CREATE TABLE schema_migrations (
    version    INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
);

-- 应用设置（键值，10 个设置键见详细设计 §9.4）
CREATE TABLE app_settings (
    setting_key TEXT PRIMARY KEY,
    value_json  TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
);

-- 最近打开/保存的文档（上限由应用层控制，默认 50 条）
CREATE TABLE recent_documents (
    path           TEXT PRIMARY KEY,
    last_opened_at INTEGER NOT NULL
);

-- 异常恢复快照（显式保存成功后由应用层删除对应快照）
CREATE TABLE recovery_snapshots (
    id            TEXT PRIMARY KEY,
    document_json TEXT NOT NULL,
    created_at    INTEGER NOT NULL
);

-- 形状使用统计（驱动"常用形状 Top20"）
CREATE TABLE shape_usage (
    shape_key    TEXT PRIMARY KEY,
    use_count    INTEGER NOT NULL DEFAULT 0,
    last_used_at INTEGER NOT NULL
);

-- 主窗口状态（单行表，id 恒为 1）
CREATE TABLE window_state (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    x            INTEGER,
    y            INTEGER,
    width        INTEGER NOT NULL,
    height       INTEGER NOT NULL,
    is_maximized INTEGER NOT NULL DEFAULT 0,
    updated_at   INTEGER NOT NULL
);

-- 用户自定义模板
CREATE TABLE user_templates (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    document_json TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
);
