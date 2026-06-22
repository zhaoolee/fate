use serde::Serialize;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::activity::ActivitySnapshot;
use crate::input::{input_event_counts, now_unix_ms, seconds_since_last_input};
use crate::shared::{SharedInputCounts, SharedMonitor, SharedOverlayTip, SharedTips};

const OVERLAY_RATIO: f64 = 0.618;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayDebugReport {
    ok: bool,
    label: String,
    requested_url: String,
    full_url: String,
    logical_width: f64,
    logical_height: f64,
    logical_x: f64,
    logical_y: f64,
    existing_window_destroyed: bool,
    build_ok: bool,
    eval_requested: bool,
    main_window_exists: bool,
    overlay_window_exists: bool,
    preview_window_exists: bool,
    timestamp_unix_ms: u128,
    notes: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestVoyageStart {
    last_event_unix_ms: u128,
}

#[tauri::command]
pub fn complete_break_reminder(
    app: AppHandle,
    monitor: State<SharedMonitor>,
    input_counts: State<SharedInputCounts>,
) -> Result<ActivitySnapshot, String> {
    destroy_overlay_window(&app, "break-overlay")?;

    let input_counts = input_event_counts(&input_counts);
    let idle_secs = seconds_since_last_input(input_counts);
    let snapshot = {
        let mut monitor = monitor.lock().map_err(|_| "无法关闭提醒".to_string())?;
        monitor.complete_reminder();
        monitor.snapshot(idle_secs, Instant::now(), input_counts)
    };

    app.emit("activity://snapshot", &snapshot)
        .map_err(|error| error.to_string())?;
    app.emit(
        "rest-voyage://start",
        RestVoyageStart {
            last_event_unix_ms: input_counts.last_event_unix_ms,
        },
    )
    .map_err(|error| error.to_string())?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn preview_break_overlay(
    app: AppHandle,
    health_tips: State<'_, SharedTips>,
    overlay_tip: State<'_, SharedOverlayTip>,
) -> Result<OverlayDebugReport, String> {
    set_break_overlay_tip(&overlay_tip, &health_tips);
    show_overlay_window(
        &app,
        "break-overlay-preview",
        "index.html?route=overlay&preview=1",
    )
}

#[tauri::command]
pub fn get_break_overlay_tip(overlay_tip: State<SharedOverlayTip>) -> String {
    overlay_tip
        .lock()
        .map(|tip| tip.clone())
        .unwrap_or_default()
}

#[tauri::command]
pub fn close_break_overlay_preview(
    app: AppHandle,
    input_counts: State<SharedInputCounts>,
) -> Result<(), String> {
    destroy_overlay_window(&app, "break-overlay-preview")?;
    let input_counts = input_event_counts(&input_counts);
    app.emit(
        "rest-voyage://preview-start",
        RestVoyageStart {
            last_event_unix_ms: input_counts.last_event_unix_ms,
        },
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}
pub fn show_break_overlay(
    app: &AppHandle,
    health_tips: &SharedTips,
    overlay_tip: &SharedOverlayTip,
) -> Result<(), String> {
    set_break_overlay_tip(overlay_tip, health_tips);
    show_overlay_window(app, "break-overlay", "index.html?route=overlay").map(|_| ())
}

fn show_overlay_window(
    app: &AppHandle,
    label: &str,
    url: &str,
) -> Result<OverlayDebugReport, String> {
    let (width, height, x, y) = overlay_geometry(app)?;
    let mut notes = Vec::new();
    let mut existing_window_destroyed = false;
    notes.push("overlay geometry resolved".to_string());

    if let Some(window) = app.get_webview_window(label) {
        match window.destroy() {
            Ok(()) => {
                existing_window_destroyed = true;
                notes.push(format!("destroyed existing {label} window"));
            }
            Err(error) => notes.push(format!(
                "failed to destroy existing {label} window: {error}"
            )),
        }
    } else {
        notes.push(format!("no existing {label} window"));
    }

    let overlay_url = WebviewUrl::App(url.into());
    let full_url = format!("App({url})");
    notes.push(format!("full url: {full_url}"));

    let build_result = WebviewWindowBuilder::new(app, label, overlay_url)
        .title(app.package_info().name.as_str())
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .inner_size(width, height)
        .position(x, y)
        .build();

    let mut build_ok = false;
    let eval_requested = false;
    match build_result {
        Ok(_) => {
            build_ok = true;
            notes.push("webview window build ok".to_string());
            notes.push("webview eval diagnostics disabled".to_string());
        }
        Err(error) => notes.push(format!("webview window build failed: {error}")),
    }

    let overlay_window_exists = app.get_webview_window("break-overlay").is_some();
    let preview_window_exists = app.get_webview_window("break-overlay-preview").is_some();
    let main_window_exists = app.get_webview_window("main").is_some();
    let ok = build_ok && app.get_webview_window(label).is_some();

    Ok(OverlayDebugReport {
        ok,
        label: label.to_string(),
        requested_url: url.to_string(),
        full_url,
        logical_width: width,
        logical_height: height,
        logical_x: x,
        logical_y: y,
        existing_window_destroyed,
        build_ok,
        eval_requested,
        main_window_exists,
        overlay_window_exists,
        preview_window_exists,
        timestamp_unix_ms: now_unix_ms(),
        notes,
    })
}

fn destroy_overlay_window<R: tauri::Runtime, M: Manager<R>>(
    manager: &M,
    label: &str,
) -> Result<(), String> {
    if let Some(window) = manager.get_webview_window(label) {
        window.destroy().map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn destroy_overlay_windows<R: tauri::Runtime, M: Manager<R>>(manager: &M) {
    let _ = destroy_overlay_window(manager, "break-overlay");
    let _ = destroy_overlay_window(manager, "break-overlay-preview");
}

pub fn versioned_main_window_title(app_name: &str, version: &str) -> String {
    format!("{app_name}精力管理 v{version}")
}

fn set_break_overlay_tip(overlay_tip: &SharedOverlayTip, health_tips: &SharedTips) {
    if let Ok(mut current_tip) = overlay_tip.lock() {
        *current_tip = select_tip(health_tips).unwrap_or_default();
    }
}

fn overlay_geometry(app: &AppHandle) -> Result<(f64, f64, f64, f64), String> {
    let monitor = app
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "无法获取主显示器".to_string())?;
    let size = monitor.size();
    let position = monitor.position();
    let scale = monitor.scale_factor();
    let screen_width = size.width as f64 / scale;
    let screen_height = size.height as f64 / scale;
    let origin_x = position.x as f64 / scale;
    let origin_y = position.y as f64 / scale;
    let width = screen_width * OVERLAY_RATIO;
    let height = screen_height * OVERLAY_RATIO;
    let x = origin_x + (screen_width - width) / 2.0;
    let y = origin_y + (screen_height - height) / 2.0;

    Ok((width, height, x, y))
}

fn select_tip(health_tips: &SharedTips) -> Option<String> {
    let tips = health_tips.lock().ok()?;
    if tips.is_empty() {
        return None;
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    tips.get((now as usize) % tips.len()).cloned()
}
