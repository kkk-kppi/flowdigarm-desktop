# Task 8b2 File UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect file, recovery, preferences, image import, clipboard, and native window controls to the desktop editor with safe Chinese failure feedback.

**Architecture:** Vue components depend on application controllers and typed ports provided from the composition root. Existing persistence repositories and `DocumentPersistenceController` remain authoritative for atomic save, revision capture, autosave, and conditional recovery deletion; new workflows orchestrate them without direct file, SQL, or Tauri access.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Tauri 2, Rust, SQLite, `image`.

## Global Constraints

- Strict RED/GREEN TDD with focused evidence recorded in `.superpowers/sdd/reports/task-8b2-report.md`.
- Vue must not import Tauri invoke, filesystem, or SQL APIs.
- Preserve Task 8a atomic save and recovery `versionToken` semantics.
- Clipboard and image failures degrade safely with readable Chinese feedback.
- Dialogs trap focus, implement required Escape behavior, and restore focus.
- Verify focused TypeScript tests, full Vitest, Cargo tests, and production build.

---

### Task 1: File And Recovery Workflows

**Files:**
- Create: `src/application/persistence/file-workflow-controller.ts`
- Create: `src/application/recovery/recovery-controller.ts`
- Modify: `src/application/persistence/document-persistence-controller.ts`
- Test: `tests/unit/editor/persistence/file-workflow-controller.test.ts`
- Test: `tests/unit/editor/persistence/recovery-controller.test.ts`

**Interfaces:**
- Consumes: `DiagramFileRepository`, `RecoveryRepository`, `RecentDocumentRepository`, `DocumentPersistenceController.save()`.
- Produces: `FileWorkflowController.newDocument/openDocument/openRecent/save/saveAs/requestClose`, busy state, recent list, and `RecoveryController.check/restore/discard`.

- [ ] **Step 1: Write failing workflow matrix tests** covering dirty save/discard/cancel, native cancellation, invalid files, missing recent removal, concurrent calls, explicit save-as, and guarded close.
- [ ] **Step 2: Run `pnpm vitest run tests/unit/editor/persistence/file-workflow-controller.test.ts`** and record failures caused by missing controllers.
- [ ] **Step 3: Implement the minimal workflow orchestration** using captured save revisions through `DocumentPersistenceController`; add an explicit path override for save-as without changing atomic/recovery sequencing.
- [ ] **Step 4: Write and run failing recovery tests** for valid dirty restore, retained snapshots, token-specific discard, and corrupt snapshot deletion.
- [ ] **Step 5: Implement recovery parsing and token-specific removal**, then rerun both focused files to GREEN.

### Task 2: Settings And Theme Application

**Files:**
- Create: `src/application/settings/settings-controller.ts`
- Modify: `src/stores/app-store.ts`
- Test: `tests/unit/editor/settings/settings-controller.test.ts`
- Test: `tests/unit/stores/app-store.test.ts`

**Interfaces:**
- Consumes: `SettingsRepository.all/set` and an app settings port.
- Produces: validated ten-setting `EditorPreferences`, defaults, `load`, `apply`, and media-aware root attributes/classes.

- [ ] **Step 1: Write failing tests** for all defaults, invalid values, persistence failure fallback, system color scheme, contrast, and reduced motion.
- [ ] **Step 2: Run `pnpm vitest run tests/unit/editor/settings/settings-controller.test.ts tests/unit/stores/app-store.test.ts`** and record RED.
- [ ] **Step 3: Implement validators and app-store fields/actions** for theme, rulers, grid, guides, page breaks, zoom, unit, connector, recent limit, and PNG DPI.
- [ ] **Step 4: Persist changed settings best-effort** and set `data-theme`, `data-contrast`, and `data-reduced-motion`; rerun focused tests to GREEN.

### Task 3: Safe Image Reading And Import

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/commands/image_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src/application/images/image-import.ts`
- Modify: `src/platform/tauri-desktop-platform.ts`
- Test: `tests/unit/editor/images/image-import.test.ts`

**Interfaces:**
- Produces: Rust `read_image(path) -> { dataUrl, width, height }`, `ImageRepository.pickAndRead()`, and `importImage` creating one selected image node via one `CreateCellsCommand`.

- [ ] **Step 1: Add failing Rust unit tests** for absolute path, 5 MiB, supported magic/extension agreement, SVG rejection, and decoded dimensions.
- [ ] **Step 2: Run `cargo test image_commands --manifest-path src-tauri/Cargo.toml`** and record RED.
- [ ] **Step 3: Implement bounded reads and decoding** with only PNG/JPEG/WebP image features and stable Chinese errors.
- [ ] **Step 4: Write failing TypeScript tests** for picker cancellation, 240 pt proportional scaling, 24 pt minimum, centering, one command, and selection.
- [ ] **Step 5: Implement the use case and Tauri adapter**, then rerun Rust and TypeScript image tests to GREEN.

### Task 4: System Clipboard And Native Window Ports

**Files:**
- Create: `src/infrastructure/clipboard/system-clipboard.ts`
- Modify: `src/stores/document-store.ts`
- Create: `src/platform/window-controller.ts`
- Create: `src/platform/tauri-window-controller.ts`
- Modify: `src-tauri/tauri.conf.json`
- Test: `tests/unit/editor/clipboard/system-clipboard.test.ts`
- Test: `tests/unit/platform/window-controller.test.ts`

**Interfaces:**
- Produces: best-effort `SystemClipboard.write/read`, validated FlowDiagram MIME marker payloads, async store copy/cut/paste, and `WindowController.minimize/toggleMaximize/requestClose/onCloseRequested`.

- [ ] **Step 1: Write failing clipboard tests** for browser API success, denial fallback/notice, malicious payload rejection, internal edges, and one paste history entry.
- [ ] **Step 2: Run focused clipboard tests** and record RED.
- [ ] **Step 3: Implement bounded schema validation and in-memory fallback**, wire store actions without blocking copy/cut/paste, and rerun to GREEN.
- [ ] **Step 4: Write failing window tests** for close prevention, save guard, recursive-close suppression, minimize, and maximize toggle.
- [ ] **Step 5: Implement platform-neutral and Tauri adapters**, set decorations false and minimum 960x600, then rerun focused tests to GREEN.

### Task 5: Dialogs, Recents, Preferences, And Shell Wiring

**Files:**
- Create: `src/ui/dialogs/UnsavedChangesDialog.vue`
- Create: `src/ui/dialogs/RecoveryDialog.vue`
- Create: `src/ui/dialogs/PreferencesDialog.vue`
- Modify: `src/ui/shell/AppShell.vue`
- Modify: `src/application/menus/menu-model.ts`
- Modify: `src/main.ts`
- Modify: `src/App.vue`
- Test: `tests/component/FileWorkflowDialogs.test.ts`
- Test: `tests/component/PreferencesDialog.test.ts`
- Modify: `tests/component/MenuBar.test.ts`
- Modify: `tests/unit/app-shell.test.ts`

**Interfaces:**
- Consumes: controllers through Vue injection keys configured in `main.ts`.
- Produces: modal focus lifecycle, recovery decision UI, ten-setting preferences form, dynamic recent submenu, real menu callbacks, title controls, and busy disabling.

- [ ] **Step 1: Write failing component tests** for focus trap/Escape/restore, discard confirmation, preference defaults/apply/reset, recent tooltips, and non-placeholder callbacks.
- [ ] **Step 2: Run focused component tests** and record RED.
- [ ] **Step 3: Implement accessible dialogs and injected application services**, ensuring startup recovery appears once and background content is inert while modal.
- [ ] **Step 4: Replace placeholder file/image/preferences/window callbacks**, load recents/settings at startup, and rerun focused tests to GREEN.

### Task 6: Documentation, Verification, And Commit

**Files:**
- Modify: feature, interaction, and user-guide documentation located by existing repository conventions.
- Create: `.superpowers/sdd/reports/task-8b2-report.md`

- [ ] **Step 1: Update user-facing documentation** for files, recents, recovery, image import, preferences, clipboard fallback, and guarded close.
- [ ] **Step 2: Run focused TypeScript suites** and record command/output evidence.
- [ ] **Step 3: Run `pnpm test`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `pnpm build`** and record exact outcomes.
- [ ] **Step 4: Review `git diff`, generated files, Tauri/Vue boundaries, and report coverage**; fix only task-related failures.
- [ ] **Step 5: Commit intended files** with `git commit -m "feat: add file workflows recovery preferences and image import"` and do not push.
