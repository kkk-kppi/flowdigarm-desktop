# 功能文档

> 本文档随实现更新：当前仅按需求追踪表 A 组 11 项建立章节骨架，各字段在对应功能任务落地后补全。

## 1. 文档与页面（新建/打开/保存/多页标签/页面设置）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：实现后补全（规划：`tests/unit/editor/pages/*`、`tests/component/PageSetupTab.test.ts`、Rust 持久化单测）

## 2. 画布与视图（工作区/标尺/缩放/网格/状态栏）

- 入口：应用主窗口中央画布区（`src/ui/canvas/CanvasArea.vue`，由 `src/App.vue` 经 AppShell 包裹渲染）；缩放/平移/适应入口为 Ctrl+滚轮、中键或 Space+左键拖拽（菜单与状态栏控件入口在后续任务接线）。
- 前置条件：存在已打开的文档页；页面单位 ∈ mm/cm/in/pt/px（默认 A4、mm）。
- 成功结果：X6 画布按 cell-mapper 元数据渲染页面节点与边；顶部/左侧标尺随单位、缩放、平移实时换算，主刻度约 60–120 CSS px（1/2/5×10ⁿ 自适应，连续缩放极端值可达约 150）；Ctrl+滚轮以光标为锚缩放（10%–400% 钳制）；中键/Space+左键平移；适应窗口/页面/内容/选择使目标矩形在视口居中；网格开关控制 X6 点阵网格显示；100% 缩放 = 96 CSS px/in。
- 失败反馈：视口操作为纯视图状态，无失败路径；空内容时"适应内容"不改变视口（由调用方回退到适应页面）。
- 撤销边界：缩放、平移、四种适应、标尺/网格/参考线/分页符开关均为视图操作，不进入撤销历史。
- 数据字段：视口状态 `ViewportState { zoom, panX, panY }`（pan 单位 CSS px，`src/application/viewport/viewport-transform.ts`）；视图设置 `showRulers/showGrid/showGuides/showPageBreaks/snapToGrid/theme`（`src/stores/app-store.ts`，默认值对齐详细设计 §9.4）。
- 自动化测试位置：`tests/unit/editor/viewport/viewport-transform.test.ts`、`tests/unit/editor/viewport/ruler-scale.test.ts`、`tests/unit/editor/viewport/viewport-controller.test.ts`、`tests/unit/editor/cell-mapper.test.ts`、`tests/unit/stores/app-store.test.ts`、`tests/component/RulerOverlay.test.ts`、`tests/unit/editor/help-registry.test.ts`。

## 3. 图元创建（库拖入/双击创建/文本与连接工具/图片导入）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：实现后补全（规划：`tests/unit/editor/shapes/*`、`tests/component/ElementLibrary.test.ts`）

## 4. 图元编辑（选择/拖拽/缩放/旋转/删除/复制粘贴）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：实现后补全（规划：`tests/unit/editor/commands/*`）

## 5. 剪贴板（应用内复制/剪切/粘贴）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：实现后补全（规划：`tests/unit/editor/clipboard/*`）

## 6. 文字与样式（标签输入/字体样式/对齐/格式刷）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：实现后补全（规划：`tests/unit/editor/text/*`、`tests/unit/editor/format-paint.test.ts`、`tests/component/TextEditorOverlay.test.ts`）

## 7. 形状与边样式（填充/边框/阴影/线型/箭头）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：实现后补全（规划：`tests/unit/editor/commands/apply-style.test.ts`、`tests/component/PropertyTab.test.ts`）

## 8. 排列（对齐/等距/层序/组合/容器/自动连线）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：实现后补全（规划：`tests/unit/editor/arrangement/*`、`tests/unit/editor/group-cells.test.ts`）

## 9. 属性和数据（右侧面板/几何显示/业务数据）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：实现后补全（规划：`tests/component/RightPanel.test.ts`）

## 10. 发现与帮助（查找替换/右键菜单/tooltip/帮助注册表）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：已实现首批——`tests/unit/editor/help-registry.test.ts`；其余（`tests/unit/editor/search/*`、`tests/component/CanvasContextMenu.test.ts`）实现后补全

## 11. 输出（SVG/PNG/PDF/JSON 导出）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：实现后补全（规划：`tests/unit/editor/export/*`、Rust 导出单测）
