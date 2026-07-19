// 发布构建时关闭 Windows 附加控制台窗口。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    flowchart_editor_lib::run()
}
