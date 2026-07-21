# Final Review Blockers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every final-review blocker without changing editor visuals or unrelated behavior.

**Architecture:** One domain validator owns persisted-schema rules and receives shape facts through an explicit context. Application controllers own commands, measurement conversion, hyperlink ports, and interaction blocking; Vue owns rendering, drafts, focus, and event forwarding. X6 and Rust remain adapters with tested coordinate and export boundaries.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, X6, Tauri 2, Rust, Playwright.

## Global Constraints

- Strict RED-GREEN TDD for every behavior change.
- Current schema requires UUIDv4; only legacy migration may remap IDs and references.
- Save, open, recent, recovery, autosave, and JSON export use the same shape-aware validation context.
- No `.vue` imports from command, measurement, or platform modules and no direct command construction/invocation.
- Keep macOS, offline, and signing statuses unchanged unless existing evidence covers them.

---

### Task 1: Persisted document boundary

**Files:** `src/domain/document-schema.ts`, persistence/recovery/export controllers, `src/main.ts`, fixtures and focused domain/persistence tests.

- [ ] Add table-driven failing schema tests for IDs, page fields, shapes, nodes, edges, parents, cycles, ports, limits, and legacy remapping; run and record RED.
- [ ] Add failing save/autosave/open/recent/recovery tests proving shape context and no data loss; run and record RED.
- [ ] Implement one shape-aware validator and validated serializer, wire every production workflow, and update current-schema fixtures to UUIDv4.
- [ ] Run the focused tests to GREEN.

### Task 2: Command and X6 correctness

**Files:** `src/application/commands/edit-text.ts`, `src/infrastructure/x6/graph-adapter.ts`, focused command/adapter tests.

- [ ] Add failing grouped-child absolute-resize and empty-existing-edge-label undo tests; run and record RED.
- [ ] Add a tested pure X6 absolute-position helper and explicit edge-label before snapshot.
- [ ] Run the focused tests to GREEN.

### Task 3: View behavior, overlays, links, backgrounds, and export security

**Files:** app store/settings, Canvas/AppShell/Menu, GraphAdapter, SVG/Rust export, capability, focused component/unit/Rust tests.

- [ ] Add failing tests for guides/grid snapping, interaction blocking and canvas ownership, edge links, background chains, clipping, signed annotations, and opener capability; run and record RED.
- [ ] Implement adapter toggles, explicit interaction-block state, shared hyperlink controller, transitive layer rendering, annotation clipping/signed validation, and least privilege.
- [ ] Run focused Vitest and Cargo tests to GREEN.

### Task 4: Hard UI layering

**Files:** new canvas/property controllers and view models, all affected Vue components, architecture contract tests.

- [ ] Add the failing all-`.vue` architecture scan and controller behavior tests; run and record RED.
- [ ] Move command construction, conversions, and platform calls to application modules while retaining UI event/focus orchestration.
- [ ] Run controller, component, architecture, and type/build tests to GREEN.

### Task 5: Evidence and delivery

**Files:** implementation docs and `.superpowers/sdd/reports/final-blockers-fix.md`.

- [ ] Correct implementation claims and acceptance trace rows without upgrading uncovered platform statuses.
- [ ] Run full Vitest, Cargo locked tests, Playwright full plus critical repeat, frontend build, and Tauri no-bundle locked build.
- [ ] Record exact RED/GREEN/full results and residual concerns, review the diff, and commit only related files with the requested message.
