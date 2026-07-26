# 图元库折叠头部修复设计

## 目标

修复图元库头部帮助按钮视觉位置突兀，以及侧栏折叠后展开按钮被裁剪、无法恢复侧栏的问题。

## 根因

展开状态下，`.library-header` 直接包含标题、帮助和折叠按钮，并使用 `justify-content: space-between`，导致帮助按钮被分配到头部中央。折叠状态仍渲染这三个元素，但侧栏宽度缩小到 48px，右侧展开按钮被 `overflow: hidden` 裁剪。

## 行为

- 展开状态将标题和帮助按钮放入同一个左侧容器，帮助按钮紧邻“图元”标题；折叠按钮保持在右侧。
- 折叠状态隐藏标题与帮助容器，只保留展开按钮。
- 折叠状态的头部占满 48px 宽度，展开按钮在其中水平居中并保持可点击。
- 展开按钮继续使用 `chevronRight`、`aria-label="展开图元库"`、对应 tooltip 和 `aria-expanded="false"`。
- 点击展开按钮后恢复标题、帮助、搜索框、分类与 `chevronLeft` 折叠按钮。
- 不改变图元缩略图、拖拽、搜索、分类、常用区和侧栏展开宽度。

## 实现

- 在 `ElementLibrary.vue` 中新增 `.library-heading` 容器，包裹标题与 `QuickHelpButton`。
- 使用 `v-if="!collapsed"` 在折叠状态移除 `.library-heading`，避免不可见控件占据布局和焦点顺序。
- 为 `.library-heading` 设置 `display: flex`、垂直居中和紧凑间距。
- 折叠状态覆盖 `.library-header` 的水平分布与内边距，使 `.collapse-toggle` 在栏内居中。

## 验证

- 组件测试验证展开时帮助按钮位于 `.library-heading`，且折叠按钮使用 `chevronLeft`。
- 组件测试点击折叠后验证标题和帮助按钮不存在，展开按钮仍存在并使用 `chevronRight`。
- 再次点击展开按钮，验证标题、帮助、搜索框和 `chevronLeft` 恢复。
- 运行 `tests/component/ElementLibrary.test.ts`、完整 Vitest 和生产构建。
