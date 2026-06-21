use std::sync::{Arc, Mutex};

pub type SharedMonitor = Arc<Mutex<crate::activity::ActivityMonitor>>;
pub type SharedTips = Arc<Mutex<Vec<String>>>;
pub type SharedOverlayTip = Arc<Mutex<String>>;
pub type SharedInputCounts = Arc<Mutex<crate::input::InputEventCounts>>;
pub type SharedMainWindowSizeMode = Arc<Mutex<crate::window::MainWindowSizeMode>>;
