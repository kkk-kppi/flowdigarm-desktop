use std::{
    fs,
    path::{Path, PathBuf},
};

use serde_json::Value;
use tauri::State;

use crate::persistence::{
    atomic_file::atomic_write,
    sqlite_repository::{
        unix_millis, RecentDocument, RecoverySnapshot, RecoverySnapshotWrite, ShapeUsage,
        SqliteRepository,
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
        Some("flowdiagram") => Ok(path.to_owned()),
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

#[tauri::command]
pub fn read_diagram(path: String) -> Result<String, String> {
    read_diagram_file(Path::new(&path))
}

#[tauri::command]
pub fn save_diagram(
    path: String,
    document_json: String,
    repository: State<'_, SqliteRepository>,
) -> Result<String, String> {
    let saved_path = save_diagram_with_recent(Path::new(&path), &document_json, |path, value| {
        repository
            .upsert_recent(&RecentDocument {
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
            })
            .map_err(|error| error.to_string())
    })?;
    Ok(saved_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn read_recovery_snapshot(
    repository: State<'_, SqliteRepository>,
) -> Result<Option<RecoverySnapshot>, String> {
    repository
        .latest_recovery()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_recovery_snapshot(
    repository: State<'_, SqliteRepository>,
    document_id: String,
    name: String,
    json: String,
    source_path: Option<String>,
) -> Result<(), String> {
    repository
        .upsert_recovery(&RecoverySnapshotWrite {
            document_id,
            name,
            document_json: json,
            source_path,
            updated_at: unix_millis(),
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_recovery_snapshot(
    repository: State<'_, SqliteRepository>,
    document_id: String,
) -> Result<(), String> {
    repository
        .delete_recovery(&document_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_recent_documents(
    repository: State<'_, SqliteRepository>,
) -> Result<Vec<RecentDocument>, String> {
    repository.list_recent().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn remove_recent_document(
    repository: State<'_, SqliteRepository>,
    path: String,
) -> Result<(), String> {
    repository
        .remove_recent(&path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_settings(
    repository: State<'_, SqliteRepository>,
) -> Result<std::collections::HashMap<String, Value>, String> {
    repository
        .get_settings()
        .map_err(|error| error.to_string())?
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
    repository: State<'_, SqliteRepository>,
    key: String,
    value_json: String,
) -> Result<(), String> {
    repository
        .set_setting(&key, &value_json)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn record_shape_usage(
    repository: State<'_, SqliteRepository>,
    shape_type: String,
) -> Result<(), String> {
    repository
        .increment_shape_usage(&shape_type, unix_millis())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn top_shape_usage(
    repository: State<'_, SqliteRepository>,
    limit: u32,
) -> Result<Vec<ShapeUsage>, String> {
    repository
        .top_shape_usage(limit)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::{
        normalize_save_path, read_diagram_file, save_diagram_file, save_diagram_with_recent,
        validate_document_json,
    };

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
}
