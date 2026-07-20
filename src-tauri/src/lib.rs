//! 流程图编辑器 Tauri 应用库入口。

use tauri::Manager;

use persistence::sqlite_repository::SqliteRepository;

pub mod commands;
pub mod persistence;
pub mod security;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .map_err(|error| error.to_string())?;
            std::fs::create_dir_all(&app_data)?;
            let repository = SqliteRepository::open(app_data.join("flowchart-editor.db"))
                .map_err(|error| error.to_string())?;
            app.manage(repository);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::link_commands::open_external_link,
            commands::file_commands::read_diagram,
            commands::file_commands::save_diagram,
            commands::file_commands::read_recovery_snapshot,
            commands::file_commands::write_recovery_snapshot,
            commands::file_commands::delete_recovery_snapshot,
            commands::file_commands::list_recent_documents,
            commands::file_commands::remove_recent_document,
            commands::file_commands::get_settings,
            commands::file_commands::set_setting,
            commands::file_commands::record_shape_usage,
            commands::file_commands::top_shape_usage
        ])
        .run(tauri::generate_context!())
        .expect("启动流程图编辑器失败");
}
