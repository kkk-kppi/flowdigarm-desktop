# Element Library Collapse Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the help button next to the 图元 title while expanded and keep the expand button visible, centered, and reachable after the library collapses.

**Architecture:** Group the expanded-only heading and help controls in `.library-heading`. Remove that group from the DOM while collapsed and switch the 48px collapsed header to a centered single-control layout. Preserve the existing local icon, state, accessibility, and library behavior.

**Tech Stack:** Vue 3.5, TypeScript 5.6, Vue Test Utils, Vitest 2, Playwright Chromium.

## Global Constraints

- Modify only the ElementLibrary header layout and its focused component/browser tests.
- Keep expanded width 220px and collapsed width 48px.
- Preserve `collapse-toggle`, its `aria-label`, tooltip, `aria-expanded`, click handler, and `chevronLeft`/`chevronRight` semantics.
- Hide the title and help control from DOM and keyboard order while collapsed.
- Do not modify shape thumbnails, search behavior, categories, common shapes, drag/create behavior, or more-shapes behavior.
- Do not stage or modify the unrelated `src-tauri/Cargo.toml` working-tree change.

---

### Task 1: Repair Element Library Header Collapse Layout

**Files:**
- Modify: `src/ui/shapes/ElementLibrary.vue:3-17,283-301`
- Modify: `tests/component/ElementLibrary.test.ts:108-115`
- Modify: `e2e/menus-accessibility.spec.ts`

**Interfaces:**
- Consumes: existing `collapsed` ref, `QuickHelpButton`, `AppIcon`, and `collapse-toggle` test ID.
- Produces: expanded `.library-heading` and a centered, reachable collapsed toggle.

- [ ] **Step 1: Write the failing component regression**

Replace the existing “折叠按钮折叠整栏” test body with:

```ts
const wrapper = 挂载()
const toggle = wrapper.get('[data-testid="collapse-toggle"]')
const heading = wrapper.get('.library-heading')
expect(heading.get('.library-title').text()).toBe('图元')
expect(heading.find('[data-help-id="shape-library"]').exists()).toBe(true)
expect(toggle.find('[data-icon="chevronLeft"]').exists()).toBe(true)

await toggle.trigger('click')
expect(wrapper.find('.library-heading').exists()).toBe(false)
expect(wrapper.find('[data-help-id="shape-library"]').exists()).toBe(false)
expect(wrapper.find('input[placeholder="搜索图元..."]').exists()).toBe(false)
expect(wrapper.findAll('[data-testid="shape-cell"]')).toHaveLength(0)
expect(toggle.attributes('aria-label')).toBe('展开图元库')
expect(toggle.attributes('aria-expanded')).toBe('false')
expect(toggle.find('[data-icon="chevronRight"]').exists()).toBe(true)

await toggle.trigger('click')
expect(wrapper.get('.library-heading').text()).toContain('图元')
expect(wrapper.find('[data-help-id="shape-library"]').exists()).toBe(true)
expect(wrapper.find('input[placeholder="搜索图元..."]').exists()).toBe(true)
expect(toggle.attributes('aria-label')).toBe('折叠图元库')
expect(toggle.find('[data-icon="chevronLeft"]').exists()).toBe(true)
```

- [ ] **Step 2: Run the component test and verify RED**

Run: `pnpm test -- tests/component/ElementLibrary.test.ts`

Expected: FAIL because `.library-heading` does not exist and the title/help remain rendered while collapsed.

- [ ] **Step 3: Implement the minimal template and CSS repair**

Replace the first two expanded controls with:

```vue
<div v-if="!collapsed" class="library-heading">
  <span class="library-title">图元</span>
  <QuickHelpButton help-id="shape-library" label="形状库" />
</div>
```

Keep `collapse-toggle` as the second header child. Add:

```css
.library-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.element-library.collapsed .library-header {
  justify-content: center;
  padding-inline: 0;
}
```

Do not change the existing toggle markup, state expression, icons, or dimensions.

- [ ] **Step 4: Run the component test and verify GREEN**

Run: `pnpm test -- tests/component/ElementLibrary.test.ts`

Expected: all ElementLibrary tests pass.

- [ ] **Step 5: Add browser reachability evidence**

Add to the existing narrow-layout Playwright test after collapsing the library:

```ts
const collapsedLibrary = page.getByTestId('element-library')
const expandLibrary = page.getByRole('button', { name: '展开图元库' })
await expect(collapsedLibrary.locator('.library-heading')).toHaveCount(0)
await expect(expandLibrary).toBeVisible()
const [libraryBox, toggleBox] = await Promise.all([
  collapsedLibrary.boundingBox(),
  expandLibrary.boundingBox(),
])
expect(libraryBox).not.toBeNull()
expect(toggleBox).not.toBeNull()
expect(toggleBox!.x).toBeGreaterThanOrEqual(libraryBox!.x)
expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(libraryBox!.x + libraryBox!.width)
await expandLibrary.click()
await expect(page.getByRole('button', { name: '折叠图元库' })).toBeVisible()
await expect(collapsedLibrary.locator('.library-heading')).toContainText('图元')
```

- [ ] **Step 6: Verify focused browser and full regression**

Run: `pnpm exec playwright test e2e/menus-accessibility.spec.ts --project=chromium`

Expected: all tests in the spec pass, including the collapsed-button bounding-box assertions.

Run: `pnpm test`

Expected: all Vitest tests pass.

Run: `pnpm build`

Expected: build succeeds; only the known large-chunk warning may remain.

- [ ] **Step 7: Record and commit the fix**

Update `.agents/memory/outcomes.md` and `.agents/changelog.md` with observed counts only after Step 6 succeeds.

```bash
git add src/ui/shapes/ElementLibrary.vue tests/component/ElementLibrary.test.ts e2e/menus-accessibility.spec.ts .agents/memory/outcomes.md .agents/changelog.md
git commit -m "fix(library): keep collapse toggle reachable"
```
