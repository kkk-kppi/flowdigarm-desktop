//! 流程图编辑器 Tauri 应用库入口。

use tauri::Manager;

use persistence::sqlite_repository::PersistenceState;

pub mod commands;
pub mod persistence;
pub mod security;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Err(error) = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = match app.path().app_data_dir() {
                Ok(app_data) => match std::fs::create_dir_all(&app_data) {
                    Ok(()) => PersistenceState::initialize(app_data.join("flowchart-editor.db")),
                    Err(error) => PersistenceState::unavailable(error.to_string()),
                },
                Err(error) => PersistenceState::unavailable(error.to_string()),
            };
            if let Some(error) = state.initialization_error() {
                eprintln!("本机数据库初始化失败，应用将以降级模式启动：{error}");
            }
            app.manage(state);
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
            commands::file_commands::top_shape_usage,
            commands::image_commands::read_image
        ])
        .run(tauri::generate_context!())
    {
        eprintln!("应用运行失败：{error}");
    }
}
