# Center Window On Startup Preference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加默认关闭的“应用启动居中”首选项，让应用下次启动时保留上次窗口大小和最大化状态，并在上次使用的显示器工作区内居中。

**Architecture:** 现有 SQLite `app_settings` 是开关唯一事实源。前端继续通过 `SettingsController` 编辑通用首选项，Rust 在主窗口显示前读取同一键，并把布尔值传入现有纯窗口恢复几何；WebView 不参与启动定位。

**Tech Stack:** Vue 3、TypeScript、Pinia、Vitest、Vue Test Utils、Rust 2021、Tauri 2.11、rusqlite。

## Global Constraints

- 功能名称必须是“应用启动居中”。
- 内联说明必须是“下次打开应用时，窗口会显示在上次使用的屏幕中央。窗口大小和最大化状态保持不变。”
- 说明始终可见，并通过 `aria-describedby` 与复选框关联；关键说明不能只放在 Tooltip。
- 设置键固定为 `window.centerOnStartup`，前端字段固定为 `centerOnStartup: boolean`，默认值为 `false`。
- 点击“应用”只保存设置，不立即移动当前窗口；点击“恢复默认”将其恢复为关闭。
- 开关关闭时保持现有位置、普通逻辑尺寸和最大化状态恢复行为。
- 开关开启时保留普通逻辑尺寸和最大化状态，只在上次所在显示器工作区内重算居中位置。
- 上次显示器断开、状态无效或没有状态时，沿用主显示器首次自适应居中布局。
- 继续保存关闭前的真实物理位置；关闭开关后可恢复真实保存位置。
- 设置读取、解析或数据库失败时按 `false` 降级，且不得阻止窗口显示。
- 不修改 `window_state` 表，不增加数据库迁移、插件、依赖或额外状态文件。
- 非直观首选项应提供名称下方内联说明，优先解释做什么、何时生效、保留或改变什么；本次不重构其他设置。

---

## File Map

- Modify: `src/application/settings/settings-controller.ts` - 增加字段、默认值、设置键、校验和准确的保存失败通知。
- Modify: `src/stores/app-store.ts` - 将新字段纳入 Pinia 首选项状态。
- Modify: `src/ui/shell/AppShell.vue` - 把 store 字段传入首选项对话框。
- Modify: `tests/unit/editor/settings/settings-controller.test.ts` - 覆盖默认、读取、保存和失败提示。
- Modify: `src/ui/dialogs/PreferencesDialog.vue` - 增加“窗口”分组、复选框和内联说明。
- Modify: `tests/component/PreferencesDialog.test.ts` - 覆盖文案、无障碍、应用和恢复默认。
- Modify: `src-tauri/src/window_state.rs` - 读取共享设置键，并为现有恢复几何增加可选居中位置。
- Modify: `docs/interactions.md` - 记录启动居中开关行为和首选项说明约定。
- Modify: `docs/features.md` - 记录设置事实源与 Rust 启动读取。
- Modify: `.agents/changelog.md` - 记录实现与验证结果。

### Task 1: Frontend Preference Model And Persistence

**Files:**
- Modify: `src/application/settings/settings-controller.ts:4-60,88-99,140-155`
- Modify: `src/stores/app-store.ts:10-48`
- Modify: `src/ui/shell/AppShell.vue:181-193`
- Test: `tests/unit/editor/settings/settings-controller.test.ts`
- Test: `tests/unit/stores/app-store.test.ts:11-38`

**Interfaces:**
- Consumes: existing `SettingsRepository.all()` and `set(key, value)` generic setting APIs.
- Produces: `EditorPreferences.centerOnStartup: boolean`, default `false`, persisted as `window.centerOnStartup`; Tasks 2 and 3 rely on these exact names.

- [ ] **Step 1: Write failing settings tests**

Rename the valid-load test to `loads all twelve valid persisted settings into runtime state`, then update its input and expected object in `tests/unit/editor/settings/settings-controller.test.ts`:

```typescript
const values = {
  'theme.mode': 'dark',
  'editor.showRulers': false,
  'editor.showGrid': true,
  'editor.showGuides': false,
  'editor.showPageBreaks': true,
  'editor.snapToGrid': false,
  'editor.defaultZoom': 1.5,
  'editor.defaultPageUnit': 'cm',
  'editor.defaultConnector': 'curved',
  'editor.recentLimit': 12,
  'export.pngDpi': 300,
  'window.centerOnStartup': true,
}

expect(target.settings).toEqual({
  theme: 'dark', showRulers: false, showGrid: true, showGuides: false,
  showPageBreaks: true, snapToGrid: false, defaultZoom: 1.5, defaultPageUnit: 'cm',
  defaultConnector: 'curved', recentLimit: 12, pngDpi: 300, centerOnStartup: true,
})
```

Add an invalid-value case:

```typescript
it('defaults startup centering to off when the stored value is missing or not boolean', async () => {
  const missing = store()
  await new SettingsController(missing, repository(), environment()).load()
  expect(missing.settings.centerOnStartup).toBe(false)

  const invalid = store()
  await new SettingsController(invalid, repository({ 'window.centerOnStartup': 'yes' }), environment()).load()
  expect(invalid.settings.centerOnStartup).toBe(false)
})
```

Update the degraded-write test to require 12 writes, the exact key/value, and the corrected notice:

```typescript
const next: EditorPreferences = {
  ...DEFAULT_EDITOR_PREFERENCES,
  theme: 'dark',
  showGrid: true,
  pngDpi: 600,
  centerOnStartup: true,
}

await controller.apply(next)

expect(persisted.writes).toHaveLength(12)
expect(persisted.writes).toContainEqual(['window.centerOnStartup', true])
expect(target.notices).toEqual([
  '设置保存失败。本次更改可能已在当前运行生效，但不会在下次启动时保留。',
])
```

Update `tests/unit/stores/app-store.test.ts` before implementation so the expected new field is explicit:

```typescript
it('默认值包含关闭的应用启动居中', () => {
  expect(useAppStore().centerOnStartup).toBe(false)
})
```

Rename `一次应用十一项首选项` to `一次应用十二项首选项`, add the field to the complete input, and assert it:

```typescript
store.applyPreferences({
  theme: 'light', showRulers: false, showGrid: true, showGuides: false,
  showPageBreaks: true, snapToGrid: false, defaultZoom: 2, defaultPageUnit: 'in',
  defaultConnector: 'straight', recentLimit: 20, pngDpi: 300, centerOnStartup: true,
})
expect(store.$state).toMatchObject({ centerOnStartup: true })
```

- [ ] **Step 2: Run the focused settings test and verify RED**

Run:

```powershell
pnpm exec vitest run tests/unit/editor/settings/settings-controller.test.ts
```

Expected: FAIL because `centerOnStartup` is missing, only 11 writes occur, and the old notice is emitted.

- [ ] **Step 3: Implement the frontend preference field**

Add the field and default in `src/application/settings/settings-controller.ts`:

```typescript
export interface EditorPreferences {
  // existing fields...
  pngDpi: number
  centerOnStartup: boolean
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  // existing defaults...
  pngDpi: 150,
  centerOnStartup: false,
}
```

Append the setting mapping:

```typescript
['pngDpi', 'export.pngDpi'],
['centerOnStartup', 'window.centerOnStartup'],
```

Add validation and update the failure notice:

```typescript
pngDpi: integerOr(values['export.pngDpi'], 72, 600, DEFAULT_EDITOR_PREFERENCES.pngDpi),
centerOnStartup: booleanOr(
  values['window.centerOnStartup'],
  DEFAULT_EDITOR_PREFERENCES.centerOnStartup,
),
```

```typescript
this.store.setNotice('设置保存失败。本次更改可能已在当前运行生效，但不会在下次启动时保留。')
```

Add the field to `AppViewSettings` and its default in `src/stores/app-store.ts`:

```typescript
centerOnStartup: boolean
```

```typescript
centerOnStartup: false,
```

Add the field to `currentPreferences` in `src/ui/shell/AppShell.vue`:

```typescript
pngDpi: appStore.pngDpi,
centerOnStartup: appStore.centerOnStartup,
```

- [ ] **Step 4: Run focused and affected frontend tests**

Run:

```powershell
pnpm exec vitest run tests/unit/editor/settings/settings-controller.test.ts tests/unit/stores/app-store.test.ts tests/unit/app-shell.test.ts
```

Expected: all tests PASS and TypeScript accepts every complete `EditorPreferences` value.

- [ ] **Step 5: Commit the preference model increment**

```powershell
git add src/application/settings/settings-controller.ts src/stores/app-store.ts src/ui/shell/AppShell.vue tests/unit/editor/settings/settings-controller.test.ts tests/unit/stores/app-store.test.ts
git commit -m "feat(settings): add startup centering preference"
```

### Task 2: Preference UI With User-Facing Explanation

**Files:**
- Modify: `src/ui/dialogs/PreferencesDialog.vue:5-44,96-110`
- Test: `tests/component/PreferencesDialog.test.ts`

**Interfaces:**
- Consumes: `EditorPreferences.centerOnStartup` and `DEFAULT_EDITOR_PREFERENCES.centerOnStartup` from Task 1.
- Produces: `data-testid="preference-center-on-startup"` and `id="preference-center-on-startup-description"` for component tests and accessibility.

- [ ] **Step 1: Write failing component tests for the new group and explanation**

Rename the controls/apply test to `renders controls for all twelve settings with an accessible startup explanation`, then include both currently omitted `snap-to-grid` and the new field:

```typescript
const ids = [
  'theme', 'show-rulers', 'show-grid', 'show-guides', 'show-page-breaks',
  'snap-to-grid', 'default-zoom', 'default-unit', 'default-connector',
  'recent-limit', 'png-dpi', 'center-on-startup',
]
expect(ids.every((id) => wrapper.find(`[data-testid="preference-${id}"]`).exists())).toBe(true)

const center = wrapper.get<HTMLInputElement>('[data-testid="preference-center-on-startup"]')
expect(center.attributes('aria-describedby')).toBe('preference-center-on-startup-description')
expect(wrapper.get('#preference-center-on-startup-description').text()).toBe(
  '下次打开应用时，窗口会显示在上次使用的屏幕中央。窗口大小和最大化状态保持不变。',
)

await center.setValue(true)
await wrapper.get('[data-testid="preferences-apply"]').trigger('click')
expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({ centerOnStartup: true })
expect(Object.keys(wrapper.emitted('apply')?.[0]?.[0] as object)).toHaveLength(12)
```

Extend the defaults test:

```typescript
props: {
  modelValue: {
    ...DEFAULT_EDITOR_PREFERENCES,
    theme: 'dark',
    pngDpi: 600,
    centerOnStartup: true,
  },
},
```

```typescript
expect(
  wrapper.get<HTMLInputElement>('[data-testid="preference-center-on-startup"]').element.checked,
).toBe(false)
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```powershell
pnpm exec vitest run tests/component/PreferencesDialog.test.ts
```

Expected: FAIL because the window group, checkbox, description, and twelfth emitted field do not exist.

- [ ] **Step 3: Add the accessible window preference UI**

Insert after the “画布显示” fieldset in `PreferencesDialog.vue`:

```vue
<fieldset class="window-preferences">
  <legend>窗口</legend>
  <label class="described-option">
    <input
      v-model="draft.centerOnStartup"
      data-testid="preference-center-on-startup"
      type="checkbox"
      aria-describedby="preference-center-on-startup-description"
    >
    <span class="setting-copy">
      <span>应用启动居中</span>
      <small id="preference-center-on-startup-description" class="setting-description">
        下次打开应用时，窗口会显示在上次使用的屏幕中央。窗口大小和最大化状态保持不变。
      </small>
    </span>
  </label>
</fieldset>
```

Add focused styles without changing existing controls:

```css
.window-preferences { display: block; }
fieldset .described-option { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 8px; }
.described-option input { margin-top: 2px; }
.setting-copy { display: grid; gap: 3px; }
.setting-description { color: var(--color-text-secondary); font-size: 12px; font-weight: 400; line-height: 1.5; }
```

- [ ] **Step 4: Run component and shell tests**

Run:

```powershell
pnpm exec vitest run tests/component/PreferencesDialog.test.ts tests/unit/app-shell.test.ts
```

Expected: all tests PASS; the exact user-facing copy is visible and associated with the checkbox.

- [ ] **Step 5: Commit the preference UI increment**

```powershell
git add src/ui/dialogs/PreferencesDialog.vue tests/component/PreferencesDialog.test.ts
git commit -m "feat(settings): explain startup centering"
```

### Task 3: Rust Startup Setting And Centered Restore

**Files:**
- Modify: `src-tauri/src/window_state.rs:104-181` and inline tests

**Interfaces:**
- Consumes: SQLite key `window.centerOnStartup` written by Task 1 and existing `PersistenceState`/`SqliteRepository`.
- Produces: `restore_placement(state, work_areas, center_on_startup)` and `read_center_on_startup(&PersistenceState) -> bool` used by `select_initial_placement`.

- [ ] **Step 1: Write failing pure geometry tests**

Update existing `restore_placement` calls to pass `false`, preserving all current behavior. Add these focused cases:

```rust
#[test]
fn centered_restore_keeps_size_and_maximized_state_but_replaces_position() {
    let mut saved = state(100, 80, 1200, 800);
    saved.maximized = true;
    let restored = restore_placement(&saved, &[work_area(1920, 1080)], true).unwrap();
    assert_eq!(
        restored,
        WindowPlacement { x: 360, y: 140, width: 1200.0, height: 800.0, maximized: true },
    );
}

#[test]
fn centered_restore_uses_saved_secondary_monitor_work_area() {
    let primary = WorkArea { x: 0, y: 0, width: 1920, height: 1080, scale_factor: 1.0 };
    let secondary = WorkArea { x: 1920, y: 0, width: 2560, height: 1440, scale_factor: 1.0 };
    let restored = restore_placement(&state(2100, 100, 1200, 800), &[primary, secondary], true).unwrap();
    assert_eq!((restored.x, restored.y), (2600, 320));
    assert_eq!((restored.width, restored.height), (1200.0, 800.0));
}

#[test]
fn disabled_centering_preserves_existing_clamped_position() {
    let restored = restore_placement(&state(100, 80, 1200, 800), &[work_area(1920, 1080)], false).unwrap();
    assert_eq!((restored.x, restored.y), (100, 80));
}
```

- [ ] **Step 2: Run the focused Rust tests and verify RED**

Run:

```powershell
cargo test --locked --manifest-path src-tauri/Cargo.toml window_state::tests
```

Expected: FAIL to compile because `restore_placement` does not accept the centering flag.

- [ ] **Step 3: Add the centering flag to pure restore geometry**

Change the signature:

```rust
pub(crate) fn restore_placement(
    state: &WindowState,
    work_areas: &[WorkArea],
    center_on_startup: bool,
) -> Option<WindowPlacement> {
```

After target size and physical dimensions are computed, choose position with one branch:

```rust
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

Some(WindowPlacement { x, y, width, height, maximized: state.maximized })
```

Pass `false` from every existing test that verifies old restore behavior.

- [ ] **Step 4: Write failing Rust setting-read tests**

Add parsing and repository tests:

```rust
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
    repository.set_setting(CENTER_ON_STARTUP_KEY, "true").unwrap();
    let persistence = PersistenceState::available(repository);
    assert!(read_center_on_startup(&persistence));
    assert!(!read_center_on_startup(&PersistenceState::unavailable("db")));
}
```

- [ ] **Step 5: Run the setting tests and verify RED**

Run:

```powershell
cargo test --locked --manifest-path src-tauri/Cargo.toml startup_centering_setting
```

Expected: FAIL because the key and read/parse functions do not exist.

- [ ] **Step 6: Implement Rust setting read and startup wiring**

Add the constant and functions:

```rust
const CENTER_ON_STARTUP_KEY: &str = "window.centerOnStartup";

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
```

Import `SqliteRepository` only inside the test module. In `select_initial_placement`, read the setting and pass it into restore:

```rust
let persistence = window.app_handle().state::<PersistenceState>();
let center_on_startup = read_center_on_startup(&persistence);
if let Ok(repository) = persistence.repository() {
    match repository.get_window_state() {
        Ok(Some(state)) => {
            if let Some(placement) = restore_placement(&state, &work_areas, center_on_startup) {
                return Ok(placement);
            }
        }
        // existing branches unchanged
    }
}
```

Do not create a default database row; a missing key must remain equivalent to `false` for existing users.

- [ ] **Step 7: Run focused and full Rust verification**

Run:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --locked --manifest-path src-tauri/Cargo.toml window_state::tests
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Expected: all old and new Rust tests PASS; no migration, dependency, plugin, or capability change appears.

- [ ] **Step 8: Commit the native startup behavior**

```powershell
git add src-tauri/src/window_state.rs
git commit -m "feat(window): center restored window on startup"
```

### Task 4: Documentation And Full Verification

**Files:**
- Modify: `docs/interactions.md`
- Modify: `docs/features.md`
- Modify: `.agents/changelog.md`

**Interfaces:**
- Consumes: observable behavior from Tasks 1-3.
- Produces: synchronized product/developer documentation and exact verification evidence.

- [ ] **Step 1: Document the setting and explanation convention**

Add under the preferences/window behavior in `docs/interactions.md`:

```markdown
- “应用启动居中”默认关闭。开启后，下次打开应用时保留上次普通窗口大小和最大化状态，并在上次使用的显示器工作区内居中；不立即移动当前窗口。设置旁始终显示说明：“下次打开应用时，窗口会显示在上次使用的屏幕中央。窗口大小和最大化状态保持不变。”
- 生效时机、作用范围、数据影响或副作用不直观的首选项必须在名称下方提供始终可见的内联说明，并通过无障碍描述关系关联；Tooltip 不能代替关键说明。
```

Add near settings persistence in `docs/features.md`:

```markdown
- 启动居中首选项：前端与 Rust 共享 SQLite `app_settings` 键 `window.centerOnStartup`。键缺失、读取失败或值无效时按关闭处理；开启时仅改变恢复位置，继续保存真实窗口坐标。
```

- [ ] **Step 2: Run all fresh automated verification**

Run each command separately:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --locked --manifest-path src-tauri/Cargo.toml
pnpm test
pnpm build
git diff --check
```

Expected: all commands exit `0`. Record exact Rust, Vitest and build counts; existing Vite chunk and LF/CRLF warnings may remain warnings only.

- [ ] **Step 3: Inspect intended scope and append the changelog**

Run:

```powershell
git status --short
git diff -- src/application/settings/settings-controller.ts src/stores/app-store.ts src/ui/shell/AppShell.vue src/ui/dialogs/PreferencesDialog.vue tests/unit/editor/settings/settings-controller.test.ts tests/component/PreferencesDialog.test.ts src-tauri/src/window_state.rs docs/interactions.md docs/features.md .agents/changelog.md
```

Append one `.agents/changelog.md` line naming the feature, exact test/build evidence, and any unverified live desktop scenarios. Do not claim real restart or multi-monitor coverage unless observed.

- [ ] **Step 4: Commit documentation and verification evidence**

```powershell
git add docs/interactions.md docs/features.md .agents/changelog.md docs/superpowers/specs/2026-07-28-center-window-on-startup-preference-design.md docs/superpowers/plans/2026-07-28-center-window-on-startup-preference.md
git commit -m "docs(settings): document startup centering"
```

## Completion Evidence

- Frontend tests prove the setting defaults off, validates strictly, saves under the shared key, and restores defaults.
- Component tests prove ordinary users see the exact explanation and assistive technology receives the same description.
- Rust tests prove only position changes when enabled, the last display is selected, and invalid/missing settings preserve existing behavior.
- Full Rust, Vitest, build and diff checks prove the setting integrates without schema, dependency or startup regressions.
- Live restart and physical multi-monitor observations remain separately disclosed unless actually executed.
