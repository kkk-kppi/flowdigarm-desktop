use std::{
    collections::HashMap,
    path::Path,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use thiserror::Error;

const INITIAL_MIGRATION: &str = include_str!("../migrations/001_initial.sql");
const DEFAULT_SETTINGS: [(&str, &str); 10] = [
    ("theme.mode", "\"system\""),
    ("editor.showRulers", "true"),
    ("editor.showGrid", "false"),
    ("editor.showGuides", "true"),
    ("editor.showPageBreaks", "false"),
    ("editor.defaultZoom", "1"),
    ("editor.defaultPageUnit", "\"mm\""),
    ("editor.defaultConnector", "\"orthogonal\""),
    ("editor.recentLimit", "50"),
    ("export.pngDpi", "150"),
];

#[derive(Debug, Error)]
pub enum RepositoryError {
    #[error("数据库操作失败：{0}")]
    Sql(#[from] rusqlite::Error),
    #[error("JSON 数据无效。")]
    InvalidJson,
    #[error("数据库锁已损坏。")]
    Poisoned,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentDocument {
    pub path: String,
    pub document_id: String,
    pub name: String,
    pub last_opened_at: i64,
    pub pinned: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverySnapshotWrite {
    pub document_id: String,
    pub name: String,
    #[serde(rename = "json")]
    pub document_json: String,
    pub source_path: Option<String>,
    pub updated_at: i64,
}

pub type RecoverySnapshot = RecoverySnapshotWrite;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShapeUsage {
    pub shape_type: String,
    pub use_count: i64,
    pub last_used_at: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    pub x: Option<i64>,
    pub y: Option<i64>,
    pub width: i64,
    pub height: i64,
    pub maximized: bool,
    pub fullscreen: bool,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserTemplate {
    pub id: String,
    pub name: String,
    pub document_json: String,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct SqliteRepository {
    connection: Mutex<Connection>,
}

impl SqliteRepository {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, RepositoryError> {
        let connection = Connection::open(path)?;
        Self::from_connection(connection, true)
    }

    pub fn in_memory() -> Result<Self, RepositoryError> {
        Self::from_connection(Connection::open_in_memory()?, false)
    }

    fn from_connection(connection: Connection, enable_wal: bool) -> Result<Self, RepositoryError> {
        connection.pragma_update(None, "foreign_keys", "ON")?;
        if enable_wal {
            connection.pragma_update(None, "journal_mode", "WAL")?;
        }
        connection.busy_timeout(std::time::Duration::from_millis(5000))?;
        let repository = Self {
            connection: Mutex::new(connection),
        };
        repository.migrate()?;
        Ok(repository)
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Connection>, RepositoryError> {
        self.connection
            .lock()
            .map_err(|_| RepositoryError::Poisoned)
    }

    fn migrate(&self) -> Result<(), RepositoryError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        transaction.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);",
        )?;
        let applied = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=1)",
            [],
            |row| row.get::<_, bool>(0),
        )?;
        if !applied {
            transaction.execute_batch(INITIAL_MIGRATION)?;
            transaction.execute(
                "INSERT INTO schema_migrations(version, applied_at) VALUES(1, ?1)",
                [unix_millis()],
            )?;
        }
        initialize_defaults(&transaction)?;
        transaction.commit()?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, RepositoryError> {
        Ok(self
            .lock()?
            .query_row(
                "SELECT value_json FROM app_settings WHERE setting_key=?1",
                [key],
                |row| row.get(0),
            )
            .optional()?)
    }

    pub fn get_settings(&self) -> Result<HashMap<String, String>, RepositoryError> {
        let connection = self.lock()?;
        let mut statement =
            connection.prepare("SELECT setting_key,value_json FROM app_settings")?;
        let rows = statement.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    pub fn set_setting(&self, key: &str, value_json: &str) -> Result<(), RepositoryError> {
        validate_json(value_json)?;
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        transaction.execute(
            "INSERT INTO app_settings(setting_key,value_json,updated_at) VALUES(?1,?2,?3) ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
            params![key, value_json, unix_millis()],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn upsert_recent(&self, document: &RecentDocument) -> Result<(), RepositoryError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        transaction.execute(
            "INSERT INTO recent_documents(path,document_id,name,last_opened_at,pinned) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(path) DO UPDATE SET document_id=excluded.document_id,name=excluded.name,last_opened_at=excluded.last_opened_at,pinned=MAX(recent_documents.pinned,excluded.pinned)",
            params![document.path, document.document_id, document.name, document.last_opened_at, document.pinned as i64],
        )?;
        transaction.execute(
            "DELETE FROM recent_documents WHERE pinned=0 AND path NOT IN (SELECT path FROM recent_documents WHERE pinned=0 ORDER BY last_opened_at DESC LIMIT 50)",
            [],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn list_recent(&self) -> Result<Vec<RecentDocument>, RepositoryError> {
        let connection = self.lock()?;
        let mut statement = connection.prepare("SELECT path,document_id,name,last_opened_at,pinned FROM recent_documents ORDER BY pinned DESC,last_opened_at DESC")?;
        let rows = statement.query_map([], |row| {
            Ok(RecentDocument {
                path: row.get(0)?,
                document_id: row.get(1)?,
                name: row.get(2)?,
                last_opened_at: row.get(3)?,
                pinned: row.get::<_, i64>(4)? != 0,
            })
        })?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    pub fn remove_recent(&self, path: &str) -> Result<(), RepositoryError> {
        self.execute_delete("DELETE FROM recent_documents WHERE path=?1", path)
    }

    pub fn upsert_recovery(&self, snapshot: &RecoverySnapshotWrite) -> Result<(), RepositoryError> {
        validate_json(&snapshot.document_json)?;
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        transaction.execute(
            "INSERT INTO recovery_snapshots(document_id,name,document_json,source_path,updated_at) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(document_id) DO UPDATE SET name=excluded.name,document_json=excluded.document_json,source_path=excluded.source_path,updated_at=excluded.updated_at",
            params![snapshot.document_id, snapshot.name, snapshot.document_json, snapshot.source_path, snapshot.updated_at],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn latest_recovery(&self) -> Result<Option<RecoverySnapshot>, RepositoryError> {
        Ok(self.lock()?.query_row(
            "SELECT document_id,name,document_json,source_path,updated_at FROM recovery_snapshots ORDER BY updated_at DESC LIMIT 1", [],
            |row| Ok(RecoverySnapshot { document_id: row.get(0)?, name: row.get(1)?, document_json: row.get(2)?, source_path: row.get(3)?, updated_at: row.get(4)? }),
        ).optional()?)
    }

    pub fn delete_recovery(&self, document_id: &str) -> Result<(), RepositoryError> {
        self.execute_delete(
            "DELETE FROM recovery_snapshots WHERE document_id=?1",
            document_id,
        )
    }

    pub fn increment_shape_usage(
        &self,
        shape_type: &str,
        timestamp: i64,
    ) -> Result<(), RepositoryError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        transaction.execute(
            "INSERT INTO shape_usage(shape_type,use_count,last_used_at) VALUES(?1,1,?2) ON CONFLICT(shape_type) DO UPDATE SET use_count=use_count+1,last_used_at=excluded.last_used_at",
            params![shape_type, timestamp],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn top_shape_usage(&self, limit: u32) -> Result<Vec<ShapeUsage>, RepositoryError> {
        let connection = self.lock()?;
        let mut statement = connection.prepare("SELECT shape_type,use_count,last_used_at FROM shape_usage ORDER BY use_count DESC,last_used_at DESC LIMIT ?1")?;
        let rows = statement.query_map([limit], |row| {
            Ok(ShapeUsage {
                shape_type: row.get(0)?,
                use_count: row.get(1)?,
                last_used_at: row.get(2)?,
            })
        })?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    pub fn upsert_window_state(&self, state: &WindowState) -> Result<(), RepositoryError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        transaction.execute(
            "INSERT INTO window_state(id,x,y,width,height,maximized,fullscreen,updated_at) VALUES(1,?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO UPDATE SET x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,maximized=excluded.maximized,fullscreen=excluded.fullscreen,updated_at=excluded.updated_at",
            params![state.x, state.y, state.width, state.height, state.maximized as i64, state.fullscreen as i64, state.updated_at],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn get_window_state(&self) -> Result<Option<WindowState>, RepositoryError> {
        Ok(self.lock()?.query_row(
            "SELECT x,y,width,height,maximized,fullscreen,updated_at FROM window_state WHERE id=1", [],
            |row| Ok(WindowState { x: row.get(0)?, y: row.get(1)?, width: row.get(2)?, height: row.get(3)?, maximized: row.get::<_, i64>(4)? != 0, fullscreen: row.get::<_, i64>(5)? != 0, updated_at: row.get(6)? }),
        ).optional()?)
    }

    pub fn upsert_user_template(&self, template: &UserTemplate) -> Result<(), RepositoryError> {
        validate_json(&template.document_json)?;
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        transaction.execute(
            "INSERT INTO user_templates(id,name,document_json,created_at,updated_at) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET name=excluded.name,document_json=excluded.document_json,updated_at=excluded.updated_at",
            params![template.id, template.name, template.document_json, template.created_at, template.updated_at],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn list_user_templates(&self) -> Result<Vec<UserTemplate>, RepositoryError> {
        let connection = self.lock()?;
        let mut statement = connection.prepare("SELECT id,name,document_json,created_at,updated_at FROM user_templates ORDER BY updated_at DESC")?;
        let rows = statement.query_map([], |row| {
            Ok(UserTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                document_json: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    pub fn delete_user_template(&self, id: &str) -> Result<(), RepositoryError> {
        self.execute_delete("DELETE FROM user_templates WHERE id=?1", id)
    }

    fn execute_delete(&self, sql: &str, value: &str) -> Result<(), RepositoryError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        transaction.execute(sql, [value])?;
        transaction.commit()?;
        Ok(())
    }
}

fn initialize_defaults(transaction: &Transaction<'_>) -> Result<(), rusqlite::Error> {
    let timestamp = unix_millis();
    for (key, value) in DEFAULT_SETTINGS {
        transaction.execute(
            "INSERT OR IGNORE INTO app_settings(setting_key,value_json,updated_at) VALUES(?1,?2,?3)",
            params![key, value, timestamp],
        )?;
    }
    Ok(())
}

fn validate_json(value: &str) -> Result<(), RepositoryError> {
    serde_json::from_str::<serde_json::Value>(value)
        .map(|_| ())
        .map_err(|_| RepositoryError::InvalidJson)
}

pub fn unix_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use tempfile::tempdir;

    use super::{
        RecentDocument, RecoverySnapshotWrite, SqliteRepository, UserTemplate, WindowState,
    };

    fn repository() -> SqliteRepository {
        SqliteRepository::in_memory().unwrap()
    }

    #[test]
    fn migration_creates_exactly_seven_tables_and_is_idempotent() {
        let repository = repository();
        repository.migrate().unwrap();
        let connection = repository.connection.lock().unwrap();
        let names = connection
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            )
            .unwrap()
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .collect::<Result<HashSet<_>, _>>()
            .unwrap();

        assert_eq!(
            names,
            HashSet::from([
                "schema_migrations".to_owned(),
                "app_settings".to_owned(),
                "recent_documents".to_owned(),
                "recovery_snapshots".to_owned(),
                "shape_usage".to_owned(),
                "window_state".to_owned(),
                "user_templates".to_owned(),
            ])
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM schema_migrations WHERE version=1",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            1
        );
    }

    #[test]
    fn configures_foreign_keys_wal_and_busy_timeout() {
        let dir = tempdir().unwrap();
        let repository = SqliteRepository::open(dir.path().join("metadata.db")).unwrap();
        let connection = repository.connection.lock().unwrap();
        let foreign_keys: i64 = connection
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .unwrap();
        let journal: String = connection
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        let timeout: i64 = connection
            .query_row("PRAGMA busy_timeout", [], |row| row.get(0))
            .unwrap();
        assert_eq!(foreign_keys, 1);
        assert_eq!(journal.to_lowercase(), "wal");
        assert_eq!(timeout, 5000);
    }

    #[test]
    fn initializes_defaults_without_overwriting_existing_values() {
        let repository = repository();
        assert_eq!(
            repository.get_setting("theme.mode").unwrap().as_deref(),
            Some("\"system\"")
        );
        assert_eq!(
            repository
                .get_setting("editor.showRulers")
                .unwrap()
                .as_deref(),
            Some("true")
        );
        repository.set_setting("theme.mode", "\"dark\"").unwrap();
        repository.migrate().unwrap();
        assert_eq!(
            repository.get_setting("theme.mode").unwrap().as_deref(),
            Some("\"dark\"")
        );
        assert_eq!(repository.get_settings().unwrap().len(), 10);
        assert!(repository.set_setting("bad", "not-json").is_err());
    }

    #[test]
    fn recent_documents_sort_pinned_first_and_keep_only_fifty_unpinned() {
        let repository = repository();
        for index in 0..55 {
            repository
                .upsert_recent(&RecentDocument {
                    path: format!("C:/docs/{index}.flowdiagram"),
                    document_id: format!("doc-{index}"),
                    name: format!("文档 {index}"),
                    last_opened_at: index,
                    pinned: false,
                })
                .unwrap();
        }
        repository
            .upsert_recent(&RecentDocument {
                path: "C:/docs/pinned.flowdiagram".into(),
                document_id: "pinned".into(),
                name: "置顶".into(),
                last_opened_at: 1,
                pinned: true,
            })
            .unwrap();
        repository
            .upsert_recent(&RecentDocument {
                path: "C:/docs/pinned.flowdiagram".into(),
                document_id: "pinned".into(),
                name: "更新后的置顶文档".into(),
                last_opened_at: 100,
                pinned: false,
            })
            .unwrap();

        let rows = repository.list_recent().unwrap();
        assert_eq!(rows.len(), 51);
        assert_eq!(rows[0].document_id, "pinned");
        assert!(rows[0].pinned);
        assert_eq!(rows[1].document_id, "doc-54");
        assert!(!rows.iter().any(|row| row.document_id == "doc-0"));
        repository.remove_recent("C:/docs/54.flowdiagram").unwrap();
        assert!(!repository
            .list_recent()
            .unwrap()
            .iter()
            .any(|row| row.document_id == "doc-54"));
    }

    #[test]
    fn recovery_shape_window_and_template_crud_round_trip() {
        let repository = repository();
        repository
            .upsert_recovery(&RecoverySnapshotWrite {
                document_id: "doc-1".into(),
                name: "恢复文档".into(),
                document_json: "{\"schemaVersion\":1}".into(),
                source_path: Some("C:/docs/a.flowdiagram".into()),
                updated_at: 100,
            })
            .unwrap();
        assert_eq!(
            repository.latest_recovery().unwrap().unwrap().document_id,
            "doc-1"
        );
        repository.delete_recovery("doc-1").unwrap();
        assert!(repository.latest_recovery().unwrap().is_none());
        assert!(repository
            .upsert_recovery(&RecoverySnapshotWrite {
                document_id: "bad".into(),
                name: "bad".into(),
                document_json: "bad".into(),
                source_path: None,
                updated_at: 1,
            })
            .is_err());

        repository.increment_shape_usage("rect", 10).unwrap();
        repository.increment_shape_usage("rect", 20).unwrap();
        repository.increment_shape_usage("diamond", 30).unwrap();
        let top = repository.top_shape_usage(1).unwrap();
        assert_eq!((top[0].shape_type.as_str(), top[0].use_count), ("rect", 2));

        let state = WindowState {
            x: Some(1),
            y: Some(2),
            width: 1200,
            height: 800,
            maximized: true,
            fullscreen: false,
            updated_at: 40,
        };
        repository.upsert_window_state(&state).unwrap();
        assert_eq!(repository.get_window_state().unwrap(), Some(state));

        let template = UserTemplate {
            id: "tpl-1".into(),
            name: "模板".into(),
            document_json: "{\"schemaVersion\":1}".into(),
            created_at: 1,
            updated_at: 2,
        };
        repository.upsert_user_template(&template).unwrap();
        assert_eq!(repository.list_user_templates().unwrap(), vec![template]);
        repository.delete_user_template("tpl-1").unwrap();
        assert!(repository.list_user_templates().unwrap().is_empty());
    }

    #[test]
    fn recovery_snapshot_ipc_uses_json_field_name() {
        let snapshot = RecoverySnapshotWrite {
            document_id: "doc-1".into(),
            name: "恢复文档".into(),
            document_json: "{}".into(),
            source_path: None,
            updated_at: 1,
        };
        let value = serde_json::to_value(snapshot).unwrap();
        assert_eq!(value["json"], "{}");
        assert!(value.get("documentJson").is_none());
    }

    #[test]
    fn failed_explicit_transaction_rolls_back_all_writes() {
        let repository = repository();
        let mut connection = repository.connection.lock().unwrap();
        let transaction = connection.transaction().unwrap();
        transaction
            .execute("INSERT INTO app_settings VALUES ('temporary','true',1)", [])
            .unwrap();
        let failure = transaction.execute(
            "INSERT INTO app_settings VALUES ('temporary','false',2)",
            [],
        );
        assert!(failure.is_err());
        transaction.rollback().unwrap();
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM app_settings WHERE setting_key='temporary'",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            0
        );
    }

    #[test]
    fn migration_schema_matches_required_columns() {
        let repository = repository();
        let connection = repository.connection.lock().unwrap();
        let recent_sql: String = connection
            .query_row(
                "SELECT sql FROM sqlite_master WHERE name='recent_documents'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let recovery_sql: String = connection
            .query_row(
                "SELECT sql FROM sqlite_master WHERE name='recovery_snapshots'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(recent_sql.contains("document_id TEXT NOT NULL"));
        assert!(recent_sql.contains("pinned INTEGER NOT NULL DEFAULT 0"));
        assert!(recovery_sql.contains("document_id TEXT PRIMARY KEY"));
        assert!(recovery_sql.contains("source_path TEXT"));
    }
}
