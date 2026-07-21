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

## Findings Remediation (2026-07-21)

- Startup now withholds all editor controls and global canvas shortcuts until settings and recovery lookup finish; a pending recovery decision is the sole rendered dialog and restore/discard releases the gate.
- System clipboard input now validates the complete node/edge/text/style/label schema, UUID uniqueness and references, geometry, counts, text/image limits, and URL protocols before updating the in-app fallback.
- Tauri file failures map to structured `not-found`/`invalid`/`too-large`/`permission`/`io` application errors with stable Chinese messages; recent entries are removed only for `not-found`.
- Canvas keyboard paste and toolbar/menu paste share the async store workflow, which uses local data first and only then reads and validates the system clipboard.
- Persisted unit, connector, and zoom defaults now apply to the untouched initial document, future documents, and lazily created per-page viewports.
- Recovery discard confirmation receives focus after its DOM swap; shared dialog return focus is cleared and recaptured for unsaved close flows.
- Image bytes are checked again after reading and before type detection, decoding, or data URL encoding.

## Findings Verification

- Focused workflow/recovery/clipboard/settings/store/CanvasArea/dialog/platform matrix: `13 passed` files, `153 passed` tests.
- Full TypeScript: `pnpm test` -> `92 passed` files, `797 passed` tests.
- Full Rust: `cargo test --manifest-path src-tauri/Cargo.toml` -> `33` library + `4` image integration tests passed.
- Build/typecheck: `pnpm build` succeeded; the existing ~873 kB chunk-size warning remains non-blocking.

## Remaining Findings Remediation (2026-07-21)

- Copied hierarchy now keeps only in-payload parents, and paste remaps every retained `parentId` through a complete old-to-new UUID map without original references.
- System clipboard validation rejects self-parenting, cycles, missing/non-container parents, and checks ancestry iteratively for every node.
- Settings and recents load independently before recovery is always attempted; recovery storage failures report a notice and release the editor gate.
- Unsaved dialogs own a dedicated lifecycle-scoped focus target; file, recent, image, and preferences operations cannot pollute it.
- Deferred settings and native close-listener registration are generation/disposal guarded, including immediate unlisten after late registration.

## Remaining Findings Verification

- RED: focused regressions initially failed `10` tests across clipboard/startup/focus/settings/window; the recovery repository notice regression also failed before its fix.
- Focused clipboard/startup/recovery/settings/window/focus matrix: `6 passed` files, `70 passed` tests.
- Full TypeScript: `pnpm test` -> `92 passed` files, `807 passed` tests.
- Build/typecheck: `pnpm build` succeeded; the existing ~874 kB chunk-size warning remains non-blocking.
- Rust was unchanged, so the optional Cargo suite was not rerun.

## Final Gap Remediation (2026-07-21)

- Container classification now has one application/shapes predicate: explicit `isContainer: true` or a registered container shape definition. Clipboard hierarchy validation, membership, picker/menu state, canvas context, and auto-connect eligibility consume it; a `group` parent no longer needs a redundant flag while an ordinary parent remains invalid.
- Menu commands move focus to the persistent top-level trigger before emitting, so File -> New unsaved cancellation returns to the File button instead of retaining a detached submenu item.
- Startup awaits best-effort settings before loading recents with the resulting `appStore.recentLimit`; settings/recent failures cannot skip recovery, and the startup gate remains until recovery lookup settles.

## Final Gap Verification

- RED: the focused run failed all four intended boundaries: registered group parent acceptance, deferred recent loading, persisted limit `12`, and File -> New cancel focus return.
- Focused container/clipboard/menu/canvas/startup matrix: `7 passed` files, `75 passed` tests.
- Full TypeScript: `pnpm vitest run` -> `92 passed` files, `810 passed` tests.
- Build/typecheck: `pnpm build` succeeded; the existing 873.62 kB chunk-size warning remains non-blocking.
