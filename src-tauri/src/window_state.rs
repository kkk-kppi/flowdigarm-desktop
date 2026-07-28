use std::{
    sync::{
        mpsc::{self, Receiver, RecvTimeoutError, Sender},
        Arc, Mutex,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use tauri::{
    AppHandle, LogicalSize, Manager, Monitor, PhysicalPosition, WebviewWindow, WindowEvent,
};

use crate::persistence::sqlite_repository::{PersistenceState, WindowState};

const INITIAL_SCALE: f64 = 0.9;
const MAX_INITIAL_ASPECT: f64 = 1.6;
const MIN_WIDTH: f64 = 960.0;
const MIN_HEIGHT: f64 = 600.0;
const MIN_VISIBLE_WIDTH: f64 = 64.0;
const MIN_VISIBLE_HEIGHT: f64 = 40.0;
const DEFAULT_WIDTH: f64 = 1280.0;
const DEFAULT_HEIGHT: f64 = 800.0;
const SAVE_DEBOUNCE: Duration = Duration::from_millis(250);
const FLUSH_TIMEOUT: Duration = Duration::from_millis(750);
const CENTER_ON_STARTUP_KEY: &str = "window.centerOnStartup";

fn work_area(monitor: &Monitor) -> WorkArea {
    WorkArea {
        x: monitor.work_area().position.x,
        y: monitor.work_area().position.y,
        width: monitor.work_area().size.width,
        height: monitor.work_area().size.height,
        scale_factor: monitor.scale_factor(),
    }
}

fn unix_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(i64::MAX as u128) as i64
}

fn safe_fallback_placement() -> WindowPlacement {
    WindowPlacement {
        x: 0,
        y: 0,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        maximized: false,
    }
}

fn parse_center_on_startup(value: Option<&str>) -> bool {
    value
        .and_then(|json| serde_json::from_str::<bool>(json).ok())
        .unwrap_or(false)
}

fn read_center_on_startup(persistence: &PersistenceState) -> bool {
    let value = persistence
        .repository()
        .ok()
        .and_then(|repository| repository.get_setting(CENTER_ON_STARTUP_KEY).ok())
        .flatten();
    parse_center_on_startup(value.as_deref())
}

fn complete_window_modes<E>(
    maximized: Result<bool, E>,
    minimized: Result<bool, E>,
    fullscreen: Result<bool, E>,
) -> Result<(bool, bool, bool), E> {
    Ok((maximized?, minimized?, fullscreen?))
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct WorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct WindowPlacement {
    pub x: i32,
    pub y: i32,
    pub width: f64,
    pub height: f64,
    pub maximized: bool,
}

pub(crate) fn adaptive_placement(work_area: &WorkArea) -> WindowPlacement {
    let scale = valid_scale(work_area.scale_factor);
    let preferred_min_width = MIN_WIDTH * scale;
    let preferred_min_height = MIN_HEIGHT * scale;
    let physical_height = (f64::from(work_area.height) * INITIAL_SCALE)
        .max(preferred_min_height.min(f64::from(work_area.height)))
        .min(f64::from(work_area.height));
    let physical_width = (f64::from(work_area.width) * INITIAL_SCALE)
        .min(physical_height * MAX_INITIAL_ASPECT)
        .max(preferred_min_width.min(f64::from(work_area.width)))
        .min(f64::from(work_area.width));
    let rounded_width = physical_width.round() as u32;
    let rounded_height = physical_height.round() as u32;

    WindowPlacement {
        x: work_area.x + ((work_area.width - rounded_width) / 2) as i32,
        y: work_area.y + ((work_area.height - rounded_height) / 2) as i32,
        width: (f64::from(rounded_width) / scale).round(),
        height: (f64::from(rounded_height) / scale).round(),
        maximized: false,
    }
}

pub(crate) fn restore_placement(
    state: &WindowState,
    work_areas: &[WorkArea],
    center_on_startup: bool,
) -> Option<WindowPlacement> {
    let saved_x = i32::try_from(state.x?).ok()?;
    let saved_y = i32::try_from(state.y?).ok()?;
    if state.width <= 0 || state.height <= 0 {
        return None;
    }
    let saved_width = state.width as f64;
    let saved_height = state.height as f64;
    let source = work_areas.iter().min_by_key(|area| {
        if contains_point(area, saved_x, saved_y) {
            0
        } else {
            point_distance_squared(area, saved_x, saved_y)
        }
    })?;
    let source_scale = valid_scale(source.scale_factor);
    let physical_width = saved_width * source_scale;
    let physical_height = saved_height * source_scale;
    let eligible = |area: &&WorkArea| {
        let scale = valid_scale(area.scale_factor);
        intersection_width(saved_x, physical_width, area.x, f64::from(area.width))
            >= MIN_VISIBLE_WIDTH * scale
            && intersection_width(saved_y, physical_height, area.y, f64::from(area.height))
                >= MIN_VISIBLE_HEIGHT * scale
    };
    let work_area = if eligible(&source) {
        source
    } else {
        work_areas.iter().filter(eligible).max_by_key(|area| {
            visible_area(saved_x, saved_y, physical_width, physical_height, area)
        })?
    };
    let scale = valid_scale(work_area.scale_factor);

    let logical_work_width = f64::from(work_area.width) / scale;
    let logical_work_height = f64::from(work_area.height) / scale;
    let width = saved_width.clamp(MIN_WIDTH.min(logical_work_width), logical_work_width);
    let height = saved_height.clamp(MIN_HEIGHT.min(logical_work_height), logical_work_height);
    let physical_width = (width * scale).round() as i32;
    let physical_height = (height * scale).round() as i32;
    let max_x = work_area.x + work_area.width as i32 - physical_width;
    let max_y = work_area.y + work_area.height as i32 - physical_height;
    let (x, y) = if center_on_startup {
        (
            work_area.x + (work_area.width as i32 - physical_width) / 2,
            work_area.y + (work_area.height as i32 - physical_height) / 2,
        )
    } else {
        (
            saved_x.clamp(work_area.x, max_x.max(work_area.x)),
            saved_y.clamp(work_area.y, max_y.max(work_area.y)),
        )
    };

    Some(WindowPlacement {
        x,
        y,
        width,
        height,
        maximized: state.maximized,
    })
}

fn select_initial_placement(window: &WebviewWindow) -> Result<WindowPlacement, String> {
    let monitors = window
        .available_monitors()
        .map_err(|error| error.to_string())?;
    let work_areas: Vec<_> = monitors.iter().map(work_area).collect();
    let persistence = window.app_handle().state::<PersistenceState>();
    let center_on_startup = read_center_on_startup(&persistence);
    if let Ok(repository) = persistence.repository() {
        match repository.get_window_state() {
            Ok(Some(state)) => {
                if let Some(placement) = restore_placement(&state, &work_areas, center_on_startup) {
                    return Ok(placement);
                }
            }
            Ok(None) => {}
            Err(error) => eprintln!("窗口状态读取失败，将使用首次启动布局：{error}"),
        }
    }
    let primary = window
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .or_else(|| monitors.into_iter().next())
        .ok_or_else(|| "未找到可用显示器".to_owned())?;
    Ok(adaptive_placement(&work_area(&primary)))
}

fn valid_scale(scale: f64) -> f64 {
    if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        1.0
    }
}

fn intersection_width(start: i32, length: f64, area_start: i32, area_length: f64) -> f64 {
    let left = f64::from(start).max(f64::from(area_start));
    let right = (f64::from(start) + length).min(f64::from(area_start) + area_length);
    (right - left).max(0.0)
}

fn contains_point(area: &WorkArea, x: i32, y: i32) -> bool {
    let right = i64::from(area.x) + i64::from(area.width);
    let bottom = i64::from(area.y) + i64::from(area.height);
    i64::from(x) >= i64::from(area.x)
        && i64::from(x) < right
        && i64::from(y) >= i64::from(area.y)
        && i64::from(y) < bottom
}

fn point_distance_squared(area: &WorkArea, x: i32, y: i32) -> u128 {
    let x = i64::from(x);
    let y = i64::from(y);
    let left = i64::from(area.x);
    let top = i64::from(area.y);
    let right = left + i64::from(area.width);
    let bottom = top + i64::from(area.height);
    let dx = if x < left {
        left - x
    } else if x >= right {
        x - right + 1
    } else {
        0
    };
    let dy = if y < top {
        top - y
    } else if y >= bottom {
        y - bottom + 1
    } else {
        0
    };
    (dx as u128).pow(2) + (dy as u128).pow(2)
}

fn visible_area(x: i32, y: i32, physical_width: f64, physical_height: f64, area: &WorkArea) -> u64 {
    let width = intersection_width(x, physical_width, area.x, f64::from(area.width));
    let height = intersection_width(y, physical_height, area.y, f64::from(area.height));
    (width * height).round().max(0.0) as u64
}

#[derive(Debug)]
pub(crate) struct TrackedWindowState {
    state: WindowState,
}

impl TrackedWindowState {
    pub(crate) fn new(placement: WindowPlacement, updated_at: i64) -> Self {
        Self {
            state: WindowState {
                x: Some(i64::from(placement.x)),
                y: Some(i64::from(placement.y)),
                width: placement.width.round() as i64,
                height: placement.height.round() as i64,
                maximized: placement.maximized,
                fullscreen: false,
                updated_at,
            },
        }
    }

    pub(crate) fn observe(
        &mut self,
        position: Option<(i32, i32)>,
        logical_size: Option<(f64, f64)>,
        maximized: bool,
        minimized: bool,
        fullscreen: bool,
        updated_at: i64,
    ) {
        if !maximized && !minimized && !fullscreen {
            if let Some((x, y)) = position {
                self.state.x = Some(i64::from(x));
                self.state.y = Some(i64::from(y));
            }
            if let Some((width, height)) = logical_size {
                if width.is_finite() && height.is_finite() && width > 0.0 && height > 0.0 {
                    self.state.width = width.round() as i64;
                    self.state.height = height.round() as i64;
                }
            }
        }
        if !minimized && !fullscreen {
            self.state.maximized = maximized;
        }
        self.state.fullscreen = false;
        self.state.updated_at = updated_at;
    }

    pub(crate) fn snapshot(&self) -> WindowState {
        self.state.clone()
    }
}

#[derive(Debug)]
enum SaveRequest {
    Schedule(WindowState),
    Flush(WindowState, Sender<()>),
}

#[derive(Clone)]
pub(crate) struct SaveScheduler {
    sender: Arc<Mutex<Option<Sender<SaveRequest>>>>,
}

impl SaveScheduler {
    pub(crate) fn spawn(app: AppHandle) -> Self {
        let (sender, receiver) = mpsc::channel();
        match thread::Builder::new()
            .name("window-state-saver".into())
            .spawn(move || {
                run_save_worker(receiver, SAVE_DEBOUNCE, move |state| {
                    persist_window_state(&app, state)
                });
            }) {
            Ok(_) => Self {
                sender: Arc::new(Mutex::new(Some(sender))),
            },
            Err(error) => {
                eprintln!("窗口状态保存线程启动失败，本次运行不保存窗口状态：{error}");
                Self {
                    sender: Arc::new(Mutex::new(None)),
                }
            }
        }
    }

    pub(crate) fn schedule(&self, state: WindowState) {
        let Ok(mut sender) = self.sender.lock() else {
            return;
        };
        let result = match sender.as_ref() {
            Some(sender) => sender.send(SaveRequest::Schedule(state)),
            None => return,
        };
        if let Err(error) = result {
            *sender = None;
            eprintln!("窗口状态保存通道已断开，本次运行停止保存：{error}");
        }
    }

    pub(crate) fn flush(&self, state: WindowState) -> bool {
        self.flush_with_timeout(state, FLUSH_TIMEOUT)
    }

    fn flush_with_timeout(&self, state: WindowState, timeout: Duration) -> bool {
        let (completion_sender, completion_receiver) = mpsc::channel();
        {
            let Ok(mut sender) = self.sender.lock() else {
                return false;
            };
            let result = match sender.as_ref() {
                Some(sender) => sender.send(SaveRequest::Flush(state, completion_sender)),
                None => return false,
            };
            if let Err(error) = result {
                *sender = None;
                eprintln!("窗口状态保存通道已断开，本次运行停止保存：{error}");
                return false;
            }
        }
        match completion_receiver.recv_timeout(timeout) {
            Ok(()) => true,
            Err(RecvTimeoutError::Timeout) => {
                eprintln!("窗口状态刷新等待超时，继续关闭流程");
                false
            }
            Err(RecvTimeoutError::Disconnected) => {
                if let Ok(mut sender) = self.sender.lock() {
                    *sender = None;
                }
                eprintln!("窗口状态刷新确认通道已断开，继续关闭流程");
                false
            }
        }
    }
}

fn run_save_worker<F>(receiver: Receiver<SaveRequest>, debounce: Duration, mut save: F)
where
    F: FnMut(&WindowState) -> Result<(), String>,
{
    while let Ok(request) = receiver.recv() {
        let (mut pending, mut flush, mut completion) = match request {
            SaveRequest::Schedule(state) => (state, false, None),
            SaveRequest::Flush(state, completion) => (state, true, Some(completion)),
        };
        while !flush {
            match receiver.recv_timeout(debounce) {
                Ok(SaveRequest::Schedule(state)) => pending = state,
                Ok(SaveRequest::Flush(state, flush_completion)) => {
                    pending = state;
                    flush = true;
                    completion = Some(flush_completion);
                }
                Err(RecvTimeoutError::Timeout) => break,
                Err(RecvTimeoutError::Disconnected) => {
                    flush = true;
                }
            }
        }
        if let Err(error) = save(&pending) {
            eprintln!("窗口状态保存失败：{error}");
        }
        if let Some(completion) = completion {
            let _ = completion.send(());
        }
    }
}

fn persist_window_state(app: &AppHandle, state: &WindowState) -> Result<(), String> {
    let persistence = app
        .try_state::<PersistenceState>()
        .ok_or_else(|| "窗口状态持久化服务未初始化".to_owned())?;
    let repository = persistence.repository().map_err(str::to_owned)?;
    repository
        .upsert_window_state(state)
        .map_err(|error| error.to_string())
}

pub(crate) fn initialize_main_window(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("主窗口不存在，无法恢复窗口状态");
        return;
    };

    let placement = match select_initial_placement(&window) {
        Ok(placement) => placement,
        Err(error) => {
            eprintln!("窗口初始布局失败，将使用安全默认尺寸：{error}");
            safe_fallback_placement()
        }
    };

    let applied_placement = resolve_applied_placement(
        placement,
        safe_fallback_placement(),
        |candidate| apply_placement(&window, candidate),
        || observe_current_placement(&window),
    );
    if let Some(applied_placement) = applied_placement {
        attach_state_tracking(&window, applied_placement);
    } else {
        eprintln!("无法可靠确定窗口实际布局，本次运行不持久化窗口状态");
    }
    if let Err(error) = window.show() {
        eprintln!("主窗口显示失败：{error}");
    }
    if let Err(error) = window.set_focus() {
        eprintln!("主窗口聚焦失败：{error}");
    }
}

fn resolve_applied_placement<A, O>(
    primary: WindowPlacement,
    fallback: WindowPlacement,
    mut apply: A,
    observe: O,
) -> Option<WindowPlacement>
where
    A: FnMut(WindowPlacement) -> Result<(), String>,
    O: FnOnce() -> Option<WindowPlacement>,
{
    match apply(primary) {
        Ok(()) => return Some(primary),
        Err(error) => eprintln!("窗口目标布局应用失败，将尝试安全默认布局：{error}"),
    }
    match apply(fallback) {
        Ok(()) => Some(fallback),
        Err(error) => {
            eprintln!("窗口安全默认布局应用失败，将查询实际窗口布局：{error}");
            observe()
        }
    }
}

fn observe_current_placement(window: &WebviewWindow) -> Option<WindowPlacement> {
    let modes = complete_window_modes(
        window.is_maximized(),
        window.is_minimized(),
        window.is_fullscreen(),
    );
    if !matches!(modes, Ok((false, false, false))) {
        return None;
    }
    normal_placement_from_observation(
        window.outer_position().ok().map(|value| (value.x, value.y)),
        window
            .outer_size()
            .ok()
            .map(|value| (value.width, value.height)),
        window.scale_factor().ok(),
        modes,
    )
}

fn normal_placement_from_observation<E>(
    position: Option<(i32, i32)>,
    physical_size: Option<(u32, u32)>,
    scale: Option<f64>,
    modes: Result<(bool, bool, bool), E>,
) -> Option<WindowPlacement> {
    let (maximized, minimized, fullscreen) = modes.ok()?;
    if maximized || minimized || fullscreen {
        return None;
    }
    let (x, y) = position?;
    let (physical_width, physical_height) = physical_size?;
    let scale = scale?;
    if !scale.is_finite() || scale <= 0.0 {
        return None;
    }
    let width = f64::from(physical_width) / scale;
    let height = f64::from(physical_height) / scale;
    if !width.is_finite() || !height.is_finite() || width <= 0.0 || height <= 0.0 {
        return None;
    }
    Some(WindowPlacement {
        x,
        y,
        width,
        height,
        maximized: false,
    })
}

fn apply_window_mode<M, U>(maximized: bool, maximize: M, unmaximize: U) -> Result<(), String>
where
    M: FnOnce() -> Result<(), String>,
    U: FnOnce() -> Result<(), String>,
{
    if maximized {
        maximize()
    } else {
        unmaximize()
    }
}

fn apply_placement(window: &WebviewWindow, placement: WindowPlacement) -> Result<(), String> {
    window
        .set_min_size(Some(LogicalSize::new(
            MIN_WIDTH.min(placement.width),
            MIN_HEIGHT.min(placement.height),
        )))
        .map_err(|error| error.to_string())?;
    window
        .set_size(LogicalSize::new(placement.width, placement.height))
        .map_err(|error| error.to_string())?;
    window
        .set_position(PhysicalPosition::new(placement.x, placement.y))
        .map_err(|error| error.to_string())?;
    apply_window_mode(
        placement.maximized,
        || window.maximize().map_err(|error| error.to_string()),
        || window.unmaximize().map_err(|error| error.to_string()),
    )
}

fn attach_state_tracking(window: &WebviewWindow, placement: WindowPlacement) {
    let tracked = Arc::new(Mutex::new(TrackedWindowState::new(
        placement,
        unix_millis(),
    )));
    let scheduler = SaveScheduler::spawn(window.app_handle().clone());
    let event_window = window.clone();
    window.on_window_event(move |event| {
        let flush = matches!(
            event,
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
        );
        let capture = matches!(
            event,
            WindowEvent::Moved(_)
                | WindowEvent::Resized(_)
                | WindowEvent::ScaleFactorChanged { .. }
        );
        if capture {
            let (maximized, minimized, fullscreen) = match complete_window_modes(
                event_window.is_maximized(),
                event_window.is_minimized(),
                event_window.is_fullscreen(),
            ) {
                Ok(modes) => modes,
                Err(error) => {
                    eprintln!("窗口模式查询失败，跳过本次状态保存：{error}");
                    return;
                }
            };
            let position = event_window
                .outer_position()
                .ok()
                .map(|value| (value.x, value.y));
            let logical_size = event_window.outer_size().ok().and_then(|size| {
                event_window.scale_factor().ok().map(|scale| {
                    let logical = size.to_logical::<f64>(scale);
                    (logical.width, logical.height)
                })
            });
            if let Ok(mut state) = tracked.lock() {
                state.observe(
                    position,
                    logical_size,
                    maximized,
                    minimized,
                    fullscreen,
                    unix_millis(),
                );
                scheduler.schedule(state.snapshot());
            }
        }
        if flush {
            if let Ok(state) = tracked.lock() {
                scheduler.flush(state.snapshot());
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::sqlite_repository::SqliteRepository;
    use std::{
        sync::mpsc,
        thread,
        time::{Duration, Instant},
    };

    fn work_area(width: u32, height: u32) -> WorkArea {
        WorkArea {
            x: 0,
            y: 0,
            width,
            height,
            scale_factor: 1.0,
        }
    }

    fn state(x: i64, y: i64, width: i64, height: i64) -> WindowState {
        WindowState {
            x: Some(x),
            y: Some(y),
            width,
            height,
            maximized: false,
            fullscreen: false,
            updated_at: 1,
        }
    }

    #[test]
    fn adaptive_ultrawide_uses_height_limited_sixteen_by_ten_window() {
        assert_eq!(
            adaptive_placement(&work_area(3440, 1440)),
            WindowPlacement {
                x: 683,
                y: 72,
                width: 2074.0,
                height: 1296.0,
                maximized: false,
            },
        );
    }

    #[test]
    fn adaptive_initial_placement_covers_common_aspect_ratios() {
        let cases = [
            ((1920, 1080), (182, 54, 1555.0, 972.0)),
            ((1920, 1200), (96, 60, 1728.0, 1080.0)),
            ((2560, 1080), (502, 54, 1555.0, 972.0)),
            ((3840, 1080), (1142, 54, 1555.0, 972.0)),
        ];

        for ((work_width, work_height), expected) in cases {
            let placement = adaptive_placement(&work_area(work_width, work_height));
            assert_eq!(
                (placement.x, placement.y, placement.width, placement.height),
                expected
            );
        }
    }

    #[test]
    fn adaptive_small_work_area_stays_visible_even_below_preferred_minimum() {
        assert_eq!(
            adaptive_placement(&work_area(800, 500)),
            WindowPlacement {
                x: 0,
                y: 0,
                width: 800.0,
                height: 500.0,
                maximized: false,
            },
        );
    }

    #[test]
    fn adaptive_high_dpi_returns_logical_size_and_physical_position() {
        let area = WorkArea {
            x: 100,
            y: 50,
            width: 2560,
            height: 1516,
            scale_factor: 1.75,
        };
        let placement = adaptive_placement(&area);
        assert_eq!((placement.x, placement.y), (288, 126));
        assert_eq!((placement.width, placement.height), (1247.0, 779.0));
    }

    #[test]
    fn safe_fallback_uses_configured_default_geometry() {
        assert_eq!(
            safe_fallback_placement(),
            WindowPlacement {
                x: 0,
                y: 0,
                width: 1280.0,
                height: 800.0,
                maximized: false,
            }
        );
    }

    #[test]
    fn complete_window_modes_requires_every_query_to_succeed() {
        assert_eq!(
            complete_window_modes(
                Ok::<bool, &str>(true),
                Ok::<bool, &str>(false),
                Ok::<bool, &str>(false),
            ),
            Ok((true, false, false))
        );
        assert!(complete_window_modes(Err("maximized"), Ok(false), Ok(false)).is_err());
        assert!(complete_window_modes(Ok(false), Err("minimized"), Ok(false)).is_err());
        assert!(complete_window_modes(Ok(false), Ok(false), Err("fullscreen")).is_err());
    }

    #[test]
    fn restore_keeps_user_selected_ultrawide_ratio() {
        let restored =
            restore_placement(&state(100, 80, 2200, 900), &[work_area(3440, 1440)], false).unwrap();
        assert_eq!((restored.width, restored.height), (2200.0, 900.0));
    }

    #[test]
    fn restore_clamps_partially_offscreen_window_into_work_area() {
        let restored = restore_placement(
            &state(-200, -100, 1200, 800),
            &[work_area(1920, 1080)],
            false,
        )
        .unwrap();
        assert_eq!((restored.x, restored.y), (0, 0));
        assert_eq!((restored.width, restored.height), (1200.0, 800.0));
    }

    #[test]
    fn restore_clamps_oversized_saved_dimensions_to_target_logical_work_area() {
        let high_dpi_area = WorkArea {
            x: 0,
            y: 0,
            width: 2560,
            height: 1440,
            scale_factor: 2.0,
        };

        let restored =
            restore_placement(&state(100, 100, 5000, 4000), &[high_dpi_area], false).unwrap();

        assert_eq!((restored.x, restored.y), (0, 0));
        assert_eq!((restored.width, restored.height), (1280.0, 720.0));
    }

    #[test]
    fn restore_selects_eligible_monitor_over_larger_ineligible_intersection() {
        let work_areas = [
            WorkArea {
                x: 0,
                y: 0,
                width: 1000,
                height: 20,
                scale_factor: 1.0,
            },
            WorkArea {
                x: 936,
                y: 20,
                width: 64,
                height: 40,
                scale_factor: 1.0,
            },
        ];

        let restored = restore_placement(&state(0, 0, 1000, 100), &work_areas, false).unwrap();

        assert_eq!((restored.x, restored.y), (936, 20));
        assert_eq!((restored.width, restored.height), (64.0, 40.0));
    }

    #[test]
    fn restore_prefers_saved_top_left_owner_across_mixed_dpi_monitors() {
        let work_areas = [
            WorkArea {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                scale_factor: 1.0,
            },
            WorkArea {
                x: 1920,
                y: 0,
                width: 3840,
                height: 2160,
                scale_factor: 2.0,
            },
        ];

        let restored = restore_placement(&state(1700, 100, 800, 700), &work_areas, false).unwrap();

        assert_eq!((restored.x, restored.y), (960, 100));
        assert_eq!((restored.width, restored.height), (960.0, 700.0));
    }

    #[test]
    fn restore_fallback_ranks_mixed_dpi_candidates_with_one_source_scaled_rect() {
        let work_areas = [
            WorkArea {
                x: 0,
                y: 0,
                width: 50,
                height: 30,
                scale_factor: 1.0,
            },
            WorkArea {
                x: 50,
                y: 0,
                width: 600,
                height: 600,
                scale_factor: 1.0,
            },
            WorkArea {
                x: 700,
                y: 30,
                width: 1000,
                height: 1000,
                scale_factor: 2.0,
            },
        ];

        let restored = restore_placement(&state(0, 0, 1000, 800), &work_areas, false).unwrap();

        assert_eq!((restored.x, restored.y), (50, 0));
        assert_eq!((restored.width, restored.height), (600.0, 600.0));
    }

    #[test]
    fn restore_rejects_missing_position_invalid_size_and_disconnected_monitor() {
        let mut missing = state(0, 0, 1200, 800);
        missing.x = None;
        assert!(restore_placement(&missing, &[work_area(1920, 1080)], false).is_none());
        assert!(restore_placement(&state(0, 0, 0, 800), &[work_area(1920, 1080)], false).is_none());
        assert!(restore_placement(
            &state(3000, 100, 1200, 800),
            &[work_area(1920, 1080)],
            false,
        )
        .is_none());
    }

    #[test]
    fn centered_restore_keeps_size_and_maximized_state_but_replaces_position() {
        let mut saved = state(100, 80, 1200, 800);
        saved.maximized = true;

        let restored = restore_placement(&saved, &[work_area(1920, 1080)], true).unwrap();

        assert_eq!(
            restored,
            WindowPlacement {
                x: 360,
                y: 140,
                width: 1200.0,
                height: 800.0,
                maximized: true,
            },
        );
    }

    #[test]
    fn centered_restore_uses_saved_secondary_monitor_work_area() {
        let primary = WorkArea {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            scale_factor: 1.0,
        };
        let secondary = WorkArea {
            x: 1920,
            y: 0,
            width: 2560,
            height: 1440,
            scale_factor: 1.0,
        };

        let restored =
            restore_placement(&state(2100, 100, 1200, 800), &[primary, secondary], true).unwrap();

        assert_eq!((restored.x, restored.y), (2600, 320));
        assert_eq!((restored.width, restored.height), (1200.0, 800.0));
    }

    #[test]
    fn disabled_centering_preserves_existing_clamped_position() {
        let restored =
            restore_placement(&state(100, 80, 1200, 800), &[work_area(1920, 1080)], false).unwrap();

        assert_eq!((restored.x, restored.y), (100, 80));
    }

    #[test]
    fn startup_centering_setting_defaults_off_and_accepts_only_json_boolean() {
        assert!(!parse_center_on_startup(None));
        assert!(parse_center_on_startup(Some("true")));
        assert!(!parse_center_on_startup(Some("false")));
        assert!(!parse_center_on_startup(Some("\"true\"")));
        assert!(!parse_center_on_startup(Some("broken")));
    }

    #[test]
    fn startup_centering_setting_reads_shared_app_settings_key() {
        let repository = SqliteRepository::in_memory().unwrap();
        assert!(!read_center_on_startup(&PersistenceState::available(
            repository
        )));

        let repository = SqliteRepository::in_memory().unwrap();
        repository
            .set_setting("window.centerOnStartup", "true")
            .unwrap();
        let persistence = PersistenceState::available(repository);

        assert!(read_center_on_startup(&persistence));
        assert!(!read_center_on_startup(&PersistenceState::unavailable(
            "db"
        )));
    }

    #[test]
    fn maximized_observation_preserves_last_normal_bounds() {
        let placement = WindowPlacement {
            x: 100,
            y: 80,
            width: 1200.0,
            height: 800.0,
            maximized: false,
        };
        let mut tracked = TrackedWindowState::new(placement, 1);
        tracked.observe(
            Some((100, 80)),
            Some((1200.0, 800.0)),
            true,
            false,
            false,
            2,
        );
        assert_eq!(
            tracked.snapshot(),
            WindowState {
                x: Some(100),
                y: Some(80),
                width: 1200,
                height: 800,
                maximized: true,
                fullscreen: false,
                updated_at: 2,
            },
        );
    }

    #[test]
    fn restored_normal_observation_replaces_bounds() {
        let placement = WindowPlacement {
            x: 100,
            y: 80,
            width: 1200.0,
            height: 800.0,
            maximized: true,
        };
        let mut tracked = TrackedWindowState::new(placement, 1);
        tracked.observe(
            Some((220, 140)),
            Some((1400.0, 900.0)),
            false,
            false,
            false,
            3,
        );
        assert_eq!(
            (tracked.snapshot().x, tracked.snapshot().y),
            (Some(220), Some(140))
        );
        assert_eq!(
            (tracked.snapshot().width, tracked.snapshot().height),
            (1400, 900)
        );
        assert!(!tracked.snapshot().maximized);
    }

    #[test]
    fn minimized_and_fullscreen_observations_never_replace_normal_bounds() {
        let placement = WindowPlacement {
            x: 10,
            y: 20,
            width: 1000.0,
            height: 700.0,
            maximized: false,
        };
        let mut tracked = TrackedWindowState::new(placement, 1);
        tracked.observe(Some((0, 0)), Some((3000.0, 1600.0)), false, true, false, 2);
        tracked.observe(Some((0, 0)), Some((3000.0, 1600.0)), false, false, true, 3);
        assert_eq!(
            (tracked.snapshot().x, tracked.snapshot().y),
            (Some(10), Some(20))
        );
        assert_eq!(
            (tracked.snapshot().width, tracked.snapshot().height),
            (1000, 700)
        );
        assert!(!tracked.snapshot().fullscreen);
    }

    #[test]
    fn minimized_observation_preserves_last_maximized_state_and_normal_bounds() {
        let placement = WindowPlacement {
            x: 10,
            y: 20,
            width: 1000.0,
            height: 700.0,
            maximized: true,
        };
        let mut tracked = TrackedWindowState::new(placement, 1);

        tracked.observe(Some((0, 0)), Some((3000.0, 1600.0)), false, true, false, 2);

        let snapshot = tracked.snapshot();
        assert!(snapshot.maximized);
        assert_eq!((snapshot.x, snapshot.y), (Some(10), Some(20)));
        assert_eq!((snapshot.width, snapshot.height), (1000, 700));
    }

    #[test]
    fn fullscreen_observation_preserves_last_maximized_state_and_normal_bounds() {
        let placement = WindowPlacement {
            x: 10,
            y: 20,
            width: 1000.0,
            height: 700.0,
            maximized: true,
        };
        let mut tracked = TrackedWindowState::new(placement, 1);

        tracked.observe(Some((0, 0)), Some((3000.0, 1600.0)), false, false, true, 2);

        let snapshot = tracked.snapshot();
        assert!(snapshot.maximized);
        assert_eq!((snapshot.x, snapshot.y), (Some(10), Some(20)));
        assert_eq!((snapshot.width, snapshot.height), (1000, 700));
    }

    #[test]
    fn scheduler_dispatches_schedule_requests() {
        let (sender, receiver) = mpsc::channel();
        let scheduler = SaveScheduler {
            sender: Arc::new(Mutex::new(Some(sender))),
        };
        let scheduled = state(10, 20, 1000, 700);

        scheduler.schedule(scheduled.clone());

        match receiver.recv().unwrap() {
            SaveRequest::Schedule(received) => assert_eq!(received, scheduled),
            SaveRequest::Flush(_, _) => panic!("expected scheduled save"),
        }
    }

    #[test]
    fn scheduler_disables_shared_sender_after_first_send_failure() {
        let (sender, receiver) = mpsc::channel();
        drop(receiver);
        let scheduler = SaveScheduler {
            sender: Arc::new(Mutex::new(Some(sender))),
        };
        let clone = scheduler.clone();

        scheduler.schedule(state(10, 20, 1000, 700));

        assert!(scheduler.sender.lock().unwrap().is_none());
        clone.schedule(state(30, 40, 1200, 800));
        assert!(!clone.flush_with_timeout(state(50, 60, 1400, 900), Duration::from_millis(1),));
        assert!(clone.sender.lock().unwrap().is_none());
    }

    #[test]
    fn save_worker_debounces_to_latest_scheduled_state() {
        let (request_sender, request_receiver) = mpsc::channel();
        let (saved_sender, saved_receiver) = mpsc::channel();
        let worker = thread::spawn(move || {
            run_save_worker(request_receiver, Duration::from_millis(20), move |saved| {
                saved_sender.send(saved.clone()).unwrap();
                Ok(())
            });
        });
        let first = state(10, 20, 1000, 700);
        let mut latest = state(30, 40, 1200, 800);
        latest.updated_at = 2;

        request_sender.send(SaveRequest::Schedule(first)).unwrap();
        request_sender
            .send(SaveRequest::Schedule(latest.clone()))
            .unwrap();

        assert_eq!(
            saved_receiver.recv_timeout(Duration::from_secs(1)).unwrap(),
            latest
        );
        drop(request_sender);
        worker.join().unwrap();
    }

    #[test]
    fn save_worker_flushes_on_request_and_disconnect() {
        let (request_sender, request_receiver) = mpsc::channel();
        let (saved_sender, saved_receiver) = mpsc::channel();
        let worker = thread::spawn(move || {
            run_save_worker(request_receiver, Duration::from_secs(60), move |saved| {
                saved_sender.send(saved.clone()).unwrap();
                Ok(())
            });
        });
        let flushed = state(10, 20, 1000, 700);
        let mut disconnected = state(30, 40, 1200, 800);
        disconnected.updated_at = 2;
        let (completion_sender, completion_receiver) = mpsc::channel();

        request_sender
            .send(SaveRequest::Flush(flushed.clone(), completion_sender))
            .unwrap();
        assert_eq!(
            saved_receiver.recv_timeout(Duration::from_secs(1)).unwrap(),
            flushed
        );
        completion_receiver
            .recv_timeout(Duration::from_secs(1))
            .unwrap();
        request_sender
            .send(SaveRequest::Schedule(disconnected.clone()))
            .unwrap();
        drop(request_sender);
        assert_eq!(
            saved_receiver.recv_timeout(Duration::from_secs(1)).unwrap(),
            disconnected
        );
        worker.join().unwrap();
    }

    #[test]
    fn save_worker_continues_after_save_failure() {
        let (request_sender, request_receiver) = mpsc::channel();
        let (saved_sender, saved_receiver) = mpsc::channel();
        let worker = thread::spawn(move || {
            let mut attempts = 0;
            run_save_worker(request_receiver, Duration::from_secs(60), move |saved| {
                attempts += 1;
                if attempts == 1 {
                    Err("database unavailable".to_owned())
                } else {
                    saved_sender.send(saved.clone()).unwrap();
                    Ok(())
                }
            });
        });
        let first = state(10, 20, 1000, 700);
        let mut second = state(30, 40, 1200, 800);
        second.updated_at = 2;
        let (first_completion_sender, first_completion_receiver) = mpsc::channel();
        let (second_completion_sender, second_completion_receiver) = mpsc::channel();

        request_sender
            .send(SaveRequest::Flush(first, first_completion_sender))
            .unwrap();
        first_completion_receiver
            .recv_timeout(Duration::from_secs(1))
            .unwrap();
        request_sender
            .send(SaveRequest::Flush(second.clone(), second_completion_sender))
            .unwrap();

        assert_eq!(
            saved_receiver.recv_timeout(Duration::from_secs(1)).unwrap(),
            second
        );
        second_completion_receiver
            .recv_timeout(Duration::from_secs(1))
            .unwrap();
        drop(request_sender);
        worker.join().unwrap();
    }

    #[test]
    fn scheduler_flush_waits_for_worker_save_completion() {
        let (request_sender, request_receiver) = mpsc::channel();
        let (saved_sender, saved_receiver) = mpsc::channel();
        let worker = thread::spawn(move || {
            run_save_worker(request_receiver, Duration::from_secs(60), move |saved| {
                saved_sender.send(saved.clone()).unwrap();
                Ok(())
            });
        });
        let scheduler = SaveScheduler {
            sender: Arc::new(Mutex::new(Some(request_sender))),
        };
        let flushed = state(10, 20, 1000, 700);

        assert!(scheduler.flush_with_timeout(flushed.clone(), Duration::from_secs(1)));
        assert_eq!(saved_receiver.recv().unwrap(), flushed);

        drop(scheduler);
        worker.join().unwrap();
    }

    #[test]
    fn scheduler_flush_times_out_when_worker_save_is_blocked() {
        let (request_sender, request_receiver) = mpsc::channel();
        let (started_sender, started_receiver) = mpsc::channel();
        let (release_sender, release_receiver) = mpsc::channel();
        let worker = thread::spawn(move || {
            run_save_worker(request_receiver, Duration::from_secs(60), move |_| {
                started_sender.send(()).unwrap();
                release_receiver.recv().unwrap();
                Ok(())
            });
        });
        let scheduler = SaveScheduler {
            sender: Arc::new(Mutex::new(Some(request_sender))),
        };
        let started_at = Instant::now();

        assert!(!scheduler.flush_with_timeout(state(10, 20, 1000, 700), Duration::from_millis(20),));
        assert!(scheduler.sender.lock().unwrap().is_some());
        assert!(started_at.elapsed() < Duration::from_millis(500));
        started_receiver
            .recv_timeout(Duration::from_secs(1))
            .unwrap();

        release_sender.send(()).unwrap();
        drop(scheduler);
        worker.join().unwrap();
    }

    #[test]
    fn scheduler_disables_shared_sender_when_flush_ack_disconnects() {
        let (request_sender, request_receiver) = mpsc::channel();
        let worker = thread::spawn(move || match request_receiver.recv().unwrap() {
            SaveRequest::Flush(_, completion) => drop(completion),
            SaveRequest::Schedule(_) => panic!("expected flush request"),
        });
        let scheduler = SaveScheduler {
            sender: Arc::new(Mutex::new(Some(request_sender))),
        };

        assert!(!scheduler.flush_with_timeout(state(10, 20, 1000, 700), Duration::from_secs(1),));
        worker.join().unwrap();

        assert!(scheduler.sender.lock().unwrap().is_none());
    }

    #[test]
    fn placement_recovery_tracks_successfully_applied_primary() {
        let primary = WindowPlacement {
            x: 100,
            y: 80,
            width: 1200.0,
            height: 800.0,
            maximized: true,
        };
        let applied = std::cell::RefCell::new(Vec::new());
        let observed = std::cell::Cell::new(false);

        let resolved = resolve_applied_placement(
            primary,
            safe_fallback_placement(),
            |placement| {
                applied.borrow_mut().push(placement);
                Ok(())
            },
            || {
                observed.set(true);
                None
            },
        );

        assert_eq!(resolved, Some(primary));
        assert_eq!(*applied.borrow(), vec![primary]);
        assert!(!observed.get());
    }

    #[test]
    fn placement_recovery_tracks_fallback_after_primary_failure() {
        let primary = WindowPlacement {
            x: 100,
            y: 80,
            width: 1200.0,
            height: 800.0,
            maximized: true,
        };
        let fallback = safe_fallback_placement();
        let applied = std::cell::RefCell::new(Vec::new());

        let resolved = resolve_applied_placement(
            primary,
            fallback,
            |placement| {
                applied.borrow_mut().push(placement);
                if placement == fallback {
                    Ok(())
                } else {
                    Err("primary failed".to_owned())
                }
            },
            || None,
        );

        assert_eq!(resolved, Some(fallback));
        assert_eq!(*applied.borrow(), vec![primary, fallback]);
    }

    #[test]
    fn placement_recovery_tracks_observed_native_state_after_both_apply_failures() {
        let primary = WindowPlacement {
            x: 100,
            y: 80,
            width: 1200.0,
            height: 800.0,
            maximized: true,
        };
        let fallback = safe_fallback_placement();
        let observed = WindowPlacement {
            x: 20,
            y: 30,
            width: 900.0,
            height: 650.0,
            maximized: false,
        };

        let resolved = resolve_applied_placement(
            primary,
            fallback,
            |_| Err("apply failed".to_owned()),
            || Some(observed),
        );

        assert_eq!(resolved, Some(observed));
    }

    #[test]
    fn placement_recovery_returns_none_when_apply_and_observation_all_fail() {
        let resolved = resolve_applied_placement(
            safe_fallback_placement(),
            safe_fallback_placement(),
            |_| Err("apply failed".to_owned()),
            || None,
        );

        assert_eq!(resolved, None);
    }

    #[test]
    fn placement_recovery_unmaximizes_fallback_after_failed_maximize_side_effect() {
        let primary = WindowPlacement {
            x: 100,
            y: 80,
            width: 1200.0,
            height: 800.0,
            maximized: true,
        };
        let fallback = safe_fallback_placement();
        let native_maximized = std::cell::Cell::new(false);

        let resolved = resolve_applied_placement(
            primary,
            fallback,
            |placement| {
                apply_window_mode(
                    placement.maximized,
                    || {
                        native_maximized.set(true);
                        Err("maximize failed after side effect".to_owned())
                    },
                    || {
                        native_maximized.set(false);
                        Ok(())
                    },
                )
            },
            || None,
        );

        assert_eq!(resolved, Some(fallback));
        assert!(!native_maximized.get());
    }

    #[test]
    fn normal_observation_rejects_special_modes_and_mode_query_failure() {
        let position = Some((20, 30));
        let size = Some((1800, 1300));
        let scale = Some(2.0);

        for modes in [
            (true, false, false),
            (false, true, false),
            (false, false, true),
        ] {
            assert_eq!(
                normal_placement_from_observation(position, size, scale, Ok::<_, &str>(modes),),
                None
            );
        }
        assert_eq!(
            normal_placement_from_observation(position, size, scale, Err("mode query failed")),
            None
        );
        assert_eq!(
            normal_placement_from_observation(
                position,
                size,
                scale,
                Ok::<_, &str>((false, false, false)),
            ),
            Some(WindowPlacement {
                x: 20,
                y: 30,
                width: 900.0,
                height: 650.0,
                maximized: false,
            })
        );
    }
}
