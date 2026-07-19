//! 外链打开命令：先经 URL 白名单策略校验，合法才交给系统 opener 打开。

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::security::url_policy::validate_url;

/// 打开外部链接。非法协议返回中文策略错误，由前端原样展示。
#[tauri::command]
pub async fn open_external_link(app: AppHandle, url: String) -> Result<(), String> {
    validate_url(&url).map_err(|err| err.to_string())?;
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|err| format!("打开链接失败：{err}"))?;
    Ok(())
}
