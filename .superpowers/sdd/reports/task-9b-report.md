# Task 9b Report: E2E, Performance, Build, and Release Gates

Date: 2026-07-21
Branch: `feat/flowchart-editor-v1`
Platform executed: Windows x64
Commit target: `test: 断言 X6 旧节点脱离与新节点附着`

## Result

Task 9b and its review remediation are implemented for the locally available Windows environment. Before each covered X6-rebuilding command, Chromium E2E captures the current document revision and exact cell `ElementHandle`; settling then proves a revision transition, old-handle detachment, a connected distinct replacement for the same ID, and visible nonzero geometry. Cell creation uses a separate revision-plus-attachment helper because no old cell exists. The release gate rejects retry-recovered flaky tests. Chromium E2E, real resource disposal, performance evidence, frontend production build, locked Rust tests, and a locked Tauri release no-bundle executable all pass. macOS Intel and Apple Silicon execution is **未覆盖** locally; the CI matrix is configuration only and is not represented as passing evidence.

The untracked `.playwright-mcp/` directory and `opencode.json` were not read, edited, staged, or removed. The session-generated `docs/superpowers/plans/2026-07-21-task-9b-release-gates.md` was deleted and excluded.

## Inherited Partial-Work Audit

| Area | Inherited state | Action |
|---|---|---|
| `package.json`, lockfile | `cross-env` present and compatible with Node 22 CI | Retained. |
| `playwright.config.ts` | Chromium, cross-platform E2E server, retries, trace, screenshot/video, HTML/JSON reporters present | Retained and verified by unit/full E2E gates. |
| `e2e/fixtures.ts` | Auto console/page/unhandled-rejection collection and basic hook helpers present | Retained; fixed strict X6 selector and added deterministic canvas fixture. |
| `e2e/editor-core.spec.ts` | Only a partial create/connect/edit/save/export/recovery path | Reworked to cover format paint, mixed batch formatting, find/replace undo, unit display/pt invariance, all PNG DPIs, SVG/PDF/JSON evidence, save, and recovery. |
| Missing E2E files | Accessibility, canvas, persistence/errors, and performance absent | Added all four required suites with real UI actions. |
| Browser E2E platform/hook | Basic ports, artifacts, benchmark injection, and one resource count | Retained; added reload-persistent failures, invalid-file seeding, lightweight performance probes, complete resource counts/disposal, and failure-safe persistence behavior. |
| Runtime selection | Generic selector tests present; inherited `main.ts` selected it with top-level await | Kept selector unit coverage; changed production bootstrap to direct build-time branching so production excludes E2E chunks and supports configured browser targets. |
| Benchmark fixture/tests | Deterministic 500/800 fixture and schema/command/serialization tests present | Retained; moved dense benchmark edges behind nodes and added measured browser interaction/save evidence. |
| ElementLibrary risk test | New threshold test existed but was RED | Implemented a greater-than-3-pixel DnD threshold, listener cleanup, compact collapsed width, tooltip, and real DnD/double-click E2E. |
| CI/release docs | Absent | Added Windows/macOS-only release workflow, release guide, and L1-L6 acceptance index. |

## Inherited RED/GREEN Evidence

Initial inherited targeted run:

```text
pnpm exec vitest run tests/unit/platform/browser-e2e-platform.test.ts tests/unit/platform/runtime-selector.test.ts tests/unit/e2e/e2e-hook.test.ts tests/unit/e2e/playwright-config.test.ts tests/unit/performance/benchmark-500-nodes.test.ts tests/component/ElementLibrary.test.ts
RED: 1 failed, 21 passed
Failure: ElementLibrary started DnD immediately on mousedown instead of waiting for movement >3 px.
```

After the gesture fix:

```text
pnpm exec vitest run tests/component/ElementLibrary.test.ts
GREEN: 11 passed
```

Inherited core Playwright RED sequence exposed and drove these repairs:

- X6 selector matched both a real cell and selection overlay.
- Both double-click-created nodes overlapped, preventing ordered multi-selection.
- Shift was not an accepted X6 multi-select modifier.
- Mounted Pinia side tables used unstable receiver identities, disconnecting command history.
- Production startup used unsupported top-level await and emitted browser-E2E chunks.
- Node drag committed sub-threshold motion and did not reliably finalize outside-node pointerup.

Browser-platform extension RED:

```text
pnpm exec vitest run tests/unit/platform/browser-e2e-platform.test.ts tests/unit/e2e/e2e-hook.test.ts
RED: 3 failed, 3 passed (missing seedFile/resource accounting)
GREEN after implementation: 6 passed
```

Performance RED/GREEN progression:

- Initial measurements cloned all 1,300 cells during every settle poll: selection 271-336 ms, drag 618-952 ms.
- Lightweight probes reduced selection below 150 ms; drag still rebuilt all X6 cells.
- Skipping exactly the redundant post-move full render and timing the specified pointerup-to-store boundary brought all metrics under gate.

## Final Verification

| Command | Result |
|---|---|
| `pnpm test` | PASS: 102 files, 864 tests. |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | PASS: 44 tests (34 library + 6 export integration + 4 image integration), 0 failures. |
| `pnpm exec vitest run tests/unit/e2e/playwright-config.test.ts tests/unit/e2e/e2e-hook.test.ts` | PASS: 2 files, 4 tests. The config assertion was first observed RED with 1 failed / 2 passed before `failOnFlakyTests` was enabled. |
| `pnpm playwright test e2e/editor-core.spec.ts e2e/canvas-interactions.spec.ts --retries=0` | PASS: 5 Chromium tests, 0 failures while developing the old-handle/new-handle settle proof. |
| `pnpm playwright test --repeat-each=3 --retries=0` | PASS: 48 Chromium executions (16 tests x 3), 0 failures, 0 retries, and no retry-masked results. |
| `pnpm playwright test` | PASS: 16 Chromium tests, 0 failures and 0 flaky results; console/page/unhandled-rejection handlers close the page immediately and retain teardown assertions. |
| `pnpm build` | PASS: typecheck and Vite production build, 1,149 modules; largest application chunk `867.68 kB` minified (`258.65 kB` gzip); no `resource-tracker`, `browser-e2e-platform`, `disposeApplication`, or `__FLOW_E2E__` in emitted JavaScript. |
| `pnpm tauri build --no-bundle -- -- --locked` | PASS: release executable built; the first separator is consumed by pnpm and the second reaches Tauri so Cargo receives `--locked`. |

Chromium was already installed; no browser installation was needed.

## Performance Evidence

Artifact: `test-results/performance.json`

Fixture: 500 nodes, 800 edges, Chinese labels; one warm-up and four recorded runs.

| Metric | Samples (ms) | Gate | Result |
|---|---|---|---|
| Selection | 91.1, 73.8, 62.7, 83.2 | `<150` | PASS |
| Zoom | 114.7, 116.9, 110.0, 122.4 | `<300` | PASS |
| Drag pointerup to settled store | 103.5, 74.2, 73.9, 96.5 | `<300` | PASS |
| Serialize/save UI path | 239.9, 290.9, 346.4, 306.2 | `<2000` | PASS |

CI applies a 2x multiplier and still rejects freezes/timeouts.

## Artifacts

- HTML report: `playwright-report/index.html`
- JSON result report: `test-results/results.json`
- Performance JSON: `test-results/performance.json`
- Per-test attachments/failure screenshot-video-trace location: `test-results/artifacts/`
- Windows release executable: `src-tauri/target/release/flowchart-editor.exe`
- Windows executable size: `15,496,704` bytes (`14.78 MiB`)

## CI And Release

`.github/workflows/release-gate.yml` contains only:

- `windows-latest` / `x86_64-pc-windows-msvc`
- `macos-15-intel` / `x86_64-apple-darwin`
- `macos-15` / `aarch64-apple-darwin`

Each runner installs locked dependencies and Chromium, runs Vitest/Cargo `--locked`/Playwright/build/Tauri no-bundle with Cargo `--locked`, caches Node/pnpm/Rust data, and uploads browser evidence plus the native executable. Tag runs pass Cargo `--locked` through Tauri while building NSIS/MSI or app/DMG bundles. Signing and notarization secrets are environment-only; absent secret sets produce an explicit unsigned-build summary rather than a false signing pass.

## Review Remediation Evidence

- E2E-only tracking wraps real application timer handles and EventTarget callback pairs before mount, tracks actual persistence/settings controller disposal, unmounts Vue, and reports zero remaining listeners, timers, and controllers after menu/dialog/help interaction.
- Canvas coverage dispatches `mouseup` directly on `window` after an outside-node drag and verifies one `移动图元` history entry; it also drags the real X6 vertex circle and verifies changed vertices plus one `编辑拐点` entry.
- Accessibility coverage scans all visible icon-like buttons across the shell, preferences, export, and help overlays for Chinese `aria-label` and title tooltips; rendered forced-color outlines/system tokens and near-zero motion are asserted.
- Persistence coverage reads saved/exported bytes before and after forced failures, and schema/geometry/URL rejection run as separate exact-message cases without replacing the current document.
- Fresh browser artifacts were regenerated at `playwright-report/index.html`, `test-results/results.json`, `test-results/performance.json`, and `test-results/artifacts/`.
- Playwright uses one worker locally and in CI so performance thresholds are measured without contention from unrelated browser suites.
- `captureX6CellBeforeRebuild` retains the exact pre-command `ElementHandle` and revision. `waitForRebuiltX6Cell` polls the revision transition (including undo transitions to an earlier revision), old `isConnected === false`, connected same-ID replacement, page-realm identity inequality, and visible nonzero geometry before returning the replacement handle. `waitForCreatedX6Cell` separately proves revision advancement and attachment when no old cell exists; no independent store/DOM-existence coincidence or fixed timeout sleep is used.
- `failOnFlakyTests: true` makes CI/release fail if the retained diagnostic retry recovers a failed first attempt.

Release prerequisites, artifact handling, signing variables, and rollback are documented in `docs/release.md`. L1-L6 evidence and uncovered status are documented in `docs/acceptance.md`.

## Acceptance Status

| Level | Status |
|---|---|
| L1 | Windows automated scope passes; macOS Intel/Apple Silicon 未覆盖. |
| L2 | Windows browser E2E and unit scope passes. |
| L3 | Windows browser E2E and component/unit scope passes. |
| L4 | Automated connect/reconnect/vertex/connector/group scope passes; broad manual visual acceptance remains outside this task run. |
| L5 | Automated menu/help/accessibility/error/security scope passes. |
| L6 | Local Windows tests/performance/export/build pass; macOS release E2E 未覆盖. |

## Residual Concerns

- macOS Intel and Apple Silicon builds, E2E, signing, and notarization were not executable on this Windows host and remain **未覆盖** until CI or physical-machine evidence exists.
- The production build reports one `867.68 kB` minified application chunk warning; it does not fail the release gate but is a future code-splitting opportunity.
- CI certificate import, signing, and notarization branches are configured but cannot be validated without repository secrets and tag-runner execution.
