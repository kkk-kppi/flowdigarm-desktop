# Task 8b2 Report

## Status

Implemented file UX, recent files, guarded close, startup recovery, ten persisted preferences, safe image import, system clipboard fallback, and native window controls on `feat/flowchart-editor-v1`.

## Architecture

- `FileWorkflowController`, `RecoveryController`, and `SettingsController` coordinate stores and repository ports; Vue contains no Tauri invoke, filesystem, or SQL imports.
- `DocumentPersistenceController.saveAs()` reuses Task 8a's captured revision, atomic repository save, autosave flush, and conditional `versionToken` removal sequence.
- `main.ts` is the composition root for Tauri repositories, system clipboard, native window controller, and typed Vue service injection.
- Dialogs own focus trap/Escape/return-focus behavior; the native close event is prevented before awaiting the same file workflow close guard.

## RED Evidence

1. `pnpm vitest run tests/unit/editor/persistence/file-workflow-controller.test.ts tests/unit/editor/persistence/recovery-controller.test.ts`
   - RED: both imports missing; controllers did not exist.
2. `pnpm vitest run tests/unit/editor/persistence/document-persistence-controller.test.ts`
   - RED: `controller.saveAs is not a function`.
3. `pnpm vitest run tests/unit/editor/settings/settings-controller.test.ts tests/unit/stores/app-store.test.ts`
   - RED: missing settings controller, five preference fields, and `applyPreferences`.
4. `cargo test --manifest-path src-tauri/Cargo.toml --test image_commands`
   - RED: unresolved `commands::image_commands`; corrected an invalid hand-written PNG fixture after the decoder properly rejected it.
5. `pnpm vitest run tests/unit/editor/images/image-import.test.ts tests/unit/platform/tauri-desktop-platform.test.ts`
   - RED: missing image use case and Tauri image adapter.
6. `pnpm vitest run tests/unit/editor/clipboard/system-clipboard.test.ts tests/unit/platform/window-controller.test.ts`
   - RED: missing system clipboard and native window modules.
7. `pnpm vitest run tests/component/FileWorkflowDialogs.test.ts tests/component/PreferencesDialog.test.ts tests/unit/stores/document-store.test.ts`
   - RED: missing dialogs and recovery dirty-load action.
8. `pnpm vitest run tests/unit/app-shell.test.ts`
   - RED: missing typed editor service boundary.
9. Review RED cycles:
   - Image mapper expected X6 image markup but received rectangle markup.
   - CSP lacked `img-src 'self' data:`.
   - OS media preferences had zero change listeners.
   - Tauri capabilities lacked minimize/maximize/destroy/start-dragging permissions.
   - Invalid existing recent file was incorrectly removed instead of showing its parse error.

## GREEN Evidence

- Focused application/component/platform suites: all GREEN throughout; final workflow/settings/window subset `22 passed` and image Rust subset `3 passed`.
- Full TypeScript: `pnpm test` -> `92 passed` files, `769 passed` tests, zero failures.
- Full Rust: `cargo test --manifest-path src-tauri/Cargo.toml` -> `33` library + `3` image integration tests passed, zero failures.
- Build/typecheck: `pnpm build` -> `vue-tsc --noEmit` and Vite production build succeeded.
- Hygiene: `git diff --check` exited successfully; grep found no Tauri/invoke/fs/sql imports in Vue files and no Task 8b placeholder notices in AppShell.

## Delivered Behavior

- Dirty new/open/close save-discard-cancel matrices, picker cancellation stability, precise parse feedback, stale recent removal, busy concurrency guard, pinned-first limited recents.
- Valid recovery restores dirty and retains its snapshot; corrupt/discard paths remove only the displayed `versionToken`.
- Ten validated preferences, best-effort persistence notice, live system theme/contrast/reduced-motion mapping with listener cleanup.
- Rust absolute-path image reader: max 5 MiB, PNG/JPEG/WebP only, extension/magic agreement, decoded dimensions, SVG rejection; proportional one-command image node import and X6 data URL rendering.
- Marked and validated system clipboard payloads with safe in-app fallback and one-record paste semantics.
- Frameless 960x600 minimum window, draggable titlebar, Tauri ACL, minimize/maximize, and non-recursive guarded destroy.
- Updated `docs/features.md`, `docs/interactions.md`, and `docs/user-guide.md`.

## Concerns

- Vite reports the existing large-chunk warning (`~868 kB` main JS, `~257 kB` gzip); build succeeds and code splitting is outside Task 8b2.
- Native dialogs/window commands are covered at port/adapter/config boundaries; no packaged cross-platform GUI smoke test was requested or run.
