# Menu Conditional Check Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the empty leading check gutter from menus with no checkable items while keeping a stable aligned gutter in menus that define checked state.

**Architecture:** Keep `MenuItem.checked` and menu construction unchanged. `MenuBar` derives whether the currently rendered top-level menu needs a check column by detecting the presence of the optional `checked` field, then conditionally renders the existing fixed-width check slot for every item in that menu.

**Tech Stack:** Vue 3, TypeScript, Vue Test Utils, Vitest, Playwright Chromium.

## Global Constraints

- Detect checkability with `item.checked !== undefined`, not truthiness.
- Keep an 18px aligned column for every top-level item when any sibling defines `checked`, including `checked: false`.
- Render no `.check` elements when the current menu has no checkable top-level items.
- Do not change menu data, shortcuts, submenu arrows, disabled state, separators, keyboard navigation, focus restoration, or command execution.
- Do not change submenu behavior.
- Do not add dependencies or design tokens.
- Do not commit unless the user explicitly requests a commit.

---

### Task 1: Conditionally Render The Menu Check Column

**Files:**
- Modify: `tests/component/MenuBar.test.ts:51-63`
- Modify: `src/ui/shell/MenuBar.vue:17-43, 78-88`
- Update after verification: `.agents/changelog.md`
- Update after verification: `.agents/memory/outcomes.md`

**Interfaces:**
- Consumes: `MenuItem.checked?: boolean` from `src/application/menus/menu-model.ts`.
- Produces: `hasCheckColumn(items: MenuItem[]): boolean`, true when at least one top-level item has `checked !== undefined`.

- [ ] **Step 1: Write the failing component test**

Replace the existing checked-state test with assertions covering both menu classes:

```ts
it('only reserves a check column for menus containing checkable items', async () => {
  const stateMenus = createMainMenus({
    canUndo: false, canRedo: false, hasSelection: false, canPaste: false,
    showRulers: false, showGrid: false, showGuides: false, showPageBreaks: false,
    selectedNodeCount: 0, eligibleNodeCount: 0, selectedGroupCount: 0,
    selectedContainerCount: 0, hasTextSelection: false,
  })
  const wrapper = mount(MenuBar, { props: { menus: stateMenus } })

  await wrapper.find('[data-menu-id="edit"]').trigger('click')
  expect(wrapper.findAll('.menu-popup .check')).toHaveLength(0)
  const undo = wrapper.find('[data-command-id="edit-undo"]')
  expect(undo.attributes('aria-disabled')).toBe('true')
  expect(undo.attributes('title')).toBe('没有可撤销的操作。')

  await wrapper.find('[data-menu-id="view"]').trigger('click')
  expect(wrapper.findAll('.menu-popup .check')).toHaveLength(stateMenus[2].items.length)
  expect(wrapper.find('[data-command-id="view-grid"] [data-icon="check"]').exists()).toBe(false)

  stateMenus[2].items.find((item) => item.id === 'view-grid')!.checked = true
  await wrapper.setProps({ menus: [...stateMenus] })
  expect(wrapper.findAll('.menu-popup .check')).toHaveLength(stateMenus[2].items.length)
  expect(wrapper.find('[data-command-id="view-grid"] [data-icon="check"]').exists()).toBe(true)
})
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```powershell
pnpm exec vitest run tests/component/MenuBar.test.ts
```

Expected: FAIL because the edit menu currently renders one empty `.check` per item.

- [ ] **Step 3: Implement the minimal conditional column**

Add the pure helper in `MenuBar.vue`:

```ts
function hasCheckColumn(items: MenuItem[]): boolean {
  return items.some((item) => item.checked !== undefined)
}
```

Conditionally render the existing slot:

```vue
<span v-if="hasCheckColumn(menu.items)" class="check" aria-hidden="true">
  <AppIcon v-if="item.checked" name="check" :size="14" />
</span>
```

Do not change `.check { width: 18px; }` or any other menu style/behavior.

- [ ] **Step 4: Run focused verification**

Run:

```powershell
pnpm exec vitest run tests/component/MenuBar.test.ts tests/unit/editor/menus/menu-model.test.ts
pnpm exec playwright test e2e/menus-accessibility.spec.ts
```

Expected: all menu component/model tests and menu Chromium tests pass.

- [ ] **Step 5: Run completion verification**

Run independently:

```powershell
pnpm test
pnpm build
git diff --check
```

Expected: complete Vitest suite and production build pass; diff check reports no whitespace errors. The existing Vite large-chunk warning is non-blocking if unchanged.

- [ ] **Step 6: Record observed results and review scope**

Append one concise changelog entry and one `result=helped` outcome only after verification, using exact observed counts. Inspect `git status --short` and the complete diff; preserve unrelated concurrent changes and do not commit.
