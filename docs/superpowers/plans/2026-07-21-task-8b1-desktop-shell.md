# Task 8b1 Desktop Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add document text search/replace, seven desktop menus, contextual actions, title/status/layer/help UI, and integrate them with the existing editor command layer.

**Architecture:** Pure application modules own matching, replace snapshots, menu definitions, context derivation, and command dispatch. Vue components render typed models and emit/invoke controller IDs only; AppShell composes callback ports for file/window/help actions while CanvasArea exposes viewport and context hooks.

**Tech Stack:** Vue 3.5, Pinia 2, TypeScript 5.6, Vitest 2, Vue Test Utils.

## Global Constraints

- Use strict RED/GREEN TDD and record evidence in `.superpowers/sdd/reports/task-8b1-report.md`.
- Search only node `text.value` and edge `labels[].text.value`; Unicode letters, numbers, and `_` define whole-word boundaries.
- Replace-all executes as one `EditorCommand` and one undo restores every changed text.
- Menus and context menus dispatch existing stores/controllers/factories only; Vue must not call Tauri invoke or file APIs.
- All icon buttons have Chinese `aria-label` and tooltip; document listeners and timers are cleaned up.
- Finish with focused Vitest, full Vitest, build, self-review, and one requested commit.

---

### Task 1: Search And Replace Application Layer

**Files:**
- Create: `src/application/search/find-text.ts`
- Create: `src/application/search/find-controller.ts`
- Create: `src/application/commands/replace-all-text.ts`
- Test: `tests/unit/editor/search/find-text.test.ts`
- Test: `tests/unit/editor/search/replace-all-text.test.ts`
- Test: `tests/unit/editor/search/find-controller.test.ts`

**Interfaces:**
- Produce: `findText(document, request): FindMatch[]`, `createReplaceAllTextCommand(document, request, replacement)`, and `FindController` with `search`, `next`, `replaceCurrent`, `replaceAll`, and `confirmReplaceAll`.

- [ ] Write tests for stable page/node/edge-label ordering, scope, case, repeated matches, Unicode whole words, ignored fields, one-history replace-all, undo, no matches, length limits, cycling activation, and preview-before-confirm.
- [ ] Run `pnpm vitest run tests/unit/editor/search` and retain failing output as RED evidence.
- [ ] Implement immutable matching and grouped text snapshots; use `EditTextCommand` for current replacement and injected command execution for mutations.
- [ ] Run `pnpm vitest run tests/unit/editor/search` and retain passing output as GREEN evidence.

### Task 2: Typed Menus And Command Dispatch

**Files:**
- Create: `src/application/menus/menu-model.ts`
- Create: `src/application/menus/context-menu-model.ts`
- Create: `src/application/menus/menu-command-controller.ts`
- Test: `tests/unit/editor/menus/menu-model.test.ts`
- Test: `tests/unit/editor/menus/context-menu-model.test.ts`
- Test: `tests/unit/editor/menus/menu-command-controller.test.ts`

**Interfaces:**
- Produce: `MenuItem`, `MenuDefinition`, `createMainMenus(state)`, `contextMenuItems(kind, state)`, and `MenuCommandController.execute(commandId)`.
- Consume: document/selection/app store facades plus existing alignment, distribution, z-order, grouping, and auto-connect factories.

- [ ] Write exact-list tests for all seven Chinese menus and five contexts, disabled reasons, callbacks, selection order, view-history isolation, and command factory execution/failure notices.
- [ ] Run `pnpm vitest run tests/unit/editor/menus` and retain failing output as RED evidence.
- [ ] Implement declarative models and a dependency-injected dispatcher; unsupported or unavailable actions set a Chinese notice instead of silently returning.
- [ ] Run `pnpm vitest run tests/unit/editor/menus` and retain passing output as GREEN evidence.

### Task 3: Accessible Shell Components

**Files:**
- Create: `src/ui/shell/MenuBar.vue`
- Create: `src/ui/components/CanvasContextMenu.vue`
- Create: `src/ui/shell/TitleBar.vue`
- Create: `src/ui/shell/StatusBar.vue`
- Create: `src/ui/layers/LayerManager.vue`
- Create: `src/ui/help/FeatureHelp.vue`
- Modify: `src/ui/help/feature-help-registry.ts`
- Test: corresponding files under `tests/component/`

**Interfaces:**
- Components consume typed menu items and callbacks; all close paths restore focus where required.

- [ ] Write component tests for menu keyboard traversal/submenus/Escape/outside-click cleanup, context positioning/keyboard, title controls, status actions, z-order layer actions, and help registry/render/focus behavior.
- [ ] Run the new component tests and retain failing output as RED evidence.
- [ ] Implement semantic ARIA menus, viewport clamping, exact 28/24px shell bars, layer sorting, non-modal help, checked text indicators, disabled reason tooltips, and listener cleanup.
- [ ] Run the new component tests and retain passing output as GREEN evidence.

### Task 4: Find UI And Shell Integration

**Files:**
- Create: `src/ui/search/FindReplaceTab.vue`
- Modify: `src/stores/app-store.ts`
- Modify: `src/ui/inspector/RightPanel.vue`
- Modify: `src/ui/canvas/CanvasArea.vue`
- Modify: `src/ui/shell/AppShell.vue`
- Test: `tests/component/FindReplaceTab.test.ts`
- Test: `tests/component/RightPanel.test.ts`
- Test: `tests/component/CanvasContextMenu.test.ts`
- Test: `tests/unit/app-shell.test.ts`

**Interfaces:**
- App state owns panel/help mode only. AppShell constructs the menu controller and callback ports. CanvasArea exposes search activation and viewport status, and sends context IDs without implementing command behavior.

- [ ] Write failing integration tests for find mode, options, preview/confirm, Escape/return, context kind derivation, seven menus, title/status/layer/help composition, and no Vue invoke/file API.
- [ ] Run focused integration tests and retain RED evidence.
- [ ] Implement minimal wiring, focus restoration, reactive menu state, and viewport/status events with full cleanup.
- [ ] Run focused integration tests and retain GREEN evidence.

### Task 5: Documentation, Verification, And Commit

**Files:**
- Modify: `docs/features.md`
- Modify: `docs/interactions.md`
- Modify: `docs/user-guide.md`
- Create: `.superpowers/sdd/reports/task-8b1-report.md`

- [ ] Document search/replace, menus/context menus, shortcuts, layers, and help entry points.
- [ ] Run `pnpm vitest run tests/unit/editor/search tests/unit/editor/menus tests/component` and record exact totals.
- [ ] Run `pnpm vitest run` and record exact totals.
- [ ] Run `pnpm build` and record output.
- [ ] Review `git diff --check`, changed Vue files for forbidden invoke/file APIs, icon labels/tooltips, and listener/timer cleanup; record findings.
- [ ] Inspect status/diff/log, stage only Task 8b1 files, and commit `feat: add search menus context actions and desktop shell` without pushing.
