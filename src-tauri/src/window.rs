use std::{
    thread,
    time::Duration,
};
use tauri::{AppHandle, LogicalSize, Manager, State};

use crate::shared::SharedMainWindowSizeMode;

const MAIN_WINDOW_MINI_WIDTH: f64 = 390.0;
const MAIN_WINDOW_MINI_HEIGHT: f64 = 631.0;
const MAIN_WINDOW_WIDE_WIDTH: f64 = 960.0;
const MAIN_WINDOW_WIDE_HEIGHT: f64 = 640.0;
const MAIN_WINDOW_MIN_SIDE: f64 = 320.0;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum MainWindowSizeMode {
    Mini,
    Wide,
}

impl MainWindowSizeMode {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "mini" => Ok(Self::Mini),
            "wide" => Ok(Self::Wide),
            _ => Err("未知窗口尺寸模式".to_string()),
        }
    }

    fn outer_size(self) -> (f64, f64) {
        match self {
            Self::Mini => (MAIN_WINDOW_MINI_WIDTH, MAIN_WINDOW_MINI_HEIGHT),
            Self::Wide => (MAIN_WINDOW_WIDE_WIDTH, MAIN_WINDOW_WIDE_HEIGHT),
        }
    }
}

#[derive(Clone, Copy)]
#[cfg(not(target_os = "macos"))]
struct ScreenBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[tauri::command]
pub fn set_main_window_pinned(app: AppHandle, pinned: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "无法获取主窗口".to_string())?;
    window
        .set_always_on_top(pinned)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_main_window_size_mode(
    app: AppHandle,
    size_mode: State<SharedMainWindowSizeMode>,
    mode: String,
) -> Result<(), String> {
    let next_mode = MainWindowSizeMode::parse(&mode)?;
    {
        let mut current_mode = size_mode
            .lock()
            .map_err(|_| "窗口尺寸状态不可用".to_string())?;
        *current_mode = next_mode;
    }
    schedule_main_window_geometry(&app, size_mode.inner().clone(), true);
    Ok(())
}

pub fn start_main_window_geometry_guard(app: AppHandle, size_mode: SharedMainWindowSizeMode) {
    schedule_main_window_geometry(&app, size_mode.clone(), false);

    thread::spawn(move || {
        for _ in 0..3 {
            thread::sleep(Duration::from_millis(120));
            schedule_main_window_geometry(&app, size_mode.clone(), false);
        }
    });
}

fn schedule_main_window_geometry(
    app: &AppHandle,
    size_mode: SharedMainWindowSizeMode,
    animate: bool,
) {
    let app = app.clone();
    let _ = app.run_on_main_thread({
        let app = app.clone();
        move || apply_main_window_geometry(&app, size_mode, animate)
    });
}

fn apply_main_window_geometry(app: &AppHandle, size_mode: SharedMainWindowSizeMode, animate: bool) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let mode = size_mode
        .lock()
        .map(|guard| *guard)
        .unwrap_or(MainWindowSizeMode::Mini);

    let _ = window.set_min_size(Some(LogicalSize::new(
        MAIN_WINDOW_MIN_SIDE,
        MAIN_WINDOW_MIN_SIDE,
    )));
    let _ = window.set_resizable(false);
    apply_main_window_frame(app, &window, mode, animate);
}

#[cfg(target_os = "macos")]
fn apply_main_window_frame(
    _app: &AppHandle,
    window: &tauri::WebviewWindow,
    mode: MainWindowSizeMode,
    animate: bool,
) {
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSScreen, NSWindow};
    use objc2_foundation::{NSPoint, NSRect, NSSize};

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    if let Ok(ns_window) = window.ns_window() {
        let ns_window = unsafe { &*(ns_window.cast::<NSWindow>()) };
        let visible_frame = ns_window
            .screen()
            .map(|screen| screen.visibleFrame())
            .or_else(|| NSScreen::mainScreen(mtm).map(|screen| screen.visibleFrame()));
        let Some(visible_frame) = visible_frame else {
            return;
        };
        let current_frame = ns_window.frame();
        let (target_width, target_height) = mode.outer_size();
        let width = target_width.min(visible_frame.size.width).max(1.0);
        let height = target_height.min(visible_frame.size.height).max(1.0);
        if width <= 0.0 || height <= 0.0 {
            return;
        }

        let max_x =
            (visible_frame.origin.x + visible_frame.size.width - width).max(visible_frame.origin.x);
        let max_y = (visible_frame.origin.y + visible_frame.size.height - height)
            .max(visible_frame.origin.y);
        let top = current_frame.origin.y + current_frame.size.height;
        let x = current_frame.origin.x.clamp(visible_frame.origin.x, max_x);
        let y = (top - height).clamp(visible_frame.origin.y, max_y);
        let target_frame = NSRect::new(NSPoint::new(x, y), NSSize::new(width, height));

        ns_window.setFrame_display_animate(target_frame, true, animate);
    }
}

#[cfg(not(target_os = "macos"))]
fn apply_main_window_frame(
    app: &AppHandle,
    window: &tauri::WebviewWindow,
    mode: MainWindowSizeMode,
    _animate: bool,
) {
    let scale = window.scale_factor().unwrap_or(1.0);
    let (chrome_width, chrome_height) = match (window.outer_size(), window.inner_size()) {
        (Ok(outer), Ok(inner)) => (
            outer.width.saturating_sub(inner.width) as f64 / scale,
            outer.height.saturating_sub(inner.height) as f64 / scale,
        ),
        _ => (0.0, 0.0),
    };
    let (target_width, target_height) = mode.outer_size();
    let inner_width = (target_width - chrome_width).max(MAIN_WINDOW_MIN_SIDE);
    let inner_height = (target_height - chrome_height).max(MAIN_WINDOW_MIN_SIDE);
    let _ = window.set_size(LogicalSize::new(inner_width, inner_height));

    let screen = main_work_area_bounds(app).unwrap_or(ScreenBounds {
        x: 0.0,
        y: 0.0,
        width: inner_width,
        height: inner_height,
    });
    let _ = window.set_position(tauri::PhysicalPosition::new(
        screen.x.round() as i32,
        screen.y.round() as i32,
    ));
}

#[cfg(not(target_os = "macos"))]
fn main_work_area_bounds(app: &AppHandle) -> Option<ScreenBounds> {
    let monitor = app.primary_monitor().ok().flatten()?;
    let work_area = monitor.work_area();
    Some(ScreenBounds {
        x: work_area.position.x as f64,
        y: work_area.position.y as f64,
        width: work_area.size.width as f64,
        height: work_area.size.height as f64,
    })
}
