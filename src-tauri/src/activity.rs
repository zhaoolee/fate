use serde::{Deserialize, Serialize};
use std::{
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, State};

use crate::input::{input_event_counts, seconds_since_last_input, InputEventCounts};
use crate::overlay::show_break_overlay;
use crate::shared::{SharedInputCounts, SharedMonitor, SharedOverlayTip, SharedTips};

const ACTIVE_GRACE_SECS: f64 = 2.5;
const POLL_INTERVAL: Duration = Duration::from_secs(1);

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub work_minutes: u64,
    pub rest_minutes: u64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            work_minutes: 45,
            rest_minutes: 15,
        }
    }
}

#[derive(Clone, Copy)]
enum Phase {
    Waiting,
    Working,
    Resting,
    Reminding,
}

impl Phase {
    fn as_str(self) -> &'static str {
        match self {
            Self::Waiting => "waiting",
            Self::Working => "working",
            Self::Resting => "resting",
            Self::Reminding => "reminding",
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySnapshot {
    status: &'static str,
    work_cycle_id: u64,
    period_elapsed_secs: u64,
    idle_secs: u64,
    work_goal_secs: u64,
    rest_goal_secs: u64,
    today_work_secs: u64,
    today_rest_secs: u64,
    reminder_count: u32,
    last_event_unix_ms: u128,
    keyboard_count: u64,
    mouse_click_count: u64,
    message: String,
}

pub struct ActivityMonitor {
    phase: Phase,
    settings: AppSettings,
    period_started_at: Option<Instant>,
    work_cycle_id: u64,
    last_tick_at: Instant,
    today_work_secs: f64,
    today_rest_secs: f64,
    reminder_count: u32,
    message: String,
}

impl ActivityMonitor {
    pub fn new() -> Self {
        Self {
            phase: Phase::Waiting,
            settings: AppSettings::default(),
            period_started_at: None,
            work_cycle_id: 0,
            last_tick_at: Instant::now(),
            today_work_secs: 0.0,
            today_rest_secs: 0.0,
            reminder_count: 0,
            message: "等待第一次键盘或鼠标点击".to_string(),
        }
    }

    fn tick(&mut self, idle_secs: f64, input_counts: InputEventCounts) -> (ActivitySnapshot, bool) {
        let now = Instant::now();
        let delta = now.duration_since(self.last_tick_at).as_secs_f64();
        self.last_tick_at = now;
        self.add_elapsed(delta);

        let is_active = idle_secs <= ACTIVE_GRACE_SECS;
        let rest_goal_secs = self.rest_goal_secs_f64();
        let work_goal_secs = self.work_goal_secs_f64();
        let mut should_show_overlay = false;

        match self.phase {
            Phase::Waiting => {
                if is_active {
                    self.start_period(now, "检测到首次键盘或鼠标点击，开始本轮计时");
                }
            }
            Phase::Working => {
                if idle_secs >= rest_goal_secs {
                    self.move_idle_time_to_rest(idle_secs);
                    self.phase = Phase::Resting;
                    self.period_started_at = None;
                    self.message =
                        "连续无操作已达到休息判定，本段无操作时间已回溯为休息".to_string();
                } else if self.period_elapsed_secs(now) as f64 >= work_goal_secs {
                    self.phase = Phase::Reminding;
                    self.reminder_count += 1;
                    should_show_overlay = true;
                    self.message = "本轮计时已达到工作时间，显示休息浮层".to_string();
                } else {
                    self.message = "正在监测键盘和鼠标点击，本轮计时进行中".to_string();
                }
            }
            Phase::Resting => {
                if is_active {
                    self.start_period(now, "休息中检测到新的键盘或鼠标点击，开启新的计时周期");
                } else {
                    self.message = "正在休息中，暂不触发提醒".to_string();
                }
            }
            Phase::Reminding => {
                self.message = "休息浮层显示中，等待倒计时结束或手动关闭".to_string();
            }
        }

        (
            self.snapshot(idle_secs, now, input_counts),
            should_show_overlay,
        )
    }

    fn add_elapsed(&mut self, delta: f64) {
        match self.phase {
            Phase::Working | Phase::Reminding => self.today_work_secs += delta,
            Phase::Resting => self.today_rest_secs += delta,
            Phase::Waiting => {}
        }
    }

    fn start_period(&mut self, now: Instant, message: &str) {
        self.phase = Phase::Working;
        self.period_started_at = Some(now);
        self.work_cycle_id = self.work_cycle_id.saturating_add(1);
        self.message = message.to_string();
    }

    pub(crate) fn complete_reminder(&mut self) {
        let now = Instant::now();
        self.phase = Phase::Working;
        self.period_started_at = Some(now);
        self.work_cycle_id = self.work_cycle_id.saturating_add(1);
        self.last_tick_at = now;
        self.message = "提醒已关闭，立即开启新的 45 分钟提醒计时周期".to_string();
    }

    pub fn update_settings(&mut self, settings: AppSettings) {
        self.settings = AppSettings {
            work_minutes: settings.work_minutes.clamp(1, 180),
            rest_minutes: settings.rest_minutes.clamp(1, 60),
        };
        self.message = "设置已更新".to_string();
    }

    fn move_idle_time_to_rest(&mut self, idle_secs: f64) {
        let rollback = idle_secs.min(self.today_work_secs);
        self.today_work_secs -= rollback;
        self.today_rest_secs += rollback;
    }

    pub(crate) fn snapshot(
        &self,
        idle_secs: f64,
        now: Instant,
        input_counts: InputEventCounts,
    ) -> ActivitySnapshot {
        ActivitySnapshot {
            status: self.phase.as_str(),
            work_cycle_id: self.work_cycle_id,
            period_elapsed_secs: self.period_elapsed_secs(now),
            idle_secs: idle_secs.max(0.0) as u64,
            work_goal_secs: self.work_goal_secs_f64() as u64,
            rest_goal_secs: self.rest_goal_secs_f64() as u64,
            today_work_secs: self.today_work_secs.max(0.0) as u64,
            today_rest_secs: self.today_rest_secs.max(0.0) as u64,
            reminder_count: self.reminder_count,
            last_event_unix_ms: input_counts.last_event_unix_ms,
            keyboard_count: input_counts.keyboard_count,
            mouse_click_count: input_counts.mouse_click_count,
            message: self.message.clone(),
        }
    }

    fn period_elapsed_secs(&self, now: Instant) -> u64 {
        self.period_started_at
            .map(|started_at| now.duration_since(started_at).as_secs())
            .unwrap_or(0)
    }

    fn work_goal_secs_f64(&self) -> f64 {
        self.settings.work_minutes.max(1) as f64 * 60.0
    }

    fn rest_goal_secs_f64(&self) -> f64 {
        self.settings.rest_minutes.max(1) as f64 * 60.0
    }
}

#[tauri::command]
pub fn get_snapshot(
    monitor: State<SharedMonitor>,
    input_counts: State<SharedInputCounts>,
) -> Result<ActivitySnapshot, String> {
    let input_counts = input_event_counts(&input_counts);
    let idle_secs = seconds_since_last_input(input_counts);
    monitor
        .lock()
        .map_err(|_| "无法读取监测状态".to_string())
        .map(|monitor| monitor.snapshot(idle_secs, Instant::now(), input_counts))
}

#[tauri::command]
pub fn update_settings(
    settings: AppSettings,
    monitor: State<SharedMonitor>,
    input_counts: State<SharedInputCounts>,
) -> Result<ActivitySnapshot, String> {
    let input_counts = input_event_counts(&input_counts);
    let idle_secs = seconds_since_last_input(input_counts);
    let mut monitor = monitor.lock().map_err(|_| "无法更新设置".to_string())?;
    monitor.update_settings(settings);
    Ok(monitor.snapshot(idle_secs, Instant::now(), input_counts))
}

pub fn start_activity_monitor(
    app: AppHandle,
    monitor: SharedMonitor,
    health_tips: SharedTips,
    overlay_tip: SharedOverlayTip,
    input_counts: SharedInputCounts,
) {
    thread::spawn(move || loop {
        thread::sleep(POLL_INTERVAL);

        let input_counts = input_event_counts(&input_counts);
        let idle_secs = seconds_since_last_input(input_counts);
        let (snapshot, should_show_overlay) = {
            let mut monitor = match monitor.lock() {
                Ok(monitor) => monitor,
                Err(_) => continue,
            };
            monitor.tick(idle_secs, input_counts)
        };

        let _ = app.emit("activity://snapshot", &snapshot);

        if should_show_overlay {
            let _ = show_break_overlay(&app, &health_tips, &overlay_tip);
        }
    });
}
