# Application Icon System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace temporary text and Unicode function glyphs across the desktop shell with the approved local SVG icon system while preserving behavior, accessibility, theming, and responsive layout.

**Architecture:** A typed `icon-registry.ts` statically imports approved SVG URLs, while one `AppIcon.vue` component renders them as monochrome CSS masks using `currentColor`. Existing controls retain their stores, controllers, events, test IDs, accessible labels, and tooltips. Window maximize/restore imagery follows confirmed native state through a new `WindowController.watchMaximized` subscription.

**Tech Stack:** Vue 3.5, TypeScript 5.6, Vite 6 SVG URL imports, Vitest 2, Vue Test Utils, Playwright, Tauri 2 window API.

## Global Constraints

- Use only local files under `src/ui/icons/svg/`; no runtime network icon library or CDN.
- Render SVGs through CSS Mask; do not use `v-html` or execute SVG content.
- `AppIcon` defaults to 16px, is always `aria-hidden="true"`, and inherits control color.
- Every pure-icon button has a non-empty Chinese `aria-label` and non-empty tooltip.
- Keep the current 28px title bar, 48px single-row toolbar, 32px page tabs, 24px status bar, 220px library, and 280px inspector dimensions.
- At 960px, 1024px, 1280px, and 1440px widths, toolbar controls remain visible without wrapping, clipping, or horizontal scrolling.
- Do not replace or modify shape registry thumbnails.
- `maximize.svg`, `restore.svg`, `fullscreen.svg`, and `fit_to_screen.svg` retain distinct semantics.
- Missing registered resources fail TypeScript, tests, or the Vite build; do not add visual fallback icons.
- Do not delete duplicate or currently unused user-supplied SVG files in this implementation.

---

### Task 1: Typed Icon Registry And Mask Component

**Files:**
- Create: `src/ui/icons/icon-registry.ts`
- Create: `src/ui/icons/AppIcon.vue`
- Add: `src/ui/icons/svg/*.svg` (the complete user-supplied SVG set)
- Create: `tests/unit/ui/icon-registry.test.ts`
- Create: `tests/component/AppIcon.test.ts`

**Interfaces:**
- Produces: `export const iconUrls`, `export type IconName = keyof typeof iconUrls`, and `AppIcon` props `{ name: IconName; size?: number | string }`.
- Consumes: Vite `?url` imports for local SVG files.

- [ ] **Step 1: Write the failing registry contract test**

```ts
// tests/unit/ui/icon-registry.test.ts
import { iconUrls, type IconName } from '@/ui/icons/icon-registry'

const required: IconName[] = [
  'appGraph', 'minimize', 'maximize', 'restore', 'close', 'check',
  'chevronLeft', 'chevronRight', 'chevronDown', 'chevronUp',
  'undo', 'redo', 'copy', 'cut', 'paste', 'formatPaint',
  'bold', 'italic', 'underline', 'strikethrough', 'font', 'fontSize',
  'textColor', 'fillColor', 'alignLeft', 'alignCenter', 'alignRight',
  'alignTop', 'alignMiddle', 'alignBottom', 'add', 'search', 'help',
  'delete', 'minus', 'arrowRight', 'arrowLeftRight', 'fitToScreen',
  'gridOn', 'gridOff', 'magnet',
]

describe('icon registry', () => {
  it('maps every approved shell semantic to a bundled SVG URL', () => {
    expect(Object.keys(iconUrls).sort()).toEqual([...required].sort())
    for (const name of required) {
      expect(iconUrls[name]).toMatch(/^(?:data:image\/svg\+xml|.*\.svg(?:\?|$))/)
    }
  })
})
```

- [ ] **Step 2: Run the registry test and verify RED**

Run: `pnpm test -- tests/unit/ui/icon-registry.test.ts`

Expected: FAIL because `@/ui/icons/icon-registry` does not exist.

- [ ] **Step 3: Create the explicit typed registry**

```ts
// src/ui/icons/icon-registry.ts
import add from './svg/add.svg?url'
import alignBottom from './svg/align_vertical_bottom.svg?url'
import alignMiddle from './svg/align_vertical_center.svg?url'
import alignTop from './svg/align_vertical_top.svg?url'
import appGraph from './svg/app-graph.svg?url'
import arrowLeftRight from './svg/arrow_left_right.svg?url'
import arrowRight from './svg/arrow-right.svg?url'
import check from './svg/check.svg?url'
import chevronDown from './svg/chevron_down.svg?url'
import chevronLeft from './svg/chevron_left.svg?url'
import chevronRight from './svg/chevron_right.svg?url'
import chevronUp from './svg/chevron-top.svg?url'
import close from './svg/close.svg?url'
import copy from './svg/content_copy.svg?url'
import cut from './svg/content_cut.svg?url'
import deleteIcon from './svg/delete.svg?url'
import fillColor from './svg/format_color_fill.svg?url'
import textColor from './svg/format_color_text.svg?url'
import font from './svg/format_font.svg?url'
import italic from './svg/format_italic.svg?url'
import formatPaint from './svg/format_paint.svg?url'
import fontSize from './svg/format_size.svg?url'
import strikethrough from './svg/format_strikethrough.svg?url'
import underline from './svg/format_underlined.svg?url'
import bold from './svg/format_bold.svg?url'
import alignCenter from './svg/format_align_center.svg?url'
import alignLeft from './svg/format_align_left.svg?url'
import alignRight from './svg/format_align_right.svg?url'
import fitToScreen from './svg/fit_to_screen.svg?url'
import gridOff from './svg/grid_off.svg?url'
import gridOn from './svg/grid_on.svg?url'
import help from './svg/help.svg?url'
import redo from './svg/history_redo.svg?url'
import undo from './svg/history_undo.svg?url'
import magnet from './svg/magnet.svg?url'
import maximize from './svg/maximize.svg?url'
import minimize from './svg/minimize.svg?url'
import minus from './svg/minus.svg?url'
import paste from './svg/content_paste.svg?url'
import restore from './svg/restore.svg?url'
import search from './svg/search.svg?url'

export const iconUrls = {
  add, alignBottom, alignCenter, alignLeft, alignMiddle, alignRight, alignTop,
  appGraph, arrowLeftRight, arrowRight, bold, check, chevronDown, chevronLeft,
  chevronRight, chevronUp, close, copy, cut, delete: deleteIcon, fillColor,
  fitToScreen, font, fontSize, formatPaint, gridOff, gridOn, help, italic,
  magnet, maximize, minimize, minus, paste, redo, restore, search,
  strikethrough, textColor, underline, undo,
} as const

export type IconName = keyof typeof iconUrls
```

- [ ] **Step 4: Run the registry test and verify GREEN**

Run: `pnpm test -- tests/unit/ui/icon-registry.test.ts`

Expected: PASS with one test.

- [ ] **Step 5: Write the failing `AppIcon` component test**

```ts
// tests/component/AppIcon.test.ts
import { mount } from '@vue/test-utils'
import AppIcon from '@/ui/icons/AppIcon.vue'

describe('AppIcon', () => {
  it('renders a decorative current-color mask with a stable semantic marker', () => {
    const wrapper = mount(AppIcon, { props: { name: 'undo', size: 18 } })
    const icon = wrapper.get('[data-icon="undo"]')
    expect(icon.attributes('aria-hidden')).toBe('true')
    expect(icon.attributes('style')).toContain('18px')
    expect(icon.attributes('style')).toContain('--app-icon-url')
    expect(icon.classes()).toContain('app-icon')
  })
})
```

- [ ] **Step 6: Run the component test and verify RED**

Run: `pnpm test -- tests/component/AppIcon.test.ts`

Expected: FAIL because `AppIcon.vue` does not exist.

- [ ] **Step 7: Implement the CSS Mask component**

```vue
<!-- src/ui/icons/AppIcon.vue -->
<template>
  <span
    class="app-icon"
    :data-icon="name"
    aria-hidden="true"
    :style="iconStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { iconUrls, type IconName } from './icon-registry'

const props = withDefaults(defineProps<{ name: IconName; size?: number | string }>(), {
  size: 16,
})

const iconStyle = computed(() => {
  const size = typeof props.size === 'number' ? `${props.size}px` : props.size
  return {
    width: size,
    height: size,
    '--app-icon-url': `url("${iconUrls[props.name]}")`,
  }
})
</script>

<style scoped>
.app-icon {
  display: inline-block;
  flex: 0 0 auto;
  background-color: currentColor;
  mask-image: var(--app-icon-url);
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: contain;
  -webkit-mask-image: var(--app-icon-url);
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: contain;
}

@media (forced-colors: active) {
  .app-icon {
    forced-color-adjust: none;
    background-color: CanvasText;
  }

  :global(button:disabled) .app-icon,
  :global([aria-disabled='true']) .app-icon {
    background-color: GrayText;
  }

  :global([aria-pressed='true']) .app-icon {
    background-color: Highlight;
  }
}
</style>
```

- [ ] **Step 8: Run focused tests and build**

Run: `pnpm test -- tests/unit/ui/icon-registry.test.ts tests/component/AppIcon.test.ts`

Expected: PASS with two tests.

Run: `pnpm build`

Expected: TypeScript and Vite build pass; SVG URLs are emitted as bundled assets.

- [ ] **Step 9: Commit the foundation and supplied SVG resources**

```bash
git add src/ui/icons tests/unit/ui/icon-registry.test.ts tests/component/AppIcon.test.ts
git commit -m "feat(icons): add typed SVG mask system"
```

---

### Task 2: Confirmed Window State And Title Bar Icons

**Files:**
- Modify: `src/platform/window-controller.ts`
- Modify: `src/platform/tauri-window-controller.ts`
- Modify: `src/platform/browser-e2e-platform.ts`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src/ui/shell/AppShell.vue`
- Modify: `src/ui/shell/TitleBar.vue`
- Modify: `tests/unit/platform/window-controller.test.ts`
- Modify: `tests/unit/platform/browser-e2e-platform.test.ts`
- Modify: `tests/unit/app-shell.test.ts`
- Modify: `tests/component/DesktopShellParts.test.ts`

**Interfaces:**
- Consumes: `AppIcon`, `IconName` from Task 1.
- Produces: `WindowController.watchMaximized(handler: (maximized: boolean) => void): Promise<() => void>` and `TitleBar` prop `maximized: boolean`.

- [ ] **Step 1: Extend window test doubles and write failing watcher tests**

Replace `nativeWindow()` in `tests/unit/platform/window-controller.test.ts` with:

```ts
function nativeWindow() {
  let closeHandler: ((event: { preventDefault(): void }) => void | Promise<void>) | undefined
  let resizeHandler: (() => void) | undefined
  const native: NativeWindowPort & {
    calls: string[]
    maximized: boolean
    emitClose(event: { preventDefault(): void }): Promise<void>
    emitResize(): Promise<void>
  } = {
    calls: [],
    maximized: false,
    async minimize() { this.calls.push('minimize') },
    async toggleMaximize() {
      this.calls.push('toggleMaximize')
      this.maximized = !this.maximized
      await this.emitResize()
    },
    async isMaximized() { return this.maximized },
    async onResized(handler) {
      resizeHandler = handler
      return () => { resizeHandler = undefined }
    },
    async destroy() { this.calls.push('destroy') },
    async onCloseRequested(handler) {
      closeHandler = handler
      return () => { closeHandler = undefined }
    },
    async emitClose(event) { await closeHandler?.(event) },
    async emitResize() { await resizeHandler?.() },
  }
  return native
}
```

Then add:

```ts
it('reports confirmed maximize state, ignores stale queries, and stops after disposal', async () => {
  const native = nativeWindow()
  const values: boolean[] = []
  const controller = new TauriWindowController(native, async () => true)
  const stop = await controller.watchMaximized((value) => values.push(value))
  await vi.waitFor(() => expect(values).toEqual([false]))

  native.maximized = true
  await native.emitResize()
  await vi.waitFor(() => expect(values).toEqual([false, true]))

  stop()
  native.maximized = false
  await native.emitResize()
  expect(values).toEqual([false, true])
})
```

Add the stale-result test:

```ts
it('ignores an older maximize query that resolves after a newer resize query', async () => {
  const native = nativeWindow()
  const pending: Array<(value: boolean) => void> = []
  native.isMaximized = vi.fn(() => new Promise<boolean>((resolve) => pending.push(resolve)))
  const values: boolean[] = []
  const controller = new TauriWindowController(native, async () => true)
  const stop = await controller.watchMaximized((value) => values.push(value))
  await vi.waitFor(() => expect(pending).toHaveLength(1))

  await native.emitResize()
  await vi.waitFor(() => expect(pending).toHaveLength(2))
  pending[1](true)
  await vi.waitFor(() => expect(values).toEqual([true]))
  pending[0](false)
  await Promise.resolve()
  expect(values).toEqual([true])
  stop()
})
```

- [ ] **Step 2: Run the native window tests and verify RED**

Run: `pnpm test -- tests/unit/platform/window-controller.test.ts`

Expected: FAIL because `watchMaximized`, `isMaximized`, and `onResized` do not exist.

- [ ] **Step 3: Implement the window-state contract**

```ts
// src/platform/window-controller.ts
export interface WindowController {
  minimize(): Promise<void>
  toggleMaximize(): Promise<void>
  watchMaximized(handler: (maximized: boolean) => void): Promise<() => void>
  requestClose(): Promise<void>
  onCloseRequested(): Promise<() => void>
}
```

Extend `NativeWindowPort`:

```ts
isMaximized(): Promise<boolean>
onResized(handler: () => void): Promise<() => void>
```

Add this method to `TauriWindowController`:

```ts
async watchMaximized(handler: (maximized: boolean) => void): Promise<() => void> {
  let disposed = false
  let generation = 0
  let last: boolean | undefined
  const refresh = async () => {
    const current = ++generation
    try {
      const maximized = await this.window.isMaximized()
      if (disposed || current !== generation || maximized === last) return
      last = maximized
      handler(maximized)
    } catch {
      // A resize can trigger another confirmed query; keep the last state.
    }
  }
  const unlisten = await this.window.onResized(() => { void refresh() })
  void refresh()
  return () => {
    if (disposed) return
    disposed = true
    generation += 1
    unlisten()
  }
}
```

Add `"core:window:allow-is-maximized"` to `src-tauri/capabilities/default.json`; keep existing window permissions.

- [ ] **Step 4: Implement deterministic browser window state test-first**

Add to `tests/unit/platform/browser-e2e-platform.test.ts`:

```ts
it('publishes deterministic maximize state to browser shell watchers', async () => {
  const runtime = createBrowserE2EPlatform(memoryStorage())
  const values: boolean[] = []
  const stop = await runtime.window.watchMaximized((value) => values.push(value))
  expect(values).toEqual([false])
  await runtime.window.toggleMaximize()
  expect(values).toEqual([false, true])
  stop()
  await runtime.window.toggleMaximize()
  expect(values).toEqual([false, true])
})
```

Run: `pnpm test -- tests/unit/platform/browser-e2e-platform.test.ts`

Expected: FAIL until `browser-e2e-platform.ts` keeps `maximized` and a `Set` of handlers. Implement `watchMaximized` to synchronously emit current state and return a remover; implement `toggleMaximize` to flip state and notify a snapshot of handlers.

- [ ] **Step 5: Write failing title bar state tests**

In `tests/component/DesktopShellParts.test.ts`, mount `TitleBar` with `maximized: false` and `true` and assert:

```ts
expect(normal.get('[data-testid="title-maximize"] [data-icon="maximize"]').exists()).toBe(true)
expect(normal.get('[data-testid="title-maximize"]').attributes('aria-label')).toBe('最大化窗口')
expect(maximized.get('[data-testid="title-maximize"] [data-icon="restore"]').exists()).toBe(true)
expect(maximized.get('[data-testid="title-maximize"]').attributes('aria-label')).toBe('还原窗口')
```

Run: `pnpm test -- tests/component/DesktopShellParts.test.ts`

Expected: FAIL because `TitleBar` has no `maximized` prop or `AppIcon` children.

- [ ] **Step 6: Replace title glyphs and synchronize `AppShell`**

In `TitleBar.vue`, render `appGraph`, `minimize`, `maximized ? 'restore' : 'maximize'`, and `close`. Change the maximize button bindings to:

```vue
:aria-label="maximized ? '还原窗口' : '最大化窗口'"
:title="maximized ? '还原窗口。恢复编辑器窗口大小。' : '最大化窗口。扩展编辑器到可用屏幕。'"
```

In `AppShell.vue`, add `const maximized = ref(false)`, pass `:maximized="maximized"`, and protect late async registration with this lifecycle state:

```ts
let windowStateDisposed = false
let stopWatchingMaximized: (() => void) | undefined

function watchWindowState(): void {
  if (!services) return
  void services.window.watchMaximized((value) => { maximized.value = value })
    .then((stop) => {
      if (windowStateDisposed) stop()
      else stopWatchingMaximized = stop
    })
    .catch(() => documentStore.setNotice('窗口状态同步失败，窗口控制仍可使用。'))
}
```

Call `watchWindowState()` from `onMounted`. In `onBeforeUnmount`, set `windowStateDisposed = true`, call `stopWatchingMaximized?.()`, and clear the reference. Do not flip `maximized` inside `onWindowCommand`.

- [ ] **Step 7: Update shell fakes and verify focused behavior**

Add `watchMaximized: async (handler) => { handler(false); return () => {} }` to the `fakeServices()` window object at `tests/unit/app-shell.test.ts:100-105`. Add one test that captures the handler, emits `true`, and verifies `data-icon="restore"`; add one test that unmounts and verifies the returned cleanup spy.

Run: `pnpm test -- tests/unit/platform/window-controller.test.ts tests/unit/platform/browser-e2e-platform.test.ts tests/component/DesktopShellParts.test.ts tests/unit/app-shell.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit window state and title bar**

```bash
git add src/platform/window-controller.ts src/platform/tauri-window-controller.ts src/platform/browser-e2e-platform.ts src-tauri/capabilities/default.json src/ui/shell/AppShell.vue src/ui/shell/TitleBar.vue tests/unit/platform/window-controller.test.ts tests/unit/platform/browser-e2e-platform.test.ts tests/unit/app-shell.test.ts tests/component/DesktopShellParts.test.ts
git commit -m "feat(window): sync maximize and restore icons"
```

---

### Task 3: Menus, Shared Help, And Universal Close Icons

**Files:**
- Modify: `src/ui/shell/MenuBar.vue`
- Modify: `src/ui/components/CanvasContextMenu.vue`
- Modify: `src/ui/help/QuickHelpButton.vue`
- Modify: `src/ui/dialogs/ExportDialog.vue`
- Modify: `src/ui/help/FeatureHelp.vue`
- Modify: `src/ui/search/FindReplaceTab.vue`
- Modify: `tests/component/MenuBar.test.ts`
- Modify: `tests/component/CanvasContextMenu.test.ts`
- Modify: `tests/component/ComplexFeatureHelpEntries.test.ts`
- Modify: `tests/component/ExportDialog.test.ts`
- Modify: `tests/component/FeatureHelp.test.ts`
- Modify: `tests/component/FindReplaceTab.test.ts`

**Interfaces:**
- Consumes: `AppIcon` from Task 1.
- Produces: consistent `data-icon` semantics for menu checks/arrows, help, and close controls.

- [ ] **Step 1: Replace glyph assertions with failing semantic assertions**

Add these focused expectations to the existing tests:

```ts
expect(wrapper.get('[data-command-id="view-grid"] [data-icon="check"]').exists()).toBe(true)
expect(wrapper.get('[data-command-id="tools-align"] [data-icon="chevronRight"]').exists()).toBe(true)
expect(wrapper.get('[data-help-id="shape-library"] [data-icon="help"]').exists()).toBe(true)
expect(wrapper.get('[aria-label="关闭导出"] [data-icon="close"]').exists()).toBe(true)
expect(wrapper.get('[aria-label="关闭帮助"] [data-icon="close"]').exists()).toBe(true)
expect(wrapper.get('[data-testid="find-help"] [data-icon="help"]').exists()).toBe(true)
```

Run: `pnpm test -- tests/component/MenuBar.test.ts tests/component/CanvasContextMenu.test.ts tests/component/ComplexFeatureHelpEntries.test.ts tests/component/ExportDialog.test.ts tests/component/FeatureHelp.test.ts tests/component/FindReplaceTab.test.ts`

Expected: FAIL because the controls still contain Unicode glyphs.

- [ ] **Step 2: Replace shared glyphs with `AppIcon`**

Import `AppIcon` in each listed component. Replace the menu check with `<AppIcon v-if="item.checked" name="check" :size="14" />`, every submenu arrow with `<AppIcon name="chevronRight" :size="14" />`, every help `?` with `<AppIcon name="help" :size="16" />`, and each universal `×` with `<AppIcon name="close" :size="16" />`.

Keep all existing button labels, `aria-label`, `title`, `disabled`, keyboard handlers, focus return, role attributes, and test IDs unchanged. Give icon wrapper columns the existing `.check` and `.arrow` classes so menu alignment remains stable.

- [ ] **Step 3: Verify menu, help, and dialog behavior**

Run the focused command from Step 1.

Expected: PASS with existing keyboard, focus, disabled, and event assertions unchanged.

- [ ] **Step 4: Commit shared control icons**

```bash
git add src/ui/shell/MenuBar.vue src/ui/components/CanvasContextMenu.vue src/ui/help/QuickHelpButton.vue src/ui/dialogs/ExportDialog.vue src/ui/help/FeatureHelp.vue src/ui/search/FindReplaceTab.vue tests/component/MenuBar.test.ts tests/component/CanvasContextMenu.test.ts tests/component/ComplexFeatureHelpEntries.test.ts tests/component/ExportDialog.test.ts tests/component/FeatureHelp.test.ts tests/component/FindReplaceTab.test.ts
git commit -m "feat(icons): unify menu help and close controls"
```

---

### Task 4: Compact Toolbar Icons And Minimum-Width Layout

**Files:**
- Modify: `src/ui/toolbar/CompactToolbar.vue`
- Modify: `tests/component/CompactToolbar.test.ts`

**Interfaces:**
- Consumes: `AppIcon`, `IconName` from Task 1.
- Produces: toolbar buttons with stable `data-icon` names and unchanged command behavior.

- [ ] **Step 1: Add failing icon coverage to toolbar tests**

Extend `tests/component/CompactToolbar.test.ts` with a table assertion:

```ts
const icons = {
  'tb-undo': 'undo', 'tb-redo': 'redo', 'tb-copy': 'copy', 'tb-cut': 'cut',
  'tb-paste': 'paste', 'tb-format-painter': 'formatPaint', 'tb-bold': 'bold',
  'tb-italic': 'italic', 'tb-underline': 'underline', 'tb-strikethrough': 'strikethrough',
  'tb-align-left': 'alignLeft', 'tb-align-center': 'alignCenter', 'tb-align-right': 'alignRight',
  'tb-valign-top': 'alignTop', 'tb-valign-middle': 'alignMiddle', 'tb-valign-bottom': 'alignBottom',
} as const
for (const [testId, icon] of Object.entries(icons)) {
  expect(wrapper.get(`[data-testid="${testId}"] [data-icon="${icon}"]`).exists()).toBe(true)
}
```

Also assert `tb-format-painter` uses `formatPaint` in off, once, continuous, and disabled states. For controls that cannot contain a child icon, assert the icon in their nearest wrapper:

```ts
expect(wrapper.get('[data-testid="tb-font-family"]').element.parentElement?.querySelector('[data-icon="font"]')).not.toBeNull()
expect(wrapper.get('[data-testid="tb-font-size"]').element.parentElement?.querySelector('[data-icon="fontSize"]')).not.toBeNull()
expect(wrapper.get('[data-testid="tb-text-color"]').element.parentElement?.querySelector('[data-icon="textColor"]')).not.toBeNull()
expect(wrapper.get('[data-testid="tb-text-background"]').element.parentElement?.querySelector('[data-icon="fillColor"]')).not.toBeNull()
```

- [ ] **Step 2: Run toolbar tests and verify RED**

Run: `pnpm test -- tests/component/CompactToolbar.test.ts`

Expected: FAIL because semantic icons are absent.

- [ ] **Step 3: Add typed icon names to style and alignment definitions**

```ts
import AppIcon from '@/ui/icons/AppIcon.vue'
import type { IconName } from '@/ui/icons/icon-registry'

const styleButtons: Array<{
  key: 'bold' | 'italic' | 'underline' | 'strikethrough'
  icon: IconName
  title: string
  ariaLabel: string
}> = [
  { key: 'bold', icon: 'bold', title: '加粗：切换选中文本加粗', ariaLabel: '加粗' },
  { key: 'italic', icon: 'italic', title: '斜体：切换选中文本斜体', ariaLabel: '斜体' },
  { key: 'underline', icon: 'underline', title: '下划线：切换选中文本下划线', ariaLabel: '下划线' },
  { key: 'strikethrough', icon: 'strikethrough', title: '删除线：切换选中文本删除线', ariaLabel: '删除线' },
]
```

Add `icon: IconName` to vertical and horizontal option definitions with `alignTop/Middle/Bottom` and `alignLeft/Center/Right`. Render `<AppIcon :name="button.icon" />` and `<AppIcon :name="option.icon" />`.

- [ ] **Step 4: Replace operation controls without removing essential text**

Render `undo`, `redo`, `copy`, `cut`, `paste`, and `formatPaint` before their current visible Chinese labels. Keep the labels so these core operations remain icon-plus-text. Add font, font-size, text-color, and fill-color icons as decorative prefixes adjacent to the existing controls without changing native input semantics.

Update `.toolbar-group button` to `display: inline-flex; align-items: center; justify-content: center; gap: 4px;`. Pure icon buttons retain a minimum 26px control width; operation buttons retain compact horizontal padding. Do not change `.compact-toolbar` height or allow wrapping.

- [ ] **Step 5: Verify toolbar tests and shell composition**

Run: `pnpm test -- tests/component/CompactToolbar.test.ts tests/unit/app-shell.test.ts`

Expected: PASS; existing undo, clipboard, format painter, text style, mixed state, and alignment behavior remains green.

- [ ] **Step 6: Commit toolbar conversion**

```bash
git add src/ui/toolbar/CompactToolbar.vue tests/component/CompactToolbar.test.ts
git commit -m "feat(toolbar): apply functional SVG icons"
```

---

### Task 5: Library, Tabs, And Inspector Shell Icons

**Files:**
- Modify: `src/ui/shapes/ElementLibrary.vue`
- Modify: `src/ui/pages/PageTabs.vue`
- Modify: `src/ui/inspector/RightPanel.vue`
- Modify: `tests/component/ElementLibrary.test.ts`
- Modify: `tests/component/PageTabs.test.ts`
- Modify: `tests/component/RightPanel.test.ts`

**Interfaces:**
- Consumes: `AppIcon` from Task 1.
- Produces: state-dependent shell chevrons and add/search/close icons.

- [ ] **Step 1: Write failing shell icon assertions**

Add tests for these exact mappings:

```ts
expect(library.get('.collapse-toggle [data-icon="chevronLeft"]').exists()).toBe(true)
expect(library.get('[data-icon="search"]').exists()).toBe(true)
expect(library.get('[data-testid="more-shapes"] [data-icon="add"]').exists()).toBe(true)
expect(tabs.get('[aria-label="新建页面"] [data-icon="add"]').exists()).toBe(true)
expect(tabs.get('[data-testid="close-tab"] [data-icon="close"]').exists()).toBe(true)
expect(panel.get('[data-testid="rp-collapse"] [data-icon="chevronRight"]').exists()).toBe(true)
expect(panel.get('[data-testid="rp-close"] [data-icon="close"]').exists()).toBe(true)
```

After each collapse click, assert the chevron switches direction. For category headers, assert expanded uses `chevronDown` and collapsed uses `chevronRight`.

- [ ] **Step 2: Run shell component tests and verify RED**

Run: `pnpm test -- tests/component/ElementLibrary.test.ts tests/component/PageTabs.test.ts tests/component/RightPanel.test.ts`

Expected: FAIL on missing icon markers.

- [ ] **Step 3: Implement library controls without touching thumbnails**

Import `AppIcon` into `ElementLibrary.vue`. Replace `«/»`, `▾/▸`, and the `+` prefix with state-dependent icons. Wrap the search input in a positioned container and render `search` inside it; preserve `aria-label="搜索图元"` on the input. Do not modify `.shape-thumb`, shape definitions, `thumbRadius`, or registry rendering.

- [ ] **Step 4: Implement page and right-panel controls**

Replace page add/close glyphs with `add`/`close`. Replace right-panel collapse with `appStore.rightPanelCollapsed ? 'chevronLeft' : 'chevronRight'` and panel close with `close`. Keep all existing accessible labels and click handlers.

- [ ] **Step 5: Verify shell tests and thumbnail negative coverage**

Run the focused command from Step 2.

Expected: PASS. `ElementLibrary.test.ts` must still assert registry-generated shape thumbnails and drag/create behavior, proving the icon work did not replace shape rendering.

- [ ] **Step 6: Commit shell navigation icons**

```bash
git add src/ui/shapes/ElementLibrary.vue src/ui/pages/PageTabs.vue src/ui/inspector/RightPanel.vue tests/component/ElementLibrary.test.ts tests/component/PageTabs.test.ts tests/component/RightPanel.test.ts
git commit -m "feat(icons): update shell navigation controls"
```

---

### Task 6: Property, Page Setup, And Status Controls

**Files:**
- Modify: `src/ui/inspector/PropertyTab.vue`
- Modify: `src/ui/pages/PageSetupTab.vue`
- Modify: `src/ui/shell/StatusBar.vue`
- Modify: `tests/component/PropertyTab.test.ts`
- Modify: `tests/component/PageSetupTab.test.ts`
- Modify: `tests/component/DesktopShellParts.test.ts`
- Modify: `tests/unit/app-shell.test.ts`

**Interfaces:**
- Consumes: `AppIcon`, `IconName` from Task 1.
- Produces: iconized formatting/alignment controls and `StatusBar` event `setZoom('fit')` from a dedicated button.

- [ ] **Step 1: Write failing property and page setup icon tests**

Add a mapping table in `PropertyTab.test.ts` for `btn-bold/italic/underline/strikethrough`, `align-left/center/right`, `valign-top/middle/bottom`, and assert font, size, text-color, and fill-color wrappers expose `font`, `fontSize`, `textColor`, and `fillColor`. Assert every section header contains `chevronDown` when open and `chevronRight` when closed.

Add to `PageSetupTab.test.ts`:

```ts
expect(wrapper.get('[data-testid="arrow-none"] [data-icon="minus"]').exists()).toBe(true)
expect(wrapper.get('[data-testid="arrow-single"] [data-icon="arrowRight"]').exists()).toBe(true)
expect(wrapper.get('[data-testid="arrow-double"] [data-icon="arrowLeftRight"]').exists()).toBe(true)
```

Run: `pnpm test -- tests/component/PropertyTab.test.ts tests/component/PageSetupTab.test.ts`

Expected: FAIL on missing semantic icons.

- [ ] **Step 2: Implement typed property icon definitions**

Add `icon: IconName` to PropertyTab style and alignment option arrays, matching the CompactToolbar semantic names. Replace section `▾/▸` text with `chevronDown/Right`. Add icons next to the existing font, size, text color, and background controls. Every pure icon button receives an explicit Chinese `aria-label`; preserve current `title`, `aria-pressed`, mixed-state classes, and command calls.

In `PageSetupTab.vue`, render `minus`, `arrowRight`, and `arrowLeftRight` inside the existing three buttons; retain visible labels if they fit without changing the control group height.

- [ ] **Step 3: Write the failing dedicated fit-button test**

In `DesktopShellParts.test.ts`, assert:

```ts
expect(wrapper.find('option[value="fit"]').exists()).toBe(false)
expect(wrapper.get('[data-testid="status-fit"] [data-icon="fitToScreen"]').exists()).toBe(true)
await wrapper.get('[data-testid="status-fit"]').trigger('click')
expect(wrapper.emitted('setZoom')?.at(-1)).toEqual(['fit'])
```

Also assert `status-grid` switches between `gridOn` and `gridOff`, while `status-snap` always contains `magnet` and retains `aria-pressed`.

Run: `pnpm test -- tests/component/DesktopShellParts.test.ts`

Expected: FAIL because fit is still a native option and status icons are absent.

- [ ] **Step 4: Implement status controls**

Remove `<option value="fit">适应屏幕</option>` from the native select. Add:

```vue
<button
  type="button"
  data-testid="status-fit"
  aria-label="适应屏幕"
  title="适应屏幕。缩放当前页面以适合画布。"
  @click="emit('setZoom', 'fit')"
>
  <AppIcon name="fitToScreen" :size="14" />
</button>
```

Add `AppIcon :name="appStore.showGrid ? 'gridOn' : 'gridOff'"` to grid and `AppIcon name="magnet"` to snap. Keep the visible `网格 开/关` and `对齐 开/关` text and existing store calls.

- [ ] **Step 5: Verify property, page, status, and shell routing**

Run: `pnpm test -- tests/component/PropertyTab.test.ts tests/component/PageSetupTab.test.ts tests/component/DesktopShellParts.test.ts tests/unit/app-shell.test.ts`

Expected: PASS. The app-shell fit path still calls the existing viewport fit behavior through `onSetZoom('fit')`.

- [ ] **Step 6: Commit property and status icons**

```bash
git add src/ui/inspector/PropertyTab.vue src/ui/pages/PageSetupTab.vue src/ui/shell/StatusBar.vue tests/component/PropertyTab.test.ts tests/component/PageSetupTab.test.ts tests/component/DesktopShellParts.test.ts tests/unit/app-shell.test.ts
git commit -m "feat(icons): update property and status controls"
```

---

### Task 7: Forced Colors, Accessibility, And Width Matrix E2E

**Files:**
- Modify: `e2e/menus-accessibility.spec.ts`
- Modify: `tests/unit/architecture/vue-layering.test.ts`

**Interfaces:**
- Consumes: all iconized controls from Tasks 1-6.
- Produces: browser-level evidence for icon visibility, accessible names, forced colors, resource locality, and 960-1440px layout.

- [ ] **Step 1: Add a self-proving static architecture guard**

Add this helper and test to `tests/unit/architecture/vue-layering.test.ts`:

```ts
function hasIconBoundaryViolation(source: string): boolean {
  return /<iconify-icon|(?:@\/ui\/icons|\.\/icons)\/svg\/|https?:\/\/[^'"\s]*(?:iconify|icons)/i.test(source)
}

it('loads local UI icons only through the shared registry boundary', () => {
  expect(hasIconBoundaryViolation('<iconify-icon icon="mdi:undo" />')).toBe(true)
  expect(hasIconBoundaryViolation("import undo from '@/ui/icons/svg/history_undo.svg'"))
    .toBe(true)
  expect(hasIconBoundaryViolation("import AppIcon from '@/ui/icons/AppIcon.vue'"))
    .toBe(false)

  const violations = globSync('src/ui/**/*.vue').filter((file) =>
    hasIconBoundaryViolation(readFileSync(file, 'utf8')),
  )
  expect(violations).toEqual([])
})
```

Run: `pnpm test -- tests/unit/architecture/vue-layering.test.ts`

Expected: PASS. The known-bad assertions prove the guard detects Iconify, network icons, and direct SVG imports; the repository assertion proves every production component uses the shared boundary.

- [ ] **Step 2: Add the explicit width matrix E2E test**

```ts
for (const width of [960, 1024, 1280, 1440]) {
  test(`keeps every toolbar control visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await openCleanEditor(page)
    const toolbar = page.getByTestId('compact-toolbar')
    await expect(toolbar).toHaveCSS('height', '48px')
    const layout = await toolbar.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      height: element.getBoundingClientRect().height,
      clipped: [...element.querySelectorAll('button, input, select')].filter((control) => {
        const controlBox = control.getBoundingClientRect()
        const toolbarBox = element.getBoundingClientRect()
        return controlBox.left < toolbarBox.left || controlBox.right > toolbarBox.right
      }).length,
    }))
    expect(layout).toMatchObject({ height: 48, clipped: 0 })
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth)
  })
}
```

Run: `pnpm exec playwright test e2e/menus-accessibility.spec.ts --project=chromium`

Expected before final CSS tuning: FAIL at any width where toolbar controls clip.

- [ ] **Step 3: Tune only icon-control spacing until the matrix passes**

Adjust `CompactToolbar.vue` button padding/gaps and icon sizes without changing global shell dimensions, hiding controls, removing required labels from core operations, or adding horizontal scrolling. Re-run the focused Playwright command after each one-variable CSS adjustment.

- [ ] **Step 4: Add forced-color and accessible-name evidence**

Extend the existing forced-color test to inspect every visible `[data-icon]`:

```ts
const invisibleIcons = await page.locator('[data-icon]:visible').evaluateAll((icons) => icons.flatMap((icon) => {
  const style = getComputedStyle(icon)
  const box = icon.getBoundingClientRect()
  return box.width > 0 && box.height > 0 && style.backgroundColor !== 'rgba(0, 0, 0, 0)'
    ? []
    : [icon.getAttribute('data-icon')]
}))
expect(invisibleIcons).toEqual([])
await expectIconControlsAccessible(page)
```

Add a browser maximize click assertion that the button name and `data-icon` change from `最大化窗口/maximize` to `还原窗口/restore`, then back.

- [ ] **Step 5: Run focused E2E and all component tests**

Run: `pnpm exec playwright test e2e/menus-accessibility.spec.ts --project=chromium`

Expected: all accessibility, forced-color, listener disposal, narrow layout, and width matrix tests pass.

Run: `pnpm test`

Expected: all Vitest files pass with zero failures.

- [ ] **Step 6: Commit E2E and architecture guards**

```bash
git add e2e/menus-accessibility.spec.ts tests/unit/architecture/vue-layering.test.ts
git commit -m "test(icons): cover accessibility and shell widths"
```

---

### Task 8: Final Verification And Project Records

**Files:**
- Modify: `.agents/memory/outcomes.md`
- Modify: `.agents/changelog.md`

**Interfaces:**
- Consumes: completed icon system and verification evidence.
- Produces: final project record with exact observed counts and commands.

- [ ] **Step 1: Run complete verification from a clean test process**

Run: `pnpm test`

Expected: exit 0; record the observed test-file and test counts.

Run: `pnpm build`

Expected: exit 0; only the already-known large chunk warning may remain.

Run: `pnpm exec playwright test e2e/menus-accessibility.spec.ts --project=chromium`

Expected: exit 0 with all tests in that spec passing.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 2: Inspect final scope and protect unrelated work**

Run: `git status --short`

Expected: only icon-task records remain uncommitted. Do not stage unrelated concurrent changes.

Run: `git diff --stat`

Expected: the diff matches the icon system, tests, and project records described by this plan.

- [ ] **Step 3: Record the verified outcome**

Append one `.agents/memory/outcomes.md` entry with `date`, `capability`, `result`, `artifact`, `action`, and the exact verification counts. Append one `.agents/changelog.md` line summarizing the completed icon system and commands. Do not claim E2E, build, or test success unless the corresponding command in Step 1 exited successfully.

- [ ] **Step 4: Commit project records**

```bash
git add .agents/memory/outcomes.md .agents/changelog.md
git commit -m "docs(agents): record icon system verification"
```

- [ ] **Step 5: Confirm final repository state**

Run: `git status --short`

Expected: no icon-task changes remain; any output is pre-existing or unrelated work and must be reported without modification.
