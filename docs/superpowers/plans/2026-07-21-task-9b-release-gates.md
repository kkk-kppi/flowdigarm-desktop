# Task 9b E2E Performance and Tauri Release Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the editor release with browser-driven critical journeys, deterministic 500-node/800-edge performance evidence, Windows and macOS CI, and an honest local Windows Tauri release build record.

**Architecture:** `main.ts` selects browser repositories and controllers only when compile-time `VITE_E2E=1`; normal development and production keep the Tauri adapters. A narrow `window.__FLOW_E2E__` API injects fixtures and reads assertions, while all core editing actions remain Playwright UI interactions. Shared Playwright fixtures fail tests on unapproved browser errors and write machine-readable performance evidence.

**Tech Stack:** Vue 3.5, Pinia 2, TypeScript 5.6, Vite 6, Vitest 2, Playwright 1.48 Chromium, Tauri 2, Rust 1.77.2, GitHub Actions.

## Global Constraints

- Strict test-first cycles: observe each focused test fail before implementing its production support.
- Browser platform selection exists only under `VITE_E2E=1`; production and Tauri builds select Tauri adapters.
- Playwright core steps use role, aria, test ID, keyboard, and X6 cell UI; hooks are fixtures and assertions only.
- Every E2E fails on unexpected `console.error`, `pageerror`, or `unhandledrejection`.
- Performance fixture is deterministic: exactly 500 nodes and 800 valid edges with Chinese text and valid ports.
- Supported CI platforms are only Windows 10/11 and macOS Intel/Apple Silicon; no Linux matrix.
- macOS is configured but remains explicitly unverified in this Windows report.
- No signing or notarization secret values are committed.
- The task ends in one commit named `test: add editor e2e performance and release gates`; do not push.

---

### Task 1: Deterministic performance fixture and pure benchmark

**Files:**
- Create: `tests/performance/benchmark-500-nodes.ts`
- Create: `tests/unit/performance/benchmark-500-nodes.test.ts`

**Interfaces:**
- Consumes: `DiagramDocument`, schema parser/serializer, registered shape ports, and document commands.
- Produces: `createBenchmarkDocument(): DiagramDocument` with stable IDs, 500 nodes, and 800 edges.

- [ ] **Step 1: Write failing fixture tests** asserting exact counts, unique stable IDs, Chinese node text, resolvable endpoints/ports, schema round-trip, command selection/move applicability, and serialization under 2000ms.
- [ ] **Step 2: Run `pnpm vitest run tests/unit/performance/benchmark-500-nodes.test.ts`** and confirm failure because the fixture module is absent.
- [ ] **Step 3: Implement the minimal deterministic grid fixture** with UUID-shaped IDs, bounded page geometry, four cardinal ports, and a repeatable edge sequence without self-edges.
- [ ] **Step 4: Re-run the focused Vitest file** and require all assertions to pass.

### Task 2: E2E-only browser application ports and hook

**Files:**
- Create: `src/platform/browser-e2e-platform.ts`
- Create: `src/e2e/e2e-hook.ts`
- Create: `src/e2e/e2e-types.ts`
- Modify: `src/main.ts`
- Modify: `src/vite-env.d.ts`
- Create: `tests/unit/platform/browser-e2e-platform.test.ts`
- Create: `tests/unit/e2e/e2e-hook.test.ts`

**Interfaces:**
- Consumes: existing file/recovery/recent/settings/export/image/window ports, Pinia stores, controllers, and `createBenchmarkDocument`.
- Produces: in-browser repositories with atomic old-artifact preservation and `installE2EHook(...) => () => void`; the hook exposes fixture injection, snapshots, artifact metadata, failure controls, and active-resource counts.

- [ ] **Step 1: Write failing adapter tests** for save/open/recent/recovery/settings/export/image/window behavior, no network access, failure injection, old-artifact preservation, PNG dimensions/PDF URI marker, and reset isolation.
- [ ] **Step 2: Write failing hook tests** for benchmark/recovery injection, immutable document/history reads, artifact reads, failure controls, error/resource counters, uninstall cleanup, and production non-selection.
- [ ] **Step 3: Run both focused Vitest files** and confirm missing modules and selection wiring fail.
- [ ] **Step 4: Implement browser repositories and window controller** using local in-memory state plus localStorage only where reload persistence is required; generate assertion-oriented SVG/PNG/PDF/JSON artifact metadata without network calls.
- [ ] **Step 5: Refactor `main.ts` minimally** to choose a complete dependency set from `import.meta.env.VITE_E2E === '1'`, inject the browser platform into Vue, install the hook only in that branch, and retain current Tauri imports/behavior in the normal branch.
- [ ] **Step 6: Implement hook lifecycle accounting** and dispose hook, persistence, settings, window, subscriptions, timers, listeners, and controllers on unload/unmount.
- [ ] **Step 7: Re-run focused tests and `pnpm build`**; require tests to pass and the normal production build to contain no selected browser platform.

### Task 3: Playwright harness and core editor journey

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `playwright.config.ts`
- Create: `e2e/fixtures.ts`
- Create: `e2e/editor-core.spec.ts`

**Interfaces:**
- Consumes: visible application UI and assertion-only `window.__FLOW_E2E__` reads.
- Produces: Chromium execution at `localhost:1420`, first-retry traces, failure screenshots/video, HTML/JSON reports, and per-test browser error gates.

- [ ] **Step 1: Write the core journey and shared error fixture first** for New, two library double-clicks, ordered auto-connect, F2/Ctrl+Enter Chinese edit, mixed bold, one-shot/continuous format paint/Escape, replace-all/undo, mm-to-cm invariant, save/dirty, recovery reload/restore, and SVG/PNG 96/150/300/PDF/JSON export assertions.
- [ ] **Step 2: Configure cross-platform `cross-env VITE_E2E=1 pnpm dev` webServer and reporters**, then run the core spec and record the initial failures before adding any missing selectors or adapter behavior.
- [ ] **Step 3: Add only stable role/aria/test-ID selectors needed by the real UI path**; X6 interactions may use located cell bounding-box centers but not fixed canvas coordinates.
- [ ] **Step 4: Re-run `pnpm playwright test e2e/editor-core.spec.ts`** until all core workflows pass with zero browser errors.

### Task 4: Accessibility, interaction, and persistence failure journeys

**Files:**
- Create: `e2e/menus-accessibility.spec.ts`
- Create: `e2e/canvas-interactions.spec.ts`
- Create: `e2e/persistence-errors.spec.ts`
- Modify: relevant `src/ui/**/*.vue` files only when a failing journey proves a missing accessible selector, focus behavior, cleanup, or narrow-layout requirement.
- Modify: relevant browser E2E adapter files only when a failing failure-path assertion proves missing behavior.

**Interfaces:**
- Consumes: shared error fixture, existing menus/dialogs/canvas controls, and assertion-only snapshots/failure controls.
- Produces: keyboard/focus/color/motion/narrow-layout coverage, X6 gesture coverage, and readable non-destructive persistence failure coverage.

- [ ] **Step 1: Write all three spec files first** covering the exact Task 9b menu/accessibility, canvas risk-ledger, and persistence/startup error scenarios.
- [ ] **Step 2: Run each new file separately** and preserve failing output before implementation adjustments.
- [ ] **Step 3: Apply the smallest UI/adapter corrections demonstrated by failures**, never replacing clicks, keys, drag, or pointer gestures with hook mutations.
- [ ] **Step 4: Re-run each focused file** and require all assertions and shared browser error gates to pass.

### Task 5: Rendered performance journey and artifact

**Files:**
- Create: `e2e/performance.spec.ts`
- Create: `scripts/write-performance-report.mjs`

**Interfaces:**
- Consumes: hook fixture injection, real X6 render, UI selection/drag/zoom/save, and Playwright attachment/output paths.
- Produces: `test-results/performance.json` containing five measured samples after warm-up plus threshold and environment metadata.

- [ ] **Step 1: Write the failing performance spec** to inject 500/800, wait for observable rendered counts, warm each operation once, measure five UI-driven runs with `performance.now`, and assert selection <300ms, zoom <600ms, drag settle <600ms, save <4000ms CI gates while recording the stricter recommended thresholds.
- [ ] **Step 2: Run the focused performance spec** and confirm failure before reporting support is complete.
- [ ] **Step 3: Implement deterministic JSON output** without arbitrary sleeps, including raw samples, maxima, limits, browser/platform metadata, node/edge counts, and zero error count.
- [ ] **Step 4: Re-run the focused spec** and validate `test-results/performance.json` content.

### Task 6: Windows/macOS CI and release documentation

**Files:**
- Create: `.github/workflows/release-gate.yml`
- Create: `docs/release.md`
- Create: `docs/acceptance.md`

**Interfaces:**
- Consumes: pnpm lockfile, Rust toolchain, Playwright config, Tauri config, and release-tag signing environment variables.
- Produces: Windows/macOS-only validation, artifact upload, conditional platform bundles/signing, release prerequisites, rollback guidance, and L1-L6 evidence status.

- [ ] **Step 1: Write a failing Vitest workflow contract test** asserting exactly `windows-latest`, `macos-13`, `macos-14`, locked installs, caches, Vitest/cargo/Chromium/Playwright/build/Tauri gates, artifacts, conditional signing, and no Linux or literal secret.
- [ ] **Step 2: Run the focused contract test** and confirm failure because the workflow is absent.
- [ ] **Step 3: Implement the workflow** with OS-specific Tauri bundle targets on tags, signing values sourced only from GitHub secrets, explicit unsigned skip messages, and uploaded Playwright/performance/executable outputs.
- [ ] **Step 4: Document prerequisites, commands, environment variable names, artifacts, rollback, and acceptance evidence**; mark macOS local execution `未覆盖`.
- [ ] **Step 5: Re-run the workflow contract test** and require it to pass.

### Task 7: Full release-gate verification, report, and commit

**Files:**
- Create: `.superpowers/sdd/reports/task-9b-report.md` (gitignored external SDD evidence)

**Interfaces:**
- Consumes: all implementation, test output, generated Playwright/performance artifacts, and Windows Tauri executable.
- Produces: exact command results/counts/paths/sizes, uncovered items, final commit, and no push.

- [ ] **Step 1: Run `pnpm test`** and record exact Vitest file/test counts and duration.
- [ ] **Step 2: Run `cargo test --manifest-path src-tauri/Cargo.toml`** with a generous timeout and record exact Rust counts.
- [ ] **Step 3: Run `pnpm playwright test`**; if Chromium is absent first run `pnpm exec playwright install chromium`, then record counts/report/performance paths.
- [ ] **Step 4: Run `pnpm build`** and record exact Vite output.
- [ ] **Step 5: Run `pnpm tauri build --no-bundle`** with a generous timeout and record the actual Windows executable path and byte size.
- [ ] **Step 6: Inspect `git status`, `git diff`, generated artifacts, workflow matrix, and secret patterns**; report macOS and any genuinely uncovered scenarios honestly.
- [ ] **Step 7: Write the exact evidence report**, stage only intended tracked files plus the force-added gitignored report, and commit once with `test: add editor e2e performance and release gates`; do not push.
