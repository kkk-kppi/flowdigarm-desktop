# Editor Layout Prototype Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the confirmed editor shell, page tabs, shape category headers, and property layout with the product prototype without changing canvas or product behavior.

**Architecture:** Keep the existing Vue components and Pinia data flow. Move `PageTabs` into a new flex-based central column beside the existing sidebars, remove its duplicate viewport binding, and make localized template/CSS changes in `ElementLibrary` and `PropertyTab`.

**Tech Stack:** Vue 3 Composition API, TypeScript strict, Pinia, Vitest, Vue Test Utils, Playwright Chromium, CSS scoped styles.

## Global Constraints

- Do not modify X6 canvas behavior, `PageFrame`, workspace background, initial fit, grid, or snap defaults.
- Do not modify the compact toolbar, title bar, or menu bar.
- Keep all existing property fields, order, commands, units, and commit behavior.
- Keep the shape library favorites, search, drag, collapse, and more-shapes behavior.
- Do not add dependencies or new design tokens.
- Do not commit unless the user explicitly requests a commit.

## File Map

- Modify `src/ui/shell/AppShell.vue`: own the three-column shell and new central column.
- Modify `src/ui/pages/PageTabs.vue`: retain page management only; remove duplicate zoom UI and viewport subscription.
- Modify `src/ui/shapes/ElementLibrary.vue`: make category headers full-width while retaining inset grids.
- Modify `src/ui/inspector/PropertyTab.vue`: replace card sections with separators and arrange geometry in two columns.
- Modify `tests/unit/app-shell.test.ts`: lock the shell component hierarchy.
- Modify `tests/component/PageTabs.test.ts`: lock removal of duplicate zoom controls while retaining page behavior.
- Modify `tests/component/ElementLibrary.test.ts`: retain category behavior and expose all category headers for visual verification.
- Modify `tests/component/PropertyTab.test.ts`: lock geometry structure and preservation of extra fields.
- Modify `e2e/editor-core.spec.ts`: verify actual Chromium bounds and computed styles.
- Update `.agents/changelog.md` and `.agents/memory/outcomes.md`: record implementation and observed validation only after checks pass.

---

### Task 1: Centralize Page Tabs And Remove Duplicate Zoom

**Files:**
- Modify: `tests/unit/app-shell.test.ts:130-158`
- Modify: `tests/component/PageTabs.test.ts:1-3, 131-148`
- Modify: `src/ui/shell/AppShell.vue:17-37, 541-550`
- Modify: `src/ui/pages/PageTabs.vue:76-89, 93-100, 179-207, 325-340`

**Interfaces:**
- Consumes: existing `PageTabs`, `CanvasArea`, `ElementLibrary`, and `RightPanel` components.
- Produces: `[data-testid="canvas-column"]`, whose direct descendants are `PageTabs` and `CanvasArea`; `PageTabs` no longer owns viewport state.

- [ ] **Step 1: Write failing shell hierarchy and page-tab responsibility tests**

Replace the shell assembly expectations with explicit hierarchy checks:

```ts
it('renders sidebars beside a central page-tabs and canvas column', () => {
  const { wrapper } = mountShell()
  const background = wrapper.get('[data-testid="shell-background"]')
  const topLevel = background.element.children

  expect(Array.from(topLevel).map((element) => element.getAttribute('data-testid'))).toEqual([
    'titlebar',
    'menubar',
    'compact-toolbar',
    'shell-main',
    'statusbar',
  ])

  const main = wrapper.get('[data-testid="shell-main"]')
  const canvasColumn = main.get('[data-testid="canvas-column"]')
  expect(main.find('[data-testid="element-library"]').exists()).toBe(true)
  expect(main.find('[data-testid="right-panel"]').exists()).toBe(true)
  expect(canvasColumn.find('[data-testid="page-tabs"]').exists()).toBe(true)
  expect(canvasColumn.find('[data-testid="canvas-area-stub"]').exists()).toBe(true)
})
```

Delete the two PageTabs zoom behavior tests and add:

```ts
it('does not render duplicate zoom controls', () => {
  const { wrapper } = mountTabs()
  expect(wrapper.find('[data-testid="zoom-slider"]').exists()).toBe(false)
  expect(wrapper.find('[data-testid="zoom-percent"]').exists()).toBe(false)
})
```

Update the test file header to describe page switching, rename, delete, and add only.

- [ ] **Step 2: Run focused tests and verify the new expectations fail**

Run:

```powershell
pnpm exec vitest run tests/unit/app-shell.test.ts tests/component/PageTabs.test.ts
```

Expected: FAIL because `PageTabs` remains a top-level shell child, `canvas-column` does not exist, and zoom controls still render.

- [ ] **Step 3: Implement the central column**

Change the relevant `AppShell.vue` template to:

```vue
<CompactToolbar />
<div class="shell-main" data-testid="shell-main">
  <ElementLibrary @create-request="onCreateRequest" @more-shapes="onMoreShapes" />
  <div class="canvas-column" data-testid="canvas-column">
    <PageTabs />
    <CanvasArea
      ref="canvasAreaRef"
      class="shell-canvas"
      :menu-controller="menuController"
      @viewport-change="onViewportChange"
    />
  </div>
  <RightPanel ref="rightPanelRef">
    <template #find>
      <FindReplaceTab
        :controller="findController"
        :current-page-id="documentStore.activePageId"
        @back="appStore.showProperties()"
        @help="appStore.openHelp($event)"
      />
    </template>
  </RightPanel>
  <!-- Keep the existing layer-wrap block here unchanged. -->
</div>
```

Add the central-column styles and move flex sizing from `.shell-canvas` to the column where appropriate:

```css
.canvas-column {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.shell-canvas {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
```

- [ ] **Step 4: Remove PageTabs viewport ownership**

Delete the `.zoom-controls` template, `onBeforeUnmount` and `watch` imports when no longer used, `zoomPercent`, `unsubscribeViewport`, the viewport watcher, `onZoomInput`, and `.zoom-controls`/`.zoom-slider`/`.zoom-percent` CSS. Keep all page CRUD code unchanged.

- [ ] **Step 5: Run focused tests and verify they pass**

Run:

```powershell
pnpm exec vitest run tests/unit/app-shell.test.ts tests/component/PageTabs.test.ts tests/component/DesktopShellParts.test.ts
```

Expected: PASS; the status-bar zoom tests remain green and page CRUD tests still pass.

- [ ] **Step 6: Review checkpoint**

Inspect `git diff -- src/ui/shell/AppShell.vue src/ui/pages/PageTabs.vue tests/unit/app-shell.test.ts tests/component/PageTabs.test.ts` and confirm no viewport, canvas, or status-bar behavior was changed.

---

### Task 2: Make Shape Category Headers Full Width

**Files:**
- Modify: `tests/component/ElementLibrary.test.ts:41-52, 130-145`
- Modify: `src/ui/shapes/ElementLibrary.vue:295-324, 362-367`

**Interfaces:**
- Consumes: existing `.library-body`, `.category-header`, `.category-grid`, and `.empty-hint` structure.
- Produces: all category headers remain `.category-header`; grids carry their own horizontal inset instead of inheriting it from `.library-body`.

- [ ] **Step 1: Extend the category regression test**

Add these assertions to the category accordion test:

```ts
const headers = wrapper.findAll('.category-header')
expect(headers).toHaveLength(3)
expect(headers.map((header) => header.classes())).toEqual([
  expect.arrayContaining(['category-header']),
  expect.arrayContaining(['category-header']),
  expect.arrayContaining(['category-header']),
])
expect(wrapper.findAll('.category-grid')).toHaveLength(3)
```

This preserves the common/basic/flow category contract while the actual full-width geometry is covered in Task 4's browser test.

- [ ] **Step 2: Run the existing component suite as the behavioral baseline**

Run:

```powershell
pnpm exec vitest run tests/component/ElementLibrary.test.ts
```

Expected before styling: PASS. This is a characterization gate, not visual evidence; Task 4 provides the red/green browser proof for width and background.

- [ ] **Step 3: Move horizontal inset from the body to category content**

Apply the minimal CSS:

```css
.library-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: #ebebeb;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 8px 8px;
}

.empty-hint {
  margin: 12px 8px;
  font-size: 12px;
  color: #999999;
  text-align: center;
}
```

Do not alter the header template, icons, events, or section state.

- [ ] **Step 4: Run the component test**

Run:

```powershell
pnpm exec vitest run tests/component/ElementLibrary.test.ts
```

Expected: PASS with all existing search, collapse, drag, and create tests unchanged.

- [ ] **Step 5: Review checkpoint**

Inspect `git diff -- src/ui/shapes/ElementLibrary.vue tests/component/ElementLibrary.test.ts` and confirm only category spacing/background styles and characterization assertions changed.

---

### Task 3: Flatten Property Sections And Grid Geometry

**Files:**
- Modify: `tests/component/PropertyTab.test.ts:173-205`
- Modify: `src/ui/inspector/PropertyTab.vue:49-67, 920-946`

**Interfaces:**
- Consumes: existing `geometryFields`, `geometryDisplay(field.key)`, and `commitGeometry(field.key, event)`.
- Produces: `[data-testid="geometry-grid"]` with four existing `.prop-row` labels in X/Y/width/height order.

- [ ] **Step 1: Write failing structure and preservation tests**

Extend the geometry test:

```ts
it('lays out all geometry fields in the geometry grid and keeps extra properties', async () => {
  const { wrapper, selection } = mountTab()
  await select(wrapper, selection, ['node-1'])

  const grid = wrapper.get('[data-testid="geometry-grid"]')
  expect(grid.findAll('.prop-row')).toHaveLength(5)
  expect(grid.find('[data-testid="geo-x"]').exists()).toBe(true)
  expect(grid.find('[data-testid="geo-y"]').exists()).toBe(true)
  expect(grid.find('[data-testid="geo-width"]').exists()).toBe(true)
  expect(grid.find('[data-testid="geo-height"]').exists()).toBe(true)
  expect(grid.find('[data-testid="geo-angle"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="node-link"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="business-data-json"]').exists()).toBe(true)
})
```

The current model includes angle in addition to the prototype's four fields. Preserve it as the fifth grid item rather than dropping functionality; CSS grid places it on the next row.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
pnpm exec vitest run tests/component/PropertyTab.test.ts
```

Expected: FAIL because `geometry-grid` does not exist.

- [ ] **Step 3: Mark the geometry body as a grid**

Change only the geometry body wrapper:

```vue
<div v-if="expanded.geometry" class="section-body geometry-grid" data-testid="geometry-grid">
  <label v-for="field in geometryFields" :key="field.key" class="prop-row">
    <span class="prop-label">{{ field.label }}{{ field.angle ? '' : `（${pageUnit}）` }}</span>
    <input
      type="number"
      step="any"
      :data-testid="`geo-${field.key}`"
      :title="field.label"
      :value="geometryDisplay(field.key)"
      @change="commitGeometry(field.key, $event)"
    />
  </label>
</div>
```

- [ ] **Step 4: Replace card styling with separators and add the two-column grid**

Use:

```css
.prop-section {
  border: 0;
  border-top: 1px solid var(--color-border);
}

.section-header {
  width: 100%;
  padding: 8px 0;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.section-body {
  padding: 0 0 10px;
}

.geometry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 12px;
  row-gap: 8px;
}

.geometry-grid .prop-row {
  min-width: 0;
  margin-top: 0;
}

.geometry-grid .prop-label {
  width: auto;
}
```

Keep the generic `.prop-row` styles for all non-geometry sections.

- [ ] **Step 5: Run property tests and verify behavior remains green**

Run:

```powershell
pnpm exec vitest run tests/component/PropertyTab.test.ts tests/component/RightPanel.test.ts
```

Expected: PASS, including geometry command/history, links, business data, style, and text tests.

- [ ] **Step 6: Review checkpoint**

Inspect `git diff -- src/ui/inspector/PropertyTab.vue tests/component/PropertyTab.test.ts` and confirm no field, event handler, command, or conditional section was removed.

---

### Task 4: Prove Layout In Chromium And Run Full Regression

**Files:**
- Modify: `e2e/editor-core.spec.ts:14-16`
- Modify after validation: `.agents/memory/outcomes.md`
- Modify after validation: `.agents/changelog.md`

**Interfaces:**
- Consumes: `openCleanEditor`, Playwright locators, and the test IDs created or retained in Tasks 1-3.
- Produces: browser-level evidence for actual bounds, category background, section borders, geometry columns, and the sole status-bar zoom entry.

- [ ] **Step 1: Add a browser layout test before implementation verification**

Insert this focused test before the existing full core flow:

```ts
test('matches the confirmed prototype shell and panel layout', async ({ page }) => {
  const library = page.getByTestId('element-library')
  const canvasColumn = page.getByTestId('canvas-column')
  const pageTabs = page.getByTestId('page-tabs')
  const rightPanel = page.getByTestId('right-panel')

  const [libraryBox, columnBox, tabsBox, panelBox] = await Promise.all([
    library.boundingBox(),
    canvasColumn.boundingBox(),
    pageTabs.boundingBox(),
    rightPanel.boundingBox(),
  ])
  expect(libraryBox).not.toBeNull()
  expect(columnBox).not.toBeNull()
  expect(tabsBox).not.toBeNull()
  expect(panelBox).not.toBeNull()
  expect(Math.abs(tabsBox!.x - columnBox!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(tabsBox!.width - columnBox!.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(libraryBox!.y - tabsBox!.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(panelBox!.y - tabsBox!.y)).toBeLessThanOrEqual(1)
  await expect(page.getByTestId('zoom-slider')).toHaveCount(0)
  await expect(page.getByTestId('status-zoom')).toBeVisible()

  const category = page.getByTestId('category-basic-header')
  const categoryBox = await category.boundingBox()
  expect(categoryBox).not.toBeNull()
  expect(Math.abs(categoryBox!.x - libraryBox!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(categoryBox!.width - libraryBox!.width)).toBeLessThanOrEqual(2)
  expect(await category.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(235, 235, 235)')

  await page.getByRole('button', { name: '矩形', exact: true }).first().dblclick()
  const state = await snapshot(page)
  await x6Cell(page, state.document.pages[0].nodes[0].id).click({ force: true })
  const section = page.getByTestId('section-geometry')
  expect(await section.evaluate((element) => getComputedStyle(element).borderRadius)).toBe('0px')

  const [xBox, yBox, widthBox, heightBox] = await Promise.all([
    page.getByTestId('geo-x').boundingBox(),
    page.getByTestId('geo-y').boundingBox(),
    page.getByTestId('geo-width').boundingBox(),
    page.getByTestId('geo-height').boundingBox(),
  ])
  expect(Math.abs(xBox!.y - yBox!.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(widthBox!.y - heightBox!.y)).toBeLessThanOrEqual(1)
  expect(widthBox!.y).toBeGreaterThan(xBox!.y)
})
```

- [ ] **Step 2: Run the focused browser test**

Run:

```powershell
pnpm exec playwright test e2e/editor-core.spec.ts --grep "matches the confirmed prototype shell"
```

Expected: PASS after Tasks 1-3. If a bound differs only by a panel border, adjust tolerance to at most 2px; do not weaken structural or two-column assertions.

- [ ] **Step 3: Run focused component and unit tests together**

Run:

```powershell
pnpm exec vitest run tests/unit/app-shell.test.ts tests/component/PageTabs.test.ts tests/component/ElementLibrary.test.ts tests/component/PropertyTab.test.ts tests/component/RightPanel.test.ts tests/component/DesktopShellParts.test.ts
```

Expected: PASS with no skipped or newly failing tests.

- [ ] **Step 4: Run full verification**

Run each command independently:

```powershell
pnpm test
pnpm build
pnpm exec playwright test
git diff --check
```

Expected: all Vitest files pass; TypeScript/Vite build exits 0; all Chromium E2E tests pass; `git diff --check` has no errors. Existing Vite chunk-size warnings are non-blocking if unchanged.

- [ ] **Step 5: Record observed outcomes**

Append one concise outcome to `.agents/memory/outcomes.md` using the existing schema, with `result=helped` only if the component, build, and Chromium checks passed. Append one changelog entry listing the four UI alignment changes and exact observed verification counts. Do not claim commands that were not run.

- [ ] **Step 6: Final scope review**

Run `git status --short` and `git diff --stat`, then inspect the complete diff. Confirm only the files in this plan plus the approved spec/plan and `.agents` records changed; do not revert unrelated concurrent work.
