# Visible Text Overflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep node geometry fixed while rendering every text line beyond the node height when necessary.

**Architecture:** Prewrap horizontal text through one progress-guaranteed measured-width function shared by X6 and SVG export, and do not use X6 `textWrap`. Keep nominal line advance in SVG export and let the mirror-sized overlay content overflow its fixed anchor rectangle. No schema or command changes.

**Tech Stack:** Vue 3, TypeScript, AntV X6 2.19.2, Vitest, Playwright Chromium.

## Global Constraints

- Node geometry and command history must not change because of text overflow.
- Top grows down, bottom grows up, and middle grows around the text-area center.
- Existing horizontal wrapping width, vertical text, rotation, margins, and paragraph spacing remain supported.
- Do not commit, merge, push, or modify unrelated worktree changes.

---

### Task 1: Live X6 Overflow

**Files:**
- Modify: `src/infrastructure/x6/text-layout.ts`
- Modify: `src/infrastructure/x6/cell-mapper.ts`
- Test: `tests/unit/editor/text-layout.test.ts`
- Test: `tests/unit/editor/cell-mapper-text.test.ts`

**Interfaces:**
- Consumes: `layoutText({ content, areaPt })` and `CellMetadata.style`.
- Produces: width-constrained prewrapped label lines with no X6 height truncation.

- [ ] Add failing assertions that a five-line horizontal label keeps nominal `fontSize * lineHeight` and maps all source lines without a finite area-height limit.
- [ ] Run `pnpm exec vitest run tests/unit/editor/text-layout.test.ts tests/unit/editor/cell-mapper-text.test.ts`; expect the new finite-height assertion to fail.
- [ ] Replace X6 wrapping with shared prewrapped lines that always consume at least one grapheme.
- [ ] Re-run the focused tests; expect all to pass.

### Task 2: Overlay And SVG Overflow

**Files:**
- Modify: `src/ui/text/TextEditorOverlay.vue`
- Modify: `src/infrastructure/export/svg-export.ts`
- Test: `tests/component/TextEditorOverlay.test.ts`
- Test: `tests/unit/editor/export/svg-export.test.ts`

**Interfaces:**
- Consumes: mirror content height, fixed `areaPt`, `TextContent.paragraph.lineHeight`.
- Produces: unclipped editable content and nominal exported baselines outside a short node.

- [ ] Add a component test asserting the overlay/content styles do not cap or hide mirror height.
- [ ] Add SVG tests for five lines in a short node: middle baselines straddle the area center at nominal spacing; top and bottom preserve nominal spacing without compression.
- [ ] Run `pnpm exec vitest run tests/component/TextEditorOverlay.test.ts tests/unit/editor/export/svg-export.test.ts`; expect the new style and baseline assertions to fail.
- [ ] Remove overlay/content height clipping while keeping the outer anchor geometry and border fixed.
- [ ] Remove SVG line-advance clamping and calculate first baseline from the natural text-block height.
- [ ] Re-run the focused tests; expect all to pass.

### Task 3: Browser Verification And Documentation

**Files:**
- Modify: `e2e/canvas-interactions.spec.ts`
- Modify: `docs/详细设计.md`
- Modify: `.agents/memory/gotchas.md`
- Modify: `.agents/changelog.md`

**Interfaces:**
- Consumes: real X6 `<tspan>` geometry after committing five lines.
- Produces: regression evidence and updated product semantics.

- [ ] Extend the multiline Chromium case to five lines in a short node and assert all five `<tspan>` elements exist at nominal spacing with first/last rows outside the node text area.
- [ ] Run the focused Playwright test and confirm it passes after Tasks 1-2.
- [ ] Replace the detailed-design clipping rule with fixed-node visible overflow semantics and record why node labels bypass X6 `textWrap`.
- [ ] Run `pnpm test`, `pnpm build`, `pnpm exec playwright test e2e/canvas-interactions.spec.ts`, and `git diff --check`; require zero failures, allowing only the existing Vite chunk warning and line-ending notices.
