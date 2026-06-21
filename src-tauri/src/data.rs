use tauri::{AppHandle, Manager};

use crate::input::now_unix_ms;

#[tauri::command]
pub fn export_app_data(
    app: AppHandle,
    file_name: String,
    payload: String,
) -> Result<String, String> {
    let file_name = sanitize_export_file_name(&file_name);
    let download_dir = app
        .path()
        .download_dir()
        .map_err(|error| format!("无法获取下载目录：{error}"))?;
    let path = download_dir.join(file_name);

    std::fs::write(&path, payload).map_err(|error| format!("导出失败：{error}"))?;
    Ok(path.to_string_lossy().to_string())
}

fn sanitize_export_file_name(file_name: &str) -> String {
    let cleaned = file_name
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
        .collect::<String>();

    if cleaned.ends_with(".json") && cleaned.len() > ".json".len() {
        cleaned
    } else {
        format!("fate-{}.json", now_unix_ms())
    }
}
