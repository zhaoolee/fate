#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod activity;
mod ai;
mod data;
mod input;
mod overlay;
mod shared;
mod window;

use std::sync::{Arc, Mutex};

use activity::{get_snapshot, start_activity_monitor, update_settings, ActivityMonitor};
use ai::{generate_ai_tips, generate_health_tips, set_health_tips, test_llm_model};
use data::export_app_data;
use input::{
    ensure_input_event_counter, get_input_monitor_permission_status,
    request_input_monitor_permission, start_input_activity_emitter, InputEventCounts,
};
use overlay::{
    close_break_overlay_preview, complete_break_reminder, destroy_overlay_windows,
    get_break_overlay_tip, preview_break_overlay, versioned_main_window_title,
};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};
use window::{
    set_main_window_pinned, set_main_window_size_mode, start_main_window_geometry_guard,
    MainWindowSizeMode,
};

fn main() {
    let monitor = Arc::new(Mutex::new(ActivityMonitor::new()));
    let health_tips = Arc::new(Mutex::new(Vec::<String>::new()));
    let overlay_tip = Arc::new(Mutex::new(String::new()));
    let input_counts = Arc::new(Mutex::new(InputEventCounts::default()));
    let window_size_mode = Arc::new(Mutex::new(MainWindowSizeMode::Mini));
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_fate_tables",
            sql: "
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS daily_stats (
                day TEXT PRIMARY KEY,
                work_secs INTEGER NOT NULL DEFAULT 0,
                rest_secs INTEGER NOT NULL DEFAULT 0,
                reminder_count INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS game_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                line TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
        ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_ai_tip_runs",
            sql: "
                CREATE TABLE IF NOT EXISTS ai_tip_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kind TEXT NOT NULL,
                    day TEXT NOT NULL,
                    tips_json TEXT NOT NULL,
                    extra_prompt TEXT NOT NULL DEFAULT '',
                    model TEXT NOT NULL DEFAULT '',
                    base_url TEXT NOT NULL DEFAULT '',
                    source TEXT NOT NULL DEFAULT 'manual',
                    created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_ai_tip_runs_kind_day_created_at
                    ON ai_tip_runs(kind, day, created_at DESC);
            ",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .manage(monitor.clone())
        .manage(health_tips.clone())
        .manage(overlay_tip.clone())
        .manage(input_counts.clone())
        .manage(window_size_mode.clone())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:fate.db", migrations)
                .build(),
        )
        .on_window_event(|window, event| {
            if window.label() == "main"
                && matches!(
                    event,
                    tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed
                )
            {
                destroy_overlay_windows(window);
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            update_settings,
            get_input_monitor_permission_status,
            request_input_monitor_permission,
            export_app_data,
            generate_ai_tips,
            generate_health_tips,
            set_health_tips,
            test_llm_model,
            preview_break_overlay,
            get_break_overlay_tip,
            close_break_overlay_preview,
            set_main_window_pinned,
            set_main_window_size_mode,
            complete_break_reminder
        ])
        .setup(move |app| {
            if let Some(window) = app.get_webview_window("main") {
                let title = versioned_main_window_title(&app.package_info().version.to_string());
                let _ = window.set_title(&title);
            }
            start_main_window_geometry_guard(app.handle().clone(), window_size_mode.clone());
            ensure_input_event_counter(input_counts.clone());
            start_input_activity_emitter(app.handle().clone(), input_counts.clone());
            start_activity_monitor(
                app.handle().clone(),
                monitor.clone(),
                health_tips.clone(),
                overlay_tip.clone(),
                input_counts.clone(),
            );
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Fate");
}
