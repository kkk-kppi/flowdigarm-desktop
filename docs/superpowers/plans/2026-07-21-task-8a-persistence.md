# Task 8a Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add failure-safe `.flowdiagram` persistence, transactional local SQLite metadata, recent files, settings, shape usage, and debounced recovery snapshots without exposing file or database APIs to Vue.

**Architecture:** Application-layer ports own persistence contracts and document use cases. Tauri platform adapters invoke Rust commands; Rust owns path validation, atomic file replacement, migrations, and SQLite transactions. User-file success is authoritative, while metadata and shape-usage persistence degrade safely.

**Tech Stack:** Rust 1.77.2, Tauri 2, rusqlite, serde_json, Vue 3, TypeScript 5.6, Pinia, Vitest.

## Global Constraints

- `.flowdiagram` writes use a same-directory temporary file, file fsync, atomic replacement, cleanup on failure, and parent-directory fsync on Unix.
- Windows replacement must atomically overwrite an existing destination.
- File and JSON payloads are limited to 20 MiB; paths are absolute, NUL-free, and saves use only `.flowdiagram`.
- SQLite contains exactly the seven metadata tables in the brief and never stores the primary diagram file.
- Every SQLite write uses an explicit transaction; JSON text is validated before writing.
- A database failure cannot turn a successful user-file save into failure.
- Vue never invokes Tauri or accesses files/SQLite directly; application defines ports and platform/infrastructure implement them.
- All user-visible errors are Simplified Chinese.
- No menu, recovery dialog, or find UI is implemented in Task 8a.

---

### Task 1: Atomic Files And Rust File Validation

**Files:**
- Create: `src-tauri/src/persistence/atomic_file.rs`
- Create: `src-tauri/src/persistence/mod.rs`
- Create: `src-tauri/src/commands/file_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `atomic_write(path: &Path, bytes: &[u8]) -> Result<(), AtomicFileError>`.
- Produces: validated `read_diagram` and `save_diagram` command helpers with the exact Chinese errors from the brief.

- [ ] **Step 1: Write failing Rust tests**

Add unit tests for a new file, overwrite, injected pre-replace failure preserving old bytes, temporary cleanup, Chinese JSON round-trip, absolute/extension/NUL checks, 20 MiB enforcement, UTF-8/JSON/schemaVersion validation, and save path extension completion.

- [ ] **Step 2: Run tests to verify RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml persistence::atomic_file commands::file_commands`
Expected: compilation failure because the modules and functions do not exist.

- [ ] **Step 3: Implement minimum production code**

Use `create_new` for a UUID-named sibling temporary file, `write_all`, `sync_all`, platform-specific atomic replacement, cleanup through an error guard, and Unix parent-directory `sync_all`. Keep validation as focused private functions in `file_commands.rs`; map save failures to `无法保存，原文件未被覆盖。`.

- [ ] **Step 4: Run focused Rust tests to verify GREEN**

Run: `cargo test --manifest-path src-tauri/Cargo.toml persistence::atomic_file commands::file_commands`
Expected: all focused tests pass.

### Task 2: SQLite Metadata Repository And Tauri State

**Files:**
- Replace: `src-tauri/src/migrations/001_initial.sql`
- Create: `src-tauri/src/persistence/sqlite_repository.rs`
- Modify: `src-tauri/src/commands/file_commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**
- Consumes: validated JSON and paths from Task 1.
- Produces: settings, recent, recovery, shape usage, window state, and template repository methods plus Tauri commands listed in the brief.

- [ ] **Step 1: Write failing repository tests**

Test all seven exact table schemas, connection PRAGMAs, idempotent migration version 1, missing-only defaults, every CRUD family, pinned/recent ordering and non-pinned 50-row pruning, JSON rejection, and rollback after an intentionally failing multi-statement write.

- [ ] **Step 2: Run repository tests to verify RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml persistence::sqlite_repository`
Expected: compilation failure because `SqliteRepository` is absent.

- [ ] **Step 3: Implement transactional repository**

Wrap `rusqlite::Connection` in `Mutex`, configure each opened connection with foreign keys, WAL where supported, and 5000 ms timeout, execute migration plus version insert in one transaction, and use an explicit transaction for every mutation. Initialize defaults with `INSERT OR IGNORE`; prune only unpinned recent rows beyond 50.

- [ ] **Step 4: Wire managed state and commands**

Resolve `flowchart-editor.db` from Tauri app data, manage the repository, register all file/metadata commands while retaining the URL command, and add only dialog open/save capability permissions. `save_diagram` performs atomic write first and logs recent-document failure without returning it.

- [ ] **Step 5: Run repository and command tests to verify GREEN**

Run: `cargo test --manifest-path src-tauri/Cargo.toml persistence::sqlite_repository commands::file_commands`
Expected: all focused tests pass.

### Task 3: TypeScript Ports, Use Cases, Autosave, And Tauri Adapters

**Files:**
- Create: `src/application/persistence/persistence-ports.ts`
- Create: `src/application/persistence/document-file-use-cases.ts`
- Create: `src/application/persistence/autosave-controller.ts`
- Create: `src/infrastructure/persistence/tauri-shape-usage-repository.ts`
- Modify: `src/platform/desktop-platform.ts`
- Replace: `src/platform/tauri-desktop-platform.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Test: `tests/unit/editor/persistence/document-file-use-cases.test.ts`
- Test: `tests/unit/editor/persistence/autosave-controller.test.ts`
- Test: `tests/unit/editor/shapes/shape-usage-repository.test.ts`

**Interfaces:**
- Produces: `DiagramFileRepository`, `RecoveryRepository`, `RecentDocumentRepository`, `SettingsRepository`, DTOs aligned with Rust, `openDiagram`, `openRecentDiagram`, `saveDiagram`, and `AutosaveController`.
- Produces: `TauriShapeUsageRepository` with an injected invoke adapter and an in-memory fallback.

- [ ] **Step 1: Write failing TypeScript tests**

Cover open cancellation, valid parsing, invalid schema/geometry/URL without store mutation, serialization and save failure state preservation; fake-timer 1999/2000 ms debounce, last-write wins, flush, cancel/dispose, and caught repository rejection; invoke argument mapping and fallback shape usage.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `pnpm vitest run tests/unit/editor/persistence tests/unit/editor/shapes/shape-usage-repository.test.ts`
Expected: module resolution failures for the new application and infrastructure modules.

- [ ] **Step 3: Implement ports and use cases**

Keep document parsing/serialization in application use cases. Return discriminated `{ ok: true, ... } | { ok: false, error }` results; convert unknown failures to concise Chinese errors and never mutate documents.

- [ ] **Step 4: Implement autosave and adapters**

Use one replaceable timeout and one pending snapshot. `flush` cancels the timer and awaits the latest write; rejected writes call injected `onError('自动恢复快照保存失败，图文件不受影响。')`. Dialog selection happens only in the Tauri platform adapter and all actual reads/writes use commands.

- [ ] **Step 5: Add dialog dependency and run focused tests GREEN**

Run: `pnpm add @tauri-apps/plugin-dialog@^2.0.0`
Run: `pnpm vitest run tests/unit/editor/persistence tests/unit/editor/shapes/shape-usage-repository.test.ts`
Expected: all focused tests pass.

### Task 4: Save-Point Dirty Tracking, Initialization, And Documentation

**Files:**
- Modify: `src/stores/document-store.ts`
- Modify: `src/main.ts`
- Modify: `tests/unit/stores/document-store.test.ts`
- Modify: `docs/features.md`
- Modify: `docs/user-guide.md`
- Create: `.superpowers/sdd/reports/task-8a-report.md`

**Interfaces:**
- Consumes: Tauri shape usage adapter and existing per-page command histories.
- Produces: `replaceDocument(document, path?)`, save-point-aware `markSaved(path)`, and dirty state that becomes clean only at the exact saved document revision.

- [ ] **Step 1: Write failing store tests**

Test clean after save, dirty after edit, clean when undo returns to saved revision, dirty after redo, and a branched edit remaining dirty even when command-stack depth equals the saved depth.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `pnpm vitest run tests/unit/stores/document-store.test.ts`
Expected: undo to save point remains dirty.

- [ ] **Step 3: Implement identity-based save points and initialization**

Track the exact saved `DiagramDocument` object in a non-reactive WeakMap keyed by store. After execute/undo/redo set `dirty = document !== savedDocument`; load/replace/markSaved update the saved identity. Install Tauri shape usage after Pinia activation, retaining in-memory fallback inside the adapter.

- [ ] **Step 4: Update documentation and report**

Document file/recent/recovery behavior, metadata boundaries, save-point dirty behavior, test locations, actual RED/GREEN command output, final commands, changed files, and concerns.

- [ ] **Step 5: Verify everything**

Run: `pnpm vitest run tests/unit/editor/persistence tests/unit/stores`
Run: `cargo test --manifest-path src-tauri/Cargo.toml` with at least 900000 ms timeout.
Run: `pnpm vitest run`
Run: `pnpm build`
Expected: all commands exit 0.

- [ ] **Step 6: Self-review and commit**

Inspect `git diff --check`, `git diff`, security boundaries, transaction usage, error language, and test coverage; fix findings and rerun affected/full verification. Stage only Task 8a files and commit `feat: add safe file persistence sqlite and recovery` without pushing.
