# Task 8b1 Implementation Report

## Status

Implemented search/replace, seven application menus, contextual menus, title/status bars, layer management, unified help, and AppShell/RightPanel/Canvas integration on `feat/flowchart-editor-v1`.

## Architecture

- Search is pure application code: `findText` searches only node text and edge labels in stable document order; whole-word boundaries inspect Unicode letters/numbers/underscore by code point.
- Replace-all groups matches per `TextContent`, validates final lengths, and stores before/after snapshots in one `EditorCommand`.
- `MenuCommandController` is dependency-injected and delegates to existing stores and Task 7 factories. Vue sends command IDs only; file/window actions emit typed AppShell events with a visible pending-integration notice.
- App store contains panel/help visibility only. Find execution, arrangement, clipboard, and document changes remain in application commands/controllers.
- Menu/context listeners and existing window listeners all have matching unmount cleanup. No timer was introduced.

## TDD Evidence

### Baseline

- `pnpm vitest run`: PASS, 68 files / 626 tests before implementation.

### RED

1. Search suites: 3 failed because `find-text`, `replace-all-text`, and `find-controller` did not exist.
2. Menu suites: 3 failed because menu model, context model, and controller did not exist.
3. Shell components: 6 component suites failed on missing modules; app-store test failed because `rightPanelMode` was undefined.
4. Integration: AppShell lacked the formal menu; RightPanel remained in property mode; CanvasArea produced no context menu.
5. Build regression test: viewport event left status zoom at `1` because the template attempted to reassign a const reactive object.
6. Complex help suite: failed because `QuickHelpButton` did not exist.
7. Context submenu tests: alignment/distribution children were undefined and ArrowRight produced no submenu.
8. Exact shape mapping: expected `shape:circle`, received `shape:ellipse`.
9. Astral Unicode boundary: expected only start 13, received starts 2, 6, 13.
10. Container membership: expected `execute:移出容器`, received unavailable notice.
11. Menu child execution: ArrowRight rendered the submenu but Enter emitted no command.
12. Initial viewport: expected `{ zoom: 1, panX: 0, panY: 0 }`, received no event.

### GREEN

- Search layer: 3 files / 10 tests initially passing; final `find-text` 5/5 including astral Unicode.
- Menu layer: 3 files / 11 tests initially passing; final controller 5/5 and context model 7/7.
- Standalone shell components and app state: 7 files / 18 tests passing.
- AppShell/RightPanel/Canvas integration: 3 files / 16 tests passing, plus viewport regression tests.
- Complex feature help controls: 2/2 tests passing.
- Context submenu behavior: 2 files / 10 tests passing.
- Requested focused command: `pnpm vitest run tests/unit/editor/search tests/unit/editor/menus tests/component` PASS, 24 files / 150 tests.
- Full command: `pnpm vitest run` PASS, 81 files / 676 tests.
- Build: `pnpm build` PASS (`vue-tsc --noEmit` and Vite production build).

## Requirement Coverage

- Search scope, case, repeated matches, Unicode whole word, stable order, and node/edge-label-only boundaries are covered.
- Replace current uses `EditTextCommand`; replace-all previews before confirmation and executes/undoes as one history entry.
- Seven exact Chinese menus, checked/disabled semantics, keyboard/submenu/Escape/outside-click behavior, and cleanup are covered.
- Five exact context models, viewport clamping, keyboard/submenus/Escape/focus return, and X6 context derivation are covered.
- Title/status bars, panel mode, layers, eight new help entries, and six existing complex-feature help entry points are covered.
- No Vue Tauri invoke or browser file API is present.
- Documentation updated in `docs/features.md`, `docs/interactions.md`, and `docs/user-guide.md`.

## Self-Review

- `git diff --check`: clean; only Git line-ending notices on Windows.
- UI forbidden-API grep: no `invoke`, `@tauri-apps`, browser picker, `FileReader`, or direct read/write API in Vue files.
- Listener audit: 7 add registrations and 7 matching removals across MenuBar, CanvasContextMenu, CanvasArea, RightPanel, and CompactToolbar.
- Corrected during review: circle mapping, astral code-point boundaries, ordinary container member removal, submenu Enter behavior, and initial viewport status synchronization.
- No unrelated `opencode.json` changes are staged or committed.

## Concerns

- Vite reports the existing production chunk above 500 kB (`815.09 kB`, gzip `242.66 kB`); build succeeds and this task does not add a new lazy-loading boundary.
- Native file dialogs, persistence handler injection, and native window controls intentionally remain Task 8b2 work; current actions emit typed events and show a Chinese notice rather than failing silently.

## Findings Remediation (2026-07-21)

- Replaced all Task 8b1 context-action notices with typed Canvas/inspector/format-paint interactions and an accessible, explicit container/member picker. Membership command construction remains in `MenuCommandController`.
- Reworked case-insensitive search to compare original code-point-boundary substrings. Match offsets and replace-all slices now always reference original UTF-16 text; locale lowercase matching preserves accent differences and performs no Unicode normalization.
- Added exact node/group/container/clipboard/text prerequisites to menu and context state, matching controller guards and Chinese disabled reasons.
- Added context submenu child traversal with disabled-item skipping, document-scoped help Escape/focus restoration, resolvable Markdown anchors, a LayerManager application controller with typed Canvas locating, and custom status zoom options.
- Focused verification: `pnpm vitest run tests/unit/editor/search tests/unit/editor/menus tests/unit/editor/layers tests/unit/editor/help-registry.test.ts tests/component/MenuBar.test.ts tests/component/CanvasContextMenu.test.ts tests/component/ContainerMembershipPicker.test.ts tests/component/FeatureHelp.test.ts tests/component/LayerManager.test.ts tests/component/RightPanel.test.ts tests/component/CanvasArea.test.ts tests/component/DesktopShellParts.test.ts tests/unit/app-shell.test.ts` PASS, 17 files / 95 tests.
- Full verification: `pnpm vitest run` PASS, 83 files / 696 tests.
- Build verification: `pnpm build` PASS (`vue-tsc --noEmit`, Vite 1122 modules); existing chunk-size warning remains (`827.12 kB`, gzip `246.08 kB`).
