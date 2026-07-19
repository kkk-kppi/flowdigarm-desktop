//! 流程图编辑器 Tauri 应用库入口。

pub mod commands;
pub mod security;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::link_commands::open_external_link
        ])
        .run(tauri::generate_context!())
        .expect("启动流程图编辑器失败");
}
