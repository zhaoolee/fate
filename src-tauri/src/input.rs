use serde::Serialize;
#[cfg(target_os = "windows")]
use std::sync::OnceLock;
use std::{
    ffi::c_void,
    sync::{Arc, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, State};

use crate::shared::SharedInputCounts;

#[cfg(target_os = "windows")]
static WINDOWS_INPUT_COUNTS: OnceLock<SharedInputCounts> = OnceLock::new();

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputMonitorPermissionStatus {
    supported: bool,
    authorized: bool,
    listening: bool,
    requires_permission: bool,
    needs_permission: bool,
    keyboard_count: u64,
    mouse_click_count: u64,
    last_event_unix_ms: u128,
    message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputActivityEvent {
    keyboard_count: u64,
    mouse_click_count: u64,
    last_event_unix_ms: u128,
}

#[derive(Clone, Copy, Default)]
pub struct InputEventCounts {
    pub keyboard_count: u64,
    pub mouse_click_count: u64,
    pub last_event_unix_ms: u128,
    pub listener_starting: bool,
    pub listener_active: bool,
    pub listener_failed: bool,
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct WinPoint {
    x: i32,
    y: i32,
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[derive(Clone, Copy)]
struct WinMsg {
    hwnd: *mut c_void,
    message: u32,
    w_param: usize,
    l_param: isize,
    time: u32,
    pt: WinPoint,
    l_private: u32,
}

#[cfg(target_os = "windows")]
impl Default for WinMsg {
    fn default() -> Self {
        Self {
            hwnd: std::ptr::null_mut(),
            message: 0,
            w_param: 0,
            l_param: 0,
            time: 0,
            pt: WinPoint::default(),
            l_private: 0,
        }
    }
}

#[tauri::command]
pub fn get_input_monitor_permission_status(
    input_counts: State<SharedInputCounts>,
) -> InputMonitorPermissionStatus {
    ensure_input_event_counter(input_counts.inner().clone());
    input_monitor_permission_status(&input_counts)
}

#[tauri::command]
pub fn request_input_monitor_permission(
    input_counts: State<SharedInputCounts>,
) -> InputMonitorPermissionStatus {
    request_input_event_access();
    ensure_input_event_counter(input_counts.inner().clone());
    let status = input_monitor_permission_status(&input_counts);
    open_input_monitoring_settings();
    status
}

pub fn now_unix_ms() -> u128 {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    now_ms
}

pub fn seconds_since_last_input(input_counts: InputEventCounts) -> f64 {
    if input_counts.last_event_unix_ms == 0 {
        return 3.0;
    }

    now_unix_ms().saturating_sub(input_counts.last_event_unix_ms) as f64 / 1000.0
}

pub fn input_event_counts(input_counts: &SharedInputCounts) -> InputEventCounts {
    input_counts
        .lock()
        .map(|counts| *counts)
        .unwrap_or_default()
}

pub fn start_input_activity_emitter(app: AppHandle, input_counts: SharedInputCounts) {
    thread::spawn(move || {
        let mut last_keyboard_count = 0;
        let mut last_mouse_click_count = 0;

        loop {
            thread::sleep(Duration::from_millis(80));

            let counts = input_event_counts(&input_counts);
            if counts.keyboard_count == last_keyboard_count
                && counts.mouse_click_count == last_mouse_click_count
            {
                continue;
            }

            last_keyboard_count = counts.keyboard_count;
            last_mouse_click_count = counts.mouse_click_count;
            let _ = app.emit(
                "input://activity",
                InputActivityEvent {
                    keyboard_count: counts.keyboard_count,
                    mouse_click_count: counts.mouse_click_count,
                    last_event_unix_ms: counts.last_event_unix_ms,
                },
            );
        }
    });
}

fn input_monitor_permission_status(
    input_counts: &SharedInputCounts,
) -> InputMonitorPermissionStatus {
    let counts = input_event_counts(input_counts);

    #[cfg(target_os = "macos")]
    {
        let authorized = input_event_access_authorized();
        let listening = authorized && counts.listener_active;
        return InputMonitorPermissionStatus {
            supported: true,
            authorized,
            listening,
            requires_permission: true,
            needs_permission: !authorized,
            keyboard_count: counts.keyboard_count,
            mouse_click_count: counts.mouse_click_count,
            last_event_unix_ms: counts.last_event_unix_ms,
            message: input_monitor_permission_message(authorized, counts),
        };
    }

    #[cfg(target_os = "windows")]
    {
        let authorized = input_event_access_authorized();
        return InputMonitorPermissionStatus {
            supported: true,
            authorized,
            listening: counts.listener_active,
            requires_permission: false,
            needs_permission: false,
            keyboard_count: counts.keyboard_count,
            mouse_click_count: counts.mouse_click_count,
            last_event_unix_ms: counts.last_event_unix_ms,
            message: windows_input_monitor_permission_message(counts),
        };
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        InputMonitorPermissionStatus {
            supported: false,
            authorized: false,
            listening: false,
            requires_permission: false,
            needs_permission: false,
            keyboard_count: counts.keyboard_count,
            mouse_click_count: counts.mouse_click_count,
            last_event_unix_ms: counts.last_event_unix_ms,
            message: "当前平台暂未启用键盘和鼠标点击权限检测".to_string(),
        }
    }
}

#[cfg(target_os = "windows")]
fn windows_input_monitor_permission_message(counts: InputEventCounts) -> String {
    if counts.listener_active {
        return "Windows 已启用，正在监听键盘和鼠标点击".to_string();
    }
    if counts.listener_starting {
        return "Windows 输入监测正在启动".to_string();
    }
    if counts.listener_failed {
        return "Windows 输入监测启动失败".to_string();
    }
    "Windows 输入监测等待启动".to_string()
}

#[cfg(target_os = "macos")]
fn input_monitor_permission_message(authorized: bool, counts: InputEventCounts) -> String {
    if !authorized {
        return "需要允许 Fate 监听输入事件".to_string();
    }
    if counts.listener_active {
        return "已获得权限，正在监听键盘和鼠标点击".to_string();
    }
    if counts.listener_starting {
        return "权限已允许，正在启动输入监测".to_string();
    }
    if counts.listener_failed {
        return "权限已允许，但输入监测启动失败".to_string();
    }
    "权限已允许，等待输入监测启动".to_string()
}

#[cfg(target_os = "macos")]
fn input_event_access_authorized() -> bool {
    unsafe { CGPreflightListenEventAccess() }
}

#[cfg(target_os = "windows")]
fn input_event_access_authorized() -> bool {
    true
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn input_event_access_authorized() -> bool {
    false
}

#[cfg(target_os = "macos")]
fn request_input_event_access() -> bool {
    unsafe { CGRequestListenEventAccess() }
}

#[cfg(target_os = "windows")]
fn request_input_event_access() -> bool {
    true
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn request_input_event_access() -> bool {
    false
}

#[cfg(target_os = "macos")]
fn open_input_monitoring_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent")
        .spawn();
}

#[cfg(not(target_os = "macos"))]
fn open_input_monitoring_settings() {}

#[cfg(target_os = "macos")]
fn mark_input_listener_permission_missing(input_counts: &SharedInputCounts) {
    if let Ok(mut counts) = input_counts.lock() {
        counts.listener_starting = false;
        counts.listener_active = false;
        counts.listener_failed = false;
    }
}

fn mark_input_listener_starting(input_counts: &SharedInputCounts) -> bool {
    input_counts
        .lock()
        .map(|mut counts| {
            if counts.listener_active || counts.listener_starting {
                return false;
            }
            counts.listener_starting = true;
            counts.listener_failed = false;
            true
        })
        .unwrap_or(false)
}

fn mark_input_listener_active(input_counts: &SharedInputCounts) {
    if let Ok(mut counts) = input_counts.lock() {
        counts.listener_starting = false;
        counts.listener_active = true;
        counts.listener_failed = false;
    }
}

fn mark_input_listener_failed(input_counts: &SharedInputCounts) {
    if let Ok(mut counts) = input_counts.lock() {
        counts.listener_starting = false;
        counts.listener_active = false;
        counts.listener_failed = true;
    }
}

fn mark_input_listener_stopped(input_counts: &SharedInputCounts) {
    if let Ok(mut counts) = input_counts.lock() {
        counts.listener_starting = false;
        counts.listener_active = false;
    }
}

#[cfg(target_os = "macos")]
pub fn ensure_input_event_counter(input_counts: SharedInputCounts) {
    if !input_event_access_authorized() {
        mark_input_listener_permission_missing(&input_counts);
        return;
    }

    if mark_input_listener_starting(&input_counts) {
        start_input_event_counter(input_counts);
    }
}

#[cfg(target_os = "windows")]
pub fn ensure_input_event_counter(input_counts: SharedInputCounts) {
    if mark_input_listener_starting(&input_counts) {
        start_input_event_counter(input_counts);
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn ensure_input_event_counter(_input_counts: SharedInputCounts) {}

#[cfg(target_os = "macos")]
fn start_input_event_counter(input_counts: SharedInputCounts) {
    thread::spawn(move || unsafe {
        const K_CG_SESSION_EVENT_TAP: u32 = 1;
        const K_CG_HEAD_INSERT_EVENT_TAP: u32 = 0;
        const K_CG_EVENT_TAP_OPTION_LISTEN_ONLY: u32 = 1;
        const K_CG_EVENT_LEFT_MOUSE_DOWN: u32 = 1;
        const K_CG_EVENT_RIGHT_MOUSE_DOWN: u32 = 3;
        const K_CG_EVENT_KEY_DOWN: u32 = 10;
        const K_CG_EVENT_OTHER_MOUSE_DOWN: u32 = 25;

        let mask = (1_u64 << K_CG_EVENT_LEFT_MOUSE_DOWN)
            | (1_u64 << K_CG_EVENT_RIGHT_MOUSE_DOWN)
            | (1_u64 << K_CG_EVENT_KEY_DOWN)
            | (1_u64 << K_CG_EVENT_OTHER_MOUSE_DOWN);
        let callback_counts = input_counts.clone();
        let user_info = Arc::into_raw(callback_counts) as *mut c_void;
        let tap = CGEventTapCreate(
            K_CG_SESSION_EVENT_TAP,
            K_CG_HEAD_INSERT_EVENT_TAP,
            K_CG_EVENT_TAP_OPTION_LISTEN_ONLY,
            mask,
            input_event_tap_callback,
            user_info,
        );
        if tap.is_null() {
            let _ = Arc::from_raw(user_info as *const Mutex<InputEventCounts>);
            mark_input_listener_failed(&input_counts);
            return;
        }

        let source = CFMachPortCreateRunLoopSource(std::ptr::null(), tap, 0);
        if source.is_null() {
            CFRelease(tap);
            let _ = Arc::from_raw(user_info as *const Mutex<InputEventCounts>);
            mark_input_listener_failed(&input_counts);
            return;
        }

        let run_loop = CFRunLoopGetCurrent();
        CFRunLoopAddSource(run_loop, source, kCFRunLoopCommonModes);
        CGEventTapEnable(tap, true);
        mark_input_listener_active(&input_counts);
        CFRunLoopRun();
        mark_input_listener_stopped(&input_counts);
    });
}

#[cfg(target_os = "windows")]
fn start_input_event_counter(input_counts: SharedInputCounts) {
    thread::spawn(move || unsafe {
        const WH_KEYBOARD_LL: i32 = 13;
        const WH_MOUSE_LL: i32 = 14;

        let _ = WINDOWS_INPUT_COUNTS.set(input_counts.clone());
        let module = GetModuleHandleW(std::ptr::null());
        let keyboard_hook = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(windows_keyboard_hook_callback),
            module,
            0,
        );
        let mouse_hook =
            SetWindowsHookExW(WH_MOUSE_LL, Some(windows_mouse_hook_callback), module, 0);

        if keyboard_hook.is_null() || mouse_hook.is_null() {
            if !keyboard_hook.is_null() {
                UnhookWindowsHookEx(keyboard_hook);
            }
            if !mouse_hook.is_null() {
                UnhookWindowsHookEx(mouse_hook);
            }
            mark_input_listener_failed(&input_counts);
            return;
        }

        mark_input_listener_active(&input_counts);

        let mut msg = WinMsg::default();
        loop {
            let result = GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0);
            if result <= 0 {
                break;
            }
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        UnhookWindowsHookEx(keyboard_hook);
        UnhookWindowsHookEx(mouse_hook);
        mark_input_listener_stopped(&input_counts);
    });
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn start_input_event_counter(_input_counts: SharedInputCounts) {}

#[cfg(target_os = "windows")]
unsafe extern "system" fn windows_keyboard_hook_callback(
    n_code: i32,
    w_param: usize,
    l_param: isize,
) -> isize {
    const HC_ACTION: i32 = 0;
    const WM_KEYDOWN: u32 = 0x0100;
    const WM_SYSKEYDOWN: u32 = 0x0104;

    if n_code == HC_ACTION && matches!(w_param as u32, WM_KEYDOWN | WM_SYSKEYDOWN) {
        record_windows_input_event(true);
    }

    CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param)
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn windows_mouse_hook_callback(
    n_code: i32,
    w_param: usize,
    l_param: isize,
) -> isize {
    const HC_ACTION: i32 = 0;
    const WM_LBUTTONDOWN: u32 = 0x0201;
    const WM_RBUTTONDOWN: u32 = 0x0204;
    const WM_MBUTTONDOWN: u32 = 0x0207;
    const WM_XBUTTONDOWN: u32 = 0x020b;

    if n_code == HC_ACTION
        && matches!(
            w_param as u32,
            WM_LBUTTONDOWN | WM_RBUTTONDOWN | WM_MBUTTONDOWN | WM_XBUTTONDOWN
        )
    {
        record_windows_input_event(false);
    }

    CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param)
}

#[cfg(target_os = "windows")]
fn record_windows_input_event(is_keyboard: bool) {
    let Some(input_counts) = WINDOWS_INPUT_COUNTS.get() else {
        return;
    };

    if let Ok(mut counts) = input_counts.lock() {
        if is_keyboard {
            counts.keyboard_count = counts.keyboard_count.saturating_add(1);
        } else {
            counts.mouse_click_count = counts.mouse_click_count.saturating_add(1);
        }
        counts.last_event_unix_ms = now_unix_ms();
    }
}

#[cfg(target_os = "macos")]
unsafe extern "C" fn input_event_tap_callback(
    _proxy: *mut c_void,
    event_type: u32,
    event: *mut c_void,
    user_info: *mut c_void,
) -> *mut c_void {
    const K_CG_EVENT_LEFT_MOUSE_DOWN: u32 = 1;
    const K_CG_EVENT_RIGHT_MOUSE_DOWN: u32 = 3;
    const K_CG_EVENT_KEY_DOWN: u32 = 10;
    const K_CG_EVENT_OTHER_MOUSE_DOWN: u32 = 25;

    if !user_info.is_null() {
        let input_counts = &*(user_info as *const Mutex<InputEventCounts>);
        if let Ok(mut counts) = input_counts.lock() {
            match event_type {
                K_CG_EVENT_KEY_DOWN => {
                    counts.keyboard_count += 1;
                    counts.last_event_unix_ms = now_unix_ms();
                }
                K_CG_EVENT_LEFT_MOUSE_DOWN
                | K_CG_EVENT_RIGHT_MOUSE_DOWN
                | K_CG_EVENT_OTHER_MOUSE_DOWN => {
                    counts.mouse_click_count += 1;
                    counts.last_event_unix_ms = now_unix_ms();
                }
                _ => {}
            }
        }
    }

    event
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn CGPreflightListenEventAccess() -> bool;
    fn CGRequestListenEventAccess() -> bool;
    fn CGEventTapCreate(
        tap: u32,
        place: u32,
        options: u32,
        events_of_interest: u64,
        callback: unsafe extern "C" fn(
            proxy: *mut c_void,
            event_type: u32,
            event: *mut c_void,
            user_info: *mut c_void,
        ) -> *mut c_void,
        user_info: *mut c_void,
    ) -> *mut c_void;
    fn CGEventTapEnable(tap: *mut c_void, enable: bool);
}

#[cfg(target_os = "macos")]
#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    static kCFRunLoopCommonModes: *const c_void;
    fn CFMachPortCreateRunLoopSource(
        allocator: *const c_void,
        port: *mut c_void,
        order: isize,
    ) -> *mut c_void;
    fn CFRunLoopGetCurrent() -> *mut c_void;
    fn CFRunLoopAddSource(rl: *mut c_void, source: *mut c_void, mode: *const c_void);
    fn CFRunLoopRun();
    fn CFRelease(cf: *const c_void);
}

#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    fn SetWindowsHookExW(
        id_hook: i32,
        lpfn: Option<unsafe extern "system" fn(i32, usize, isize) -> isize>,
        hmod: *mut c_void,
        dw_thread_id: u32,
    ) -> *mut c_void;
    fn CallNextHookEx(hhk: *mut c_void, n_code: i32, w_param: usize, l_param: isize) -> isize;
    fn UnhookWindowsHookEx(hhk: *mut c_void) -> i32;
    fn GetMessageW(lp_msg: *mut WinMsg, hwnd: *mut c_void, min: u32, max: u32) -> i32;
    fn TranslateMessage(lp_msg: *const WinMsg) -> i32;
    fn DispatchMessageW(lp_msg: *const WinMsg) -> isize;
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn GetModuleHandleW(lp_module_name: *const u16) -> *mut c_void;
}
