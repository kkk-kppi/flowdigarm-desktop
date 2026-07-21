# Task 9a SVG PNG PDF JSON Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the current page or all pages as semantic SVG, DPI-exact PNG, multi-page PDF, or one `.flowdiagram` JSON file without mutating the open document.

**Architecture:** TypeScript owns semantic SVG and an application controller that snapshots the document and prepares native DTOs. The Tauri adapter owns destination selection; Rust validates the DTO and owns file staging, PNG/PDF encoding, and atomic replacement. `ExportDialog.vue` only edits options and calls the injected controller.

**Tech Stack:** Vue 3.5, TypeScript 5.6, Vitest, Tauri 2, Rust 1.77.2, locked compatible `resvg`/`tiny-skia` and PDF-writing crates.

## Global Constraints

- Every document, X6, SVG, command, and PDF length is pt; PNG computes pixels only as `round(pt * dpi / 72)`.
- PNG DPI is exactly one of 96, 150, or 300 and export never writes preferences or document state.
- Only `http`, `https`, and `mailto` links survive in SVG/PDF.
- Rust stages and syncs every output before replacing any final target; failed generation leaves existing targets untouched.
- Runtime export is fully offline.
- Final verification is focused Vitest, full Vitest, `cargo test`, and application build.

---

### Task 1: Semantic SVG renderer

**Files:**
- Create: `src/infrastructure/export/svg-export.ts`
- Test: `tests/unit/editor/export/svg-export.test.ts`

**Interfaces:**
- Consumes: `DiagramDocument`, `DiagramPage`, `shapeRegistry`, and registered common shapes.
- Produces: `renderPageSvg(document: DiagramDocument, pageId: string): { svg: string; links: ExportLinkAnnotation[] }`.

- [ ] **Step 1: Write failing renderer tests** for A4 pt root attributes, 15 registered shapes, background-before-foreground order, z-order, edge connector variants/vertices/markers/labels, XML escaping, horizontal and per-character vertical text, safe link wrappers/annotations, dangerous-link omission, data-image filtering, and absence of grid/editor overlays.
- [ ] **Step 2: Run focused renderer tests** with `pnpm vitest run tests/unit/editor/export/svg-export.test.ts`; expect failure because the module does not exist.
- [ ] **Step 3: Implement pure rendering** using XML attribute/text escaping, finite pt formatting, shape-registry geometry, sorted cells, background resolution, edge path generation, text layout, and safe-link checks. Never read DOM/X6 or mutate input.
- [ ] **Step 4: Re-run focused renderer tests** and require all assertions to pass.

### Task 2: Export application controller and Tauri adapter

**Files:**
- Create: `src/application/export/export-ports.ts`
- Create: `src/application/export/export-controller.ts`
- Modify: `src/platform/tauri-desktop-platform.ts`
- Test: `tests/unit/editor/export/export-controller.test.ts`
- Test: `tests/unit/platform/tauri-desktop-platform.test.ts`

**Interfaces:**
- Consumes: `renderPageSvg`, `serializeDiagramDocument`, immutable store snapshot, `DiagramExporter`.
- Produces: `ExportController.chooseDestination(options)`, `ExportController.export(options)`, `createTauriDiagramExporter(invokeCommand?)`, and `tauriDiagramExporter`.

- [ ] **Step 1: Write failing controller/adapter tests** for format/scope/name/DPI validation, safe all-pages names, PDF single output, JSON serialization, cancel, busy rejection, native error wrapping, exact adapter dialog filters/invoke DTO, and unchanged document/revision/dirty snapshots.
- [ ] **Step 2: Run focused controller/adapter tests** and confirm missing interfaces fail.
- [ ] **Step 3: Implement ports and controller** with `structuredClone`, sanitized names, extension normalization, page payload construction, one in-flight guard, cancellation without state changes, and stable Chinese errors.
- [ ] **Step 4: Implement Tauri adapter** so dialog selection and `invoke('export_diagram', { input })` exist only in the platform layer.
- [ ] **Step 5: Re-run focused tests** and require all assertions to pass.

### Task 3: Native export generation and transaction

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Create: `src-tauri/src/commands/export_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: camelCase-deserialized `NativeExportRequest` with target path, format, dpi, JSON, and SVG page payloads.
- Produces: Tauri command `export_diagram(input: NativeExportRequest) -> Result<Vec<String>, String>`.

- [ ] **Step 1: Add failing Rust unit tests** for absolute path/extension/DPI/page-size/payload/link validation, 96/150/300 pixel dimensions, SVG/JSON bytes, multi-page PDF MediaBox and URI annotations, and generation failure preserving all old targets.
- [ ] **Step 2: Run `cargo test export_commands`** and confirm failure before implementation.
- [ ] **Step 3: Lock Rust-1.77-compatible encoder versions** with only local SVG parsing/rasterization and PDF writing; do not add HTTP clients or runtime resource loading.
- [ ] **Step 4: Implement validation and generation** including `round(width_pt*dpi/72)`, SVG resource loading disabled, real PDF pages sized in pt, escaped PDF URI strings, and safe protocol enforcement.
- [ ] **Step 5: Implement all-or-nothing staging** by rendering every artifact into sibling temporary files, syncing each, then committing with rollback backups so replacement failure restores every previous target.
- [ ] **Step 6: Register the command and run focused Rust tests** until all pass.

### Task 4: Export dialog and shell orchestration

**Files:**
- Create: `src/ui/dialogs/ExportDialog.vue`
- Modify: `src/ui/services/editor-services.ts`
- Modify: `src/ui/shell/AppShell.vue`
- Modify: `src/main.ts`
- Test: `tests/component/ExportDialog.test.ts`
- Modify: `tests/unit/app-shell.test.ts`

**Interfaces:**
- Consumes: injected export controller with `chooseDestination` and `export`, document/app defaults, and `helpId='export'`.
- Produces: a 480px accessible modal that emits only `close`/`help` and displays controller outcomes.

- [ ] **Step 1: Write failing component/shell tests** for scope/format cards, conditional DPI, filename/path browsing, busy disabling, success/failure copy, focus trap, Escape, help, focus restoration, and real File menu opening.
- [ ] **Step 2: Run focused component/shell tests** and confirm the dialog/service wiring is absent.
- [ ] **Step 3: Implement orchestration-only dialog** with no SVG, native invoke, document mutation, or persistence logic.
- [ ] **Step 4: Inject and construct the controller in `main.ts`** and wire AppShell modal/help/toast behavior while including export in modal inertness and file busy state.
- [ ] **Step 5: Re-run focused UI tests** and require all pass.

### Task 5: Documentation and end-to-end verification

**Files:**
- Modify: `docs/features.md`
- Modify: `docs/user-guide.md`
- Modify: `docs/interactions.md`
- Create: `.superpowers/sdd/reports/task-9a-report.md`

**Interfaces:**
- Consumes: verified implementation and command output.
- Produces: user-facing export guidance and evidence report.

- [ ] **Step 1: Document formats and scopes** including PDF multi-page behavior, SVG/PNG per-page naming, JSON single-file behavior, supported DPI, links, and cancellation/failure guarantees.
- [ ] **Step 2: Run focused Vitest** for export renderer/controller/platform/dialog/shell and record totals.
- [ ] **Step 3: Run full Vitest** with `pnpm test` and record totals.
- [ ] **Step 4: Run full Rust tests** with a long timeout using `cargo test --manifest-path src-tauri/Cargo.toml` and record totals.
- [ ] **Step 5: Run `pnpm build`** and record TypeScript/Vite results.
- [ ] **Step 6: Review the final diff and report** for no placeholders, ownership violations, unexpected files, or missing acceptance criteria.
- [ ] **Step 7: Commit only intended files** with `git commit -m "feat: add svg png pdf json export"` and do not push.
