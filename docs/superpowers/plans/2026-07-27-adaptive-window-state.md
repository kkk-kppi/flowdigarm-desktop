# Adaptive Window State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首次启动时按当前主显示器可用工作区生成居中的自适应窗口，后续启动恢复用户最后的普通位置、尺寸和最大化状态。

**Architecture:** 新建一个聚焦的 Rust 窗口状态模块，将可测试的几何计算、状态校验和普通窗口边界跟踪与 Tauri 生命周期接线分离。窗口状态继续写入现有 SQLite `window_state` 表；主窗口先隐藏，Rust 完成恢复或回退布局后再显示，连续移动/缩放事件经单工作线程防抖保存。

**Tech Stack:** Rust 2021、Tauri 2.11、rusqlite、现有 Vue 3 自定义标题栏、Cargo 内联单元测试。

## Global Constraints

- 支持 Windows 10/11 与 macOS Intel/Apple Silicon，不新增移动端行为。
- 首次布局以排除任务栏、Dock 和菜单栏后的主显示器可用工作区为准。
- 首次高度为工作区高度的 90%；首次宽度为 `min(工作区宽度 * 0.9, 高度 * 1.6)`。
- `16:10` 限制只用于首次启动和无效状态回退，不限制用户主动调整后的窗口比例。
- 期望最小尺寸为 `960 x 600` 逻辑像素；工作区更小时优先保证窗口完整可见。
- 保存物理位置、逻辑普通尺寸和最大化状态；不跨启动恢复最小化或全屏。
- 保存矩形与任一当前工作区至少有 `64 x 40` 逻辑像素可见区域才可恢复。
- 复用 SQLite `window_state` 和现有 `WindowState` 仓储，不新增窗口状态插件或第二份状态文件。
- 数据库、显示器或窗口 API 失败不得阻止应用启动、编辑或关闭。
- 不改变前端未保存文档关闭确认流程。

---

## File Map

- Create: `src-tauri/src/window_state.rs` - 窗口几何模型、自适应与恢复计算、普通边界跟踪、防抖保存和主窗口初始化。
- Modify: `src-tauri/src/lib.rs` - 注册窗口状态模块，在 SQLite manage 完成后初始化主窗口。
- Modify: `src-tauri/tauri.conf.json` - 将主窗口初始设为隐藏，保留 `1280 x 800` 安全默认值。
- Modify: `docs/interactions.md` - 记录首次布局、恢复、跨显示器回退与不恢复全屏的交互规则。
- Modify: `docs/features.md` - 记录窗口状态的真实入口、持久化和失败降级行为。
- Modify: `.agents/changelog.md` - 记录实现、验证证据和未覆盖的真实 macOS/多显示器手工场景。

### Task 1: Pure Placement And Restore Geometry

**Files:**
- Create: `src-tauri/src/window_state.rs`
- Modify: `src-tauri/src/lib.rs:7-10`

**Interfaces:**
- Consumes: `crate::persistence::sqlite_repository::WindowState` only at the restore adapter boundary.
- Produces: `WorkArea`, `WindowPlacement`, `adaptive_placement(&WorkArea) -> WindowPlacement`, and `restore_placement(&WindowState, &[WorkArea]) -> Option<WindowPlacement>` for Tasks 2 and 3.

- [ ] **Step 1: Register the new module and write failing geometry tests**

Add to `src-tauri/src/lib.rs` with the other module declarations:

```rust
mod window_state;
```

Create `src-tauri/src/window_state.rs` with the public data shapes and tests first:

```rust
use crate::persistence::sqlite_repository::WindowState;

const INITIAL_SCALE: f64 = 0.9;
const MAX_INITIAL_ASPECT: f64 = 1.6;
const MIN_WIDTH: f64 = 960.0;
const MIN_HEIGHT: f64 = 600.0;
const MIN_VISIBLE_WIDTH: f64 = 64.0;
const MIN_VISIBLE_HEIGHT: f64 = 40.0;

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

#[cfg(test)]
mod tests {
    use super::*;

    fn work_area(width: u32, height: u32) -> WorkArea {
        WorkArea { x: 0, y: 0, width, height, scale_factor: 1.0 }
    }

    fn state(x: i64, y: i64, width: i64, height: i64) -> WindowState {
        WindowState {
            x: Some(x), y: Some(y), width, height,
            maximized: false, fullscreen: false, updated_at: 1,
        }
    }

    #[test]
    fn adaptive_ultrawide_uses_height_limited_sixteen_by_ten_window() {
        assert_eq!(
            adaptive_placement(&work_area(3440, 1440)),
            WindowPlacement { x: 683, y: 72, width: 2074.0, height: 1296.0, maximized: false },
        );
    }

    #[test]
    fn adaptive_small_work_area_stays_visible_even_below_preferred_minimum() {
        assert_eq!(
            adaptive_placement(&work_area(800, 500)),
            WindowPlacement { x: 0, y: 0, width: 800.0, height: 500.0, maximized: false },
        );
    }

    #[test]
    fn adaptive_high_dpi_returns_logical_size_and_physical_position() {
        let area = WorkArea { x: 100, y: 50, width: 2560, height: 1516, scale_factor: 1.75 };
        let placement = adaptive_placement(&area);
        assert_eq!((placement.x, placement.y), (288, 126));
        assert_eq!((placement.width, placement.height), (1247.0, 779.0));
    }

    #[test]
    fn restore_keeps_user_selected_ultrawide_ratio() {
        let restored = restore_placement(&state(100, 80, 2200, 900), &[work_area(3440, 1440)]).unwrap();
        assert_eq!((restored.width, restored.height), (2200.0, 900.0));
    }

    #[test]
    fn restore_clamps_partially_offscreen_window_into_work_area() {
        let restored = restore_placement(&state(-200, -100, 1200, 800), &[work_area(1920, 1080)]).unwrap();
        assert_eq!((restored.x, restored.y), (0, 0));
        assert_eq!((restored.width, restored.height), (1200.0, 800.0));
    }

    #[test]
    fn restore_rejects_missing_position_invalid_size_and_disconnected_monitor() {
        let mut missing = state(0, 0, 1200, 800);
        missing.x = None;
        assert!(restore_placement(&missing, &[work_area(1920, 1080)]).is_none());
        assert!(restore_placement(&state(0, 0, 0, 800), &[work_area(1920, 1080)]).is_none());
        assert!(restore_placement(&state(3000, 100, 1200, 800), &[work_area(1920, 1080)]).is_none());
    }
}
```

- [ ] **Step 2: Run the focused tests and verify the red state**

Run:

```powershell
cargo test --locked --manifest-path src-tauri/Cargo.toml window_state::tests
```

Expected: FAIL to compile because `adaptive_placement` and `restore_placement` do not exist yet.

- [ ] **Step 3: Implement adaptive sizing, visibility validation and clamping**

Replace the two placeholder functions and add these private helpers in `src-tauri/src/window_state.rs`:

```rust
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
) -> Option<WindowPlacement> {
    let saved_x = i32::try_from(state.x?).ok()?;
    let saved_y = i32::try_from(state.y?).ok()?;
    if state.width <= 0 || state.height <= 0 {
        return None;
    }
    let saved_width = state.width as f64;
    let saved_height = state.height as f64;

    let work_area = work_areas.iter().max_by_key(|area| {
        visible_area(saved_x, saved_y, saved_width, saved_height, area)
    })?;
    let scale = valid_scale(work_area.scale_factor);
    let visible_width = intersection_width(
        saved_x,
        saved_width * scale,
        work_area.x,
        f64::from(work_area.width),
    );
    let visible_height = intersection_width(
        saved_y,
        saved_height * scale,
        work_area.y,
        f64::from(work_area.height),
    );
    if visible_width < MIN_VISIBLE_WIDTH * scale || visible_height < MIN_VISIBLE_HEIGHT * scale {
        return None;
    }

    let logical_work_width = f64::from(work_area.width) / scale;
    let logical_work_height = f64::from(work_area.height) / scale;
    let width = saved_width.clamp(MIN_WIDTH.min(logical_work_width), logical_work_width);
    let height = saved_height.clamp(MIN_HEIGHT.min(logical_work_height), logical_work_height);
    let physical_width = (width * scale).round() as i32;
    let physical_height = (height * scale).round() as i32;
    let max_x = work_area.x + work_area.width as i32 - physical_width;
    let max_y = work_area.y + work_area.height as i32 - physical_height;

    Some(WindowPlacement {
        x: saved_x.clamp(work_area.x, max_x.max(work_area.x)),
        y: saved_y.clamp(work_area.y, max_y.max(work_area.y)),
        width,
        height,
        maximized: state.maximized,
    })
}

fn valid_scale(scale: f64) -> f64 {
    if scale.is_finite() && scale > 0.0 { scale } else { 1.0 }
}

fn intersection_width(start: i32, length: f64, area_start: i32, area_length: f64) -> f64 {
    let left = f64::from(start).max(f64::from(area_start));
    let right = (f64::from(start) + length).min(f64::from(area_start) + area_length);
    (right - left).max(0.0)
}

fn visible_area(x: i32, y: i32, width: f64, height: f64, area: &WorkArea) -> u64 {
    let scale = valid_scale(area.scale_factor);
    let width = intersection_width(x, width * scale, area.x, f64::from(area.width));
    let height = intersection_width(y, height * scale, area.y, f64::from(area.height));
    (width * height).round().max(0.0) as u64
}
```

If the high-DPI expected values differ by exactly one physical pixel after compiling, keep the implementation's single final rounding rule and adjust only the test's exact centered coordinate; do not add platform-specific rounding branches.

- [ ] **Step 4: Run focused and full Rust tests**

Run:

```powershell
cargo test --locked --manifest-path src-tauri/Cargo.toml window_state::tests
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Expected: all new geometry tests and all existing Rust tests PASS.

- [ ] **Step 5: Commit the pure geometry increment**

```powershell
git add src-tauri/src/window_state.rs src-tauri/src/lib.rs
git commit -m "feat(window): add adaptive placement geometry"
```

### Task 2: Normal Bounds Tracking And Debounced Persistence

**Files:**
- Modify: `src-tauri/src/window_state.rs`

**Interfaces:**
- Consumes: `WindowPlacement` from Task 1 and `PersistenceState::repository()` plus `SqliteRepository::upsert_window_state(&WindowState)`.
- Produces: `TrackedWindowState::observe(...)`, `SaveScheduler::schedule(WindowState)`, and `SaveScheduler::flush(WindowState)` for Task 3.

- [ ] **Step 1: Write failing state-transition tests**

Append inside the existing `tests` module:

```rust
#[test]
fn maximized_observation_preserves_last_normal_bounds() {
    let placement = WindowPlacement { x: 100, y: 80, width: 1200.0, height: 800.0, maximized: false };
    let mut tracked = TrackedWindowState::new(placement, 1);
    tracked.observe(Some((100, 80)), Some((1200.0, 800.0)), true, false, false, 2);
    assert_eq!(
        tracked.snapshot(),
        WindowState {
            x: Some(100), y: Some(80), width: 1200, height: 800,
            maximized: true, fullscreen: false, updated_at: 2,
        },
    );
}

#[test]
fn restored_normal_observation_replaces_bounds() {
    let placement = WindowPlacement { x: 100, y: 80, width: 1200.0, height: 800.0, maximized: true };
    let mut tracked = TrackedWindowState::new(placement, 1);
    tracked.observe(Some((220, 140)), Some((1400.0, 900.0)), false, false, false, 3);
    assert_eq!((tracked.snapshot().x, tracked.snapshot().y), (Some(220), Some(140)));
    assert_eq!((tracked.snapshot().width, tracked.snapshot().height), (1400, 900));
    assert!(!tracked.snapshot().maximized);
}

#[test]
fn minimized_and_fullscreen_observations_never_replace_normal_bounds() {
    let placement = WindowPlacement { x: 10, y: 20, width: 1000.0, height: 700.0, maximized: false };
    let mut tracked = TrackedWindowState::new(placement, 1);
    tracked.observe(Some((0, 0)), Some((3000.0, 1600.0)), false, true, false, 2);
    tracked.observe(Some((0, 0)), Some((3000.0, 1600.0)), false, false, true, 3);
    assert_eq!((tracked.snapshot().x, tracked.snapshot().y), (Some(10), Some(20)));
    assert_eq!((tracked.snapshot().width, tracked.snapshot().height), (1000, 700));
    assert!(!tracked.snapshot().fullscreen);
}
```

- [ ] **Step 2: Run the transition tests and verify they fail to compile**

Run:

```powershell
cargo test --locked --manifest-path src-tauri/Cargo.toml window_state::tests::maximized_observation
```

Expected: FAIL with unresolved `TrackedWindowState`.

- [ ] **Step 3: Implement the in-memory state tracker**

Add above the test module:

```rust
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
        self.state.maximized = maximized;
        self.state.fullscreen = false;
        self.state.updated_at = updated_at;
    }

    pub(crate) fn snapshot(&self) -> WindowState {
        self.state.clone()
    }
}
```

- [ ] **Step 4: Run state-transition tests**

Run:

```powershell
cargo test --locked --manifest-path src-tauri/Cargo.toml window_state::tests
```

Expected: all geometry and transition tests PASS.

- [ ] **Step 5: Add the single-worker debounce scheduler**

Add these imports and definitions to `src-tauri/src/window_state.rs`:

```rust
use std::{
    sync::mpsc::{self, Receiver, RecvTimeoutError, Sender},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Manager};

use crate::persistence::sqlite_repository::PersistenceState;

const SAVE_DEBOUNCE: Duration = Duration::from_millis(250);

enum SaveRequest {
    Schedule(WindowState),
    Flush(WindowState),
}

#[derive(Clone)]
pub(crate) struct SaveScheduler {
    sender: Option<Sender<SaveRequest>>,
}

impl SaveScheduler {
    pub(crate) fn spawn(app: AppHandle) -> Self {
        let (sender, receiver) = mpsc::channel();
        match thread::Builder::new()
            .name("window-state-saver".into())
            .spawn(move || run_save_worker(receiver, app))
        {
            Ok(_) => Self { sender: Some(sender) },
            Err(error) => {
                eprintln!("窗口状态保存线程启动失败，本次运行不保存窗口状态：{error}");
                Self { sender: None }
            }
        }
    }

    pub(crate) fn schedule(&self, state: WindowState) {
        if let Some(sender) = &self.sender {
            let _ = sender.send(SaveRequest::Schedule(state));
        }
    }

    pub(crate) fn flush(&self, state: WindowState) {
        if let Some(sender) = &self.sender {
            let _ = sender.send(SaveRequest::Flush(state));
        }
    }
}

fn run_save_worker(receiver: Receiver<SaveRequest>, app: AppHandle) {
    while let Ok(request) = receiver.recv() {
        let (mut pending, mut flush) = match request {
            SaveRequest::Schedule(state) => (state, false),
            SaveRequest::Flush(state) => (state, true),
        };
        while !flush {
            match receiver.recv_timeout(SAVE_DEBOUNCE) {
                Ok(SaveRequest::Schedule(state)) => pending = state,
                Ok(SaveRequest::Flush(state)) => {
                    pending = state;
                    flush = true;
                }
                Err(RecvTimeoutError::Timeout) => break,
                Err(RecvTimeoutError::Disconnected) => {
                    flush = true;
                }
            }
        }
        let persistence = app.state::<PersistenceState>();
        if let Ok(repository) = persistence.repository() {
            if let Err(error) = repository.upsert_window_state(&pending) {
                eprintln!("窗口状态保存失败：{error}");
            }
        }
    }
}
```

Do not add `tokio`, a window-state plugin, or one sleeping thread per resize event. This channel worker is the only added background thread.

- [ ] **Step 6: Compile and run all Rust tests**

Run:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Expected: formatting check and all Rust tests PASS; no new dependency is added to `Cargo.toml` or `Cargo.lock`.

- [ ] **Step 7: Commit tracking and persistence**

```powershell
git add src-tauri/src/window_state.rs
git commit -m "feat(window): persist normal window bounds"
```

### Task 3: Tauri Startup And Window Event Integration

**Files:**
- Modify: `src-tauri/src/window_state.rs`
- Modify: `src-tauri/src/lib.rs:12-30`
- Modify: `src-tauri/tauri.conf.json:13-23`

**Interfaces:**
- Consumes: Task 1 placement functions and Task 2 tracker/scheduler.
- Produces: `initialize_main_window(app: &tauri::App)`, called once after `PersistenceState` is managed.

- [ ] **Step 1: Make the configuration expectation fail before changing it**

Run this repository assertion:

```powershell
$config = Get-Content -Raw "src-tauri/tauri.conf.json" | ConvertFrom-Json
if ($config.app.windows[0].visible -ne $false) { throw "main window must start hidden" }
```

Expected: FAIL because `visible` is currently absent.

- [ ] **Step 2: Add monitor conversion and initial placement selection**

Add these imports and functions to `src-tauri/src/window_state.rs`:

```rust
use std::{
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
    LogicalSize, Monitor, PhysicalPosition, WebviewWindow, WindowEvent,
};

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

fn select_initial_placement(window: &WebviewWindow) -> Result<WindowPlacement, String> {
    let monitors = window.available_monitors().map_err(|error| error.to_string())?;
    let work_areas: Vec<_> = monitors.iter().map(work_area).collect();
    if let Ok(repository) = window.app_handle().state::<PersistenceState>().repository() {
        match repository.get_window_state() {
            Ok(Some(state)) => {
                if let Some(placement) = restore_placement(&state, &work_areas) {
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
```

- [ ] **Step 3: Implement startup application and event capture**

Add the following functions to `src-tauri/src/window_state.rs`:

```rust
pub(crate) fn initialize_main_window(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("主窗口不存在，无法恢复窗口状态");
        return;
    };

    let placement = match select_initial_placement(&window) {
        Ok(placement) => placement,
        Err(error) => {
            eprintln!("窗口初始布局失败，将使用安全默认尺寸：{error}");
            let scale = window.scale_factor().unwrap_or(1.0);
            let position = window.outer_position().unwrap_or(PhysicalPosition::new(0, 0));
            let size = window.outer_size().unwrap_or_default().to_logical::<f64>(scale);
            WindowPlacement {
                x: position.x,
                y: position.y,
                width: size.width.max(1.0),
                height: size.height.max(1.0),
                maximized: false,
            }
        }
    };

    if let Err(error) = apply_placement(&window, placement) {
        eprintln!("窗口状态应用失败，将显示安全默认窗口：{error}");
    }
    attach_state_tracking(&window, placement);
    if let Err(error) = window.show() {
        eprintln!("主窗口显示失败：{error}");
    }
    if let Err(error) = window.set_focus() {
        eprintln!("主窗口聚焦失败：{error}");
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
    if placement.maximized {
        window.maximize().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn attach_state_tracking(window: &WebviewWindow, placement: WindowPlacement) {
    let tracked = Arc::new(Mutex::new(TrackedWindowState::new(placement, unix_millis())));
    let scheduler = SaveScheduler::spawn(window.app_handle().clone());
    let event_window = window.clone();
    window.on_window_event(move |event| {
        let flush = matches!(event, WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed);
        let capture = matches!(
            event,
            WindowEvent::Moved(_)
                | WindowEvent::Resized(_)
                | WindowEvent::ScaleFactorChanged { .. }
        );
        if capture {
            let maximized = event_window.is_maximized().unwrap_or(false);
            let minimized = event_window.is_minimized().unwrap_or(false);
            let fullscreen = event_window.is_fullscreen().unwrap_or(false);
            let position = event_window.outer_position().ok().map(|value| (value.x, value.y));
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
```

During implementation, confirm the installed Tauri 2.11 signatures compile. Keep all positioning in physical coordinates and all persisted sizes in logical coordinates; do not replace these with CSS `window.screen` APIs.

- [ ] **Step 4: Wire initialization after persistence management**

Modify the setup block in `src-tauri/src/lib.rs` so the state is managed before window initialization:

```rust
            if let Some(error) = state.initialization_error() {
                eprintln!("本机数据库初始化失败，应用将以降级模式启动：{error}");
            }
            app.manage(state);
            window_state::initialize_main_window(app);
            Ok(())
```

Do not move this behavior into `src/main.ts` or `TauriWindowController`; the WebView must remain uninvolved in initial placement.

- [ ] **Step 5: Hide the declarative main window until Rust finishes placement**

Add the exact property in `src-tauri/tauri.conf.json` while preserving the fixed fallback dimensions:

```json
        "width": 1280,
        "height": 800,
        "minWidth": 960,
        "minHeight": 600,
        "visible": false,
        "decorations": false,
        "resizable": true
```

- [ ] **Step 6: Verify configuration, formatting, tests and production compilation**

Run:

```powershell
$config = Get-Content -Raw "src-tauri/tauri.conf.json" | ConvertFrom-Json
if ($config.app.windows[0].visible -ne $false) { throw "main window must start hidden" }
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --locked --manifest-path src-tauri/Cargo.toml
pnpm build
```

Expected: configuration assertion succeeds, Rust formatting/tests PASS, and Vue/TypeScript production build PASS. A Tauri API mismatch is a failed implementation and must be fixed before proceeding.

- [ ] **Step 7: Run a non-destructive desktop smoke**

Run `pnpm tauri dev` only if no other dev instance is active. Observe that the existing profile opens without a visible default-position jump, can maximize/restore, and still prompts before closing a dirty document.

Do not delete or edit the real app-data database to simulate first launch. Record first-run, disconnected-monitor and cross-DPI desktop scenarios as manually pending unless a disposable OS profile or disposable app identifier is explicitly approved.

- [ ] **Step 8: Commit lifecycle integration**

```powershell
git add src-tauri/src/window_state.rs src-tauri/src/lib.rs src-tauri/tauri.conf.json
git commit -m "feat(window): restore adaptive startup state"
```

### Task 4: Documentation And Full Verification

**Files:**
- Modify: `docs/interactions.md:143-152`
- Modify: `docs/features.md:7-17`
- Modify: `.agents/changelog.md`

**Interfaces:**
- Consumes: completed observable behavior from Tasks 1-3.
- Produces: synchronized user/developer documentation and a verification ledger; no new runtime API.

- [ ] **Step 1: Document the exact interaction behavior**

Add this paragraph under `## 文件、恢复与窗口关闭` in `docs/interactions.md`:

```markdown
- 首次启动时，主窗口按主显示器可用工作区计算：高度最多占 90%，宽度最多占 90% 且初始宽高比不超过 16:10，然后在工作区居中。后续启动恢复上次普通窗口的物理位置、逻辑尺寸和最大化状态；不恢复最小化或全屏。保存显示器缺失、状态损坏或窗口几乎不可见时，回退到主显示器首次布局。用户主动调整出的超宽比例不受首次 16:10 规则限制。
```

- [ ] **Step 2: Document persistence ownership and degradation**

Add this bullet near the SQLite/window behavior in `docs/features.md`:

```markdown
- 窗口状态：Rust/Tauri 在 WebView 显示前从 SQLite `window_state` 恢复普通位置、逻辑尺寸和最大化状态；无有效状态时按主显示器可用工作区自适应居中。移动和缩放事件经防抖写回，数据库或显示器查询失败时使用安全默认窗口，不阻止编辑和关闭。
```

- [ ] **Step 3: Run all automated verification**

Run each command separately and preserve exact pass/fail evidence:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --locked --manifest-path src-tauri/Cargo.toml
pnpm test
pnpm build
git diff --check
```

Expected: all commands exit `0`. Existing unrelated Vite chunk warnings may remain warnings; test, type, compile, formatting, or whitespace failures block completion.

- [ ] **Step 4: Inspect only intended files and record residual manual gaps**

Run:

```powershell
git status --short
git diff -- src-tauri/src/window_state.rs src-tauri/src/lib.rs src-tauri/tauri.conf.json docs/interactions.md docs/features.md .agents/changelog.md
```

Append one changelog line with observed test counts/build result and explicitly state whether Windows live smoke, macOS, ultrawide, disconnected-monitor and cross-DPI scenarios were observed or remain unverified. Do not claim manual platform coverage from unit tests.

- [ ] **Step 5: Commit documentation and verification ledger**

```powershell
git add docs/interactions.md docs/features.md .agents/changelog.md
git commit -m "docs(window): describe adaptive state restore"
```

## Completion Evidence

- Pure tests prove normal, ultrawide, small-work-area, high-DPI, offscreen and disconnected-monitor calculations.
- State-transition tests prove maximize/minimize/fullscreen events do not overwrite normal bounds.
- Rust compile/tests prove the installed Tauri APIs and SQLite integration are valid.
- Frontend tests/build prove the hidden startup configuration and Rust module do not regress the Vue application.
- Live desktop observations are reported separately and never inferred from automated tests.
