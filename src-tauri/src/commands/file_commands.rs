use std::{
    fs,
    path::{Path, PathBuf},
};

use serde_json::Value;
use tauri::State;

use crate::persistence::{
    atomic_file::atomic_write,
    sqlite_repository::{
        unix_millis, PersistenceState, RecentDocument, RecoverySnapshot, RecoverySnapshotWrite,
        RepositoryError, ShapeUsage, SqliteRepository, DATABASE_UNAVAILABLE,
    },
};

const MAX_DOCUMENT_BYTES: usize = 20 * 1024 * 1024;
const INVALID_FILE: &str = "文件格式无效，未打开文件。";
const INVALID_PATH: &str = "文件路径无效。";

fn validate_document_json(document_json: &str) -> Result<Value, String> {
    if document_json.len() > MAX_DOCUMENT_BYTES {
        return Err(INVALID_FILE.into());
    }
    let value: Value = serde_json::from_str(document_json).map_err(|_| INVALID_FILE.to_owned())?;
    if !value.is_object()
        || value
            .get("schemaVersion")
            .and_then(Value::as_u64)
            .filter(|version| *version > 0)
            .is_none()
    {
        return Err(INVALID_FILE.into());
    }
    Ok(value)
}

fn validate_read_path(path: &Path) -> Result<(), String> {
    if !path.is_absolute() || path.to_string_lossy().contains('\0') {
        return Err(INVALID_PATH.into());
    }
    Ok(())
}

fn normalize_save_path(path: &Path) -> Result<PathBuf, String> {
    validate_read_path(path)?;
    match path.extension().and_then(|extension| extension.to_str()) {
        None => Ok(path.with_extension("flowdiagram")),
        Some(extension) if extension.eq_ignore_ascii_case("flowdiagram") => Ok(path.to_owned()),
        Some(_) => Err("只能保存为 .flowdiagram 文件。".into()),
    }
}

fn read_diagram_file(path: &Path) -> Result<String, String> {
    validate_read_path(path)?;
    let metadata = fs::metadata(path).map_err(|_| "无法读取文件。".to_owned())?;
    if metadata.len() > MAX_DOCUMENT_BYTES as u64 {
        return Err(INVALID_FILE.into());
    }
    let bytes = fs::read(path).map_err(|_| "无法读取文件。".to_owned())?;
    let text = String::from_utf8(bytes).map_err(|_| INVALID_FILE.to_owned())?;
    validate_document_json(&text)?;
    Ok(text)
}

fn save_diagram_file(path: &Path, document_json: &str) -> Result<PathBuf, String> {
    validate_document_json(document_json)?;
    let path = normalize_save_path(path)?;
    atomic_write(&path, document_json.as_bytes()).map_err(|error| error.to_string())?;
    Ok(path)
}

#[cfg(test)]
fn save_diagram_with_recent<F>(
    path: &Path,
    document_json: &str,
    update_recent: F,
) -> Result<PathBuf, String>
where
    F: FnOnce(&Path, &Value) -> Result<(), String>,
{
    let value = validate_document_json(document_json)?;
    let saved_path = save_diagram_file(path, document_json)?;
    if let Err(error) = update_recent(&saved_path, &value) {
        eprintln!("图文件已保存，但最近文件更新失败：{error}");
    }
    Ok(saved_path)
}

fn recent_document(path: &Path, value: &Value) -> RecentDocument {
    RecentDocument {
        path: path.to_string_lossy().into_owned(),
        document_id: value
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned(),
        name: value
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned(),
        last_opened_at: unix_millis(),
        pinned: false,
    }
}

fn update_recent_best_effort(state: &PersistenceState, path: &Path, value: &Value) {
    match state.repository() {
        Ok(repository) => {
            if let Err(error) = repository.upsert_recent(&recent_document(path, value)) {
                eprintln!("图文件操作成功，但最近文件更新失败：{error}");
            }
        }
        Err(_) => {
            if let Some(error) = state.initialization_error() {
                eprintln!("图文件操作成功，但本机数据库初始化失败：{error}");
            }
        }
    }
}

fn read_diagram_with_state(path: &Path, state: &PersistenceState) -> Result<String, String> {
    let document_json = read_diagram_file(path)?;
    let value = validate_document_json(&document_json)?;
    update_recent_best_effort(state, path, &value);
    Ok(document_json)
}

fn save_diagram_with_state(
    path: &Path,
    document_json: &str,
    state: &PersistenceState,
) -> Result<PathBuf, String> {
    let value = validate_document_json(document_json)?;
    let saved_path = save_diagram_file(path, document_json)?;
    update_recent_best_effort(state, &saved_path, &value);
    Ok(saved_path)
}

fn database_repository(state: &PersistenceState) -> Result<&SqliteRepository, String> {
    state
        .repository()
        .map_err(|_| DATABASE_UNAVAILABLE.to_owned())
}

fn database_result<T>(result: Result<T, RepositoryError>) -> Result<T, String> {
    result.map_err(|_| DATABASE_UNAVAILABLE.to_owned())
}

#[tauri::command]
pub fn read_diagram(
    path: String,
    repository: State<'_, PersistenceState>,
) -> Result<String, String> {
    read_diagram_with_state(Path::new(&path), &repository)
}

#[tauri::command]
pub fn save_diagram(
    path: String,
    document_json: String,
    repository: State<'_, PersistenceState>,
) -> Result<String, String> {
    let saved_path = save_diagram_with_state(Path::new(&path), &document_json, &repository)?;
    Ok(saved_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn read_recovery_snapshot(
    repository: State<'_, PersistenceState>,
) -> Result<Option<RecoverySnapshot>, String> {
    database_result(database_repository(&repository)?.latest_recovery())
}

#[tauri::command]
pub fn write_recovery_snapshot(
    repository: State<'_, PersistenceState>,
    document_id: String,
    version_token: String,
    name: String,
    json: String,
    source_path: Option<String>,
) -> Result<(), String> {
    database_result(
        database_repository(&repository)?.upsert_recovery(&RecoverySnapshotWrite {
            document_id,
            version_token,
            name,
            document_json: json,
            source_path,
            updated_at: unix_millis(),
        }),
    )
}

#[tauri::command]
pub fn delete_recovery_snapshot(
    repository: State<'_, PersistenceState>,
    document_id: String,
    version_token: String,
) -> Result<(), String> {
    database_result(database_repository(&repository)?.delete_recovery(&document_id, &version_token))
}

#[tauri::command]
pub fn list_recent_documents(
    repository: State<'_, PersistenceState>,
) -> Result<Vec<RecentDocument>, String> {
    database_result(database_repository(&repository)?.list_recent())
}

#[tauri::command]
pub fn remove_recent_document(
    repository: State<'_, PersistenceState>,
    path: String,
) -> Result<(), String> {
    database_result(database_repository(&repository)?.remove_recent(&path))
}

#[tauri::command]
pub fn get_settings(
    repository: State<'_, PersistenceState>,
) -> Result<std::collections::HashMap<String, Value>, String> {
    database_result(database_repository(&repository)?.get_settings())?
        .into_iter()
        .map(|(key, value)| {
            serde_json::from_str(&value)
                .map(|value| (key, value))
                .map_err(|_| "设置数据无效。".to_owned())
        })
        .collect()
}

#[tauri::command]
pub fn set_setting(
    repository: State<'_, PersistenceState>,
    key: String,
    value_json: String,
) -> Result<(), String> {
    database_result(database_repository(&repository)?.set_setting(&key, &value_json))
}

#[tauri::command]
pub fn record_shape_usage(
    repository: State<'_, PersistenceState>,
    shape_type: String,
) -> Result<(), String> {
    database_result(
        database_repository(&repository)?.increment_shape_usage(&shape_type, unix_millis()),
    )
}

#[tauri::command]
pub fn top_shape_usage(
    repository: State<'_, PersistenceState>,
    limit: u32,
) -> Result<Vec<ShapeUsage>, String> {
    database_result(database_repository(&repository)?.top_shape_usage(limit))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::{
        database_repository, database_result, normalize_save_path, read_diagram_file,
        read_diagram_with_state, save_diagram_file, save_diagram_with_recent,
        save_diagram_with_state, validate_document_json,
    };
    use crate::persistence::sqlite_repository::{PersistenceState, DATABASE_UNAVAILABLE};

    const VALID: &str = r#"{"schemaVersion":1,"id":"doc-1","name":"流程","pages":[]}"#;

    #[test]
    fn accepts_basic_document_and_rejects_invalid_json_or_schema_version() {
        assert!(validate_document_json(VALID).is_ok());
        for invalid in [
            "not-json",
            "[]",
            r#"{"schemaVersion":0}"#,
            r#"{"schemaVersion":1.5}"#,
        ] {
            assert_eq!(
                validate_document_json(invalid).unwrap_err(),
                "文件格式无效，未打开文件。"
            );
        }
    }

    #[test]
    fn save_path_must_be_absolute_nul_free_and_flowdiagram() {
        let absolute_without_extension = std::env::temp_dir().join("流程文件");
        assert_eq!(
            normalize_save_path(&absolute_without_extension)
                .unwrap()
                .extension()
                .unwrap(),
            "flowdiagram"
        );
        assert!(normalize_save_path(&std::path::PathBuf::from("relative.flowdiagram")).is_err());
        assert!(normalize_save_path(&std::env::temp_dir().join("bad.json")).is_err());
        assert_eq!(
            normalize_save_path(&std::env::temp_dir().join("upper.FLOWDIAGRAM")).unwrap(),
            std::env::temp_dir().join("upper.FLOWDIAGRAM")
        );
        assert!(
            normalize_save_path(&std::path::PathBuf::from("C:\\bad\0name.flowdiagram")).is_err()
        );
    }

    #[test]
    fn reads_utf8_json_and_rejects_oversized_or_invalid_files() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("valid.flowdiagram");
        fs::write(&path, VALID).unwrap();
        assert_eq!(read_diagram_file(&path).unwrap(), VALID);
        fs::write(&path, [0xff, 0xfe]).unwrap();
        assert_eq!(
            read_diagram_file(&path).unwrap_err(),
            "文件格式无效，未打开文件。"
        );
        fs::write(&path, vec![b' '; 20 * 1024 * 1024 + 1]).unwrap();
        assert_eq!(
            read_diagram_file(&path).unwrap_err(),
            "文件格式无效，未打开文件。"
        );
    }

    #[test]
    fn saves_with_automatic_extension_and_preserves_original_on_invalid_input() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("saved");
        let saved = save_diagram_file(&path, VALID).unwrap();
        assert_eq!(saved.extension().unwrap(), "flowdiagram");
        assert_eq!(fs::read_to_string(&saved).unwrap(), VALID);
        assert!(save_diagram_file(&saved, "invalid").is_err());
        assert_eq!(fs::read_to_string(saved).unwrap(), VALID);
    }

    #[test]
    fn successful_file_save_stays_successful_when_recent_metadata_fails() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("metadata-failure.flowdiagram");
        let saved = save_diagram_with_recent(&path, VALID, |_path, _document| {
            Err("数据库不可用".to_owned())
        })
        .unwrap();

        assert_eq!(fs::read_to_string(saved).unwrap(), VALID);
    }

    #[test]
    fn unavailable_database_state_still_saves_the_real_diagram_file() {
        let dir = tempdir().unwrap();
        let state = PersistenceState::initialize(dir.path());
        assert_eq!(state.repository().err(), Some(DATABASE_UNAVAILABLE));
        assert_eq!(
            database_repository(&state).err().as_deref(),
            Some(DATABASE_UNAVAILABLE)
        );

        let saved = save_diagram_with_state(
            dir.path()
                .join("database-unavailable.flowdiagram")
                .as_path(),
            VALID,
            &state,
        )
        .unwrap();

        assert_eq!(fs::read_to_string(saved).unwrap(), VALID);
    }

    #[test]
    fn repository_failures_map_to_stable_chinese_at_the_command_boundary() {
        let repository =
            crate::persistence::sqlite_repository::SqliteRepository::in_memory().unwrap();
        let result = database_result(repository.set_setting("invalid", "not-json"));
        assert_eq!(result.unwrap_err(), DATABASE_UNAVAILABLE);
    }

    #[test]
    fn open_updates_recent_metadata_best_effort() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("opened.flowdiagram");
        fs::write(&path, VALID).unwrap();
        let state = PersistenceState::available(
            crate::persistence::sqlite_repository::SqliteRepository::in_memory().unwrap(),
        );

        assert_eq!(read_diagram_with_state(&path, &state).unwrap(), VALID);
        let recent = state.repository().unwrap().list_recent().unwrap();
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].path, path.to_string_lossy());

        let unavailable = PersistenceState::initialize(dir.path());
        assert_eq!(read_diagram_with_state(&path, &unavailable).unwrap(), VALID);
    }
}
