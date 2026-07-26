# 结果账本

## 2026-07-22 | AGENTS.md 初始化

- **date**: 2026-07-22
- **capability**: （初始化，尚无 workflow/skill）
- **result**: no_effect
- **artifact**: `.agents/` 目录结构与 `AGENTS.md`
- **action**: 下载 AgentGo v1.13.0 简中模板，写入 `./AGENTS.md`，创建 `.agents/` 标准目录与初始记忆文件。
- **validation**: 文件已写入，目录已创建；内容基于当前产物扫描，未改项目源码。
- **next action**: 后续任务按 AGENTS.md 启动指令执行；优先运行验证命令补全测试证据。

## 2026-07-22 | 文本编辑布局缺陷修复

- **date**: 2026-07-22
- **capability**: systematic-debugging + test-driven-development
- **result**: helped
- **artifact**: `TextEditorOverlay.vue`、X6 文本布局及相关测试
- **action**: 通过截图与 X6 2.19.2 实现反查确认重复标签、垂直对齐和绝对行距根因；以失败测试先锁定行为后实施。
- **validation**: `pnpm test` 949 项通过；`pnpm build` 通过；`e2e/canvas-interactions.spec.ts` Chromium 6 项通过。

## 2026-07-22 | 节点文字可见溢出

- **date**: 2026-07-22
- **capability**: brainstorming + test-driven-development + code-review
- **result**: helped
- **artifact**: X6 节点标签、覆盖编辑器、SVG 导出与画布 E2E
- **action**: 将裁剪策略改为固定节点尺寸下的可见溢出；以共享测量分行替代 X6 `textWrap`，同步 X6 基线语义并处理极窄文本区、emoji 和长行性能风险。
- **validation**: `pnpm test` 959 项通过；`pnpm build` 通过；`e2e/canvas-interactions.spec.ts` Chromium 7 项通过；`git diff --check` 无错误。

## 2026-07-25 | WebView 根边距修复

- **date**: 2026-07-25
- **capability**: systematic-debugging + test-driven-development
- **result**: helped
- **artifact**: `src/styles/tokens.css`、`tests/unit/root-layout.test.ts`
- **action**: 重置 `html`、`body` 与 `#app` 挂载链，清除 WebView 默认 `body` 外边距并禁止页面级滚动。
- **validation**: 聚焦测试通过；`pnpm test` 960 项通过；`pnpm build` 通过。

## 2026-07-26 | 应用图标系统

- **date**: 2026-07-26
- **capability**: test-driven-development + verification-before-completion
- **result**: helped
- **artifact**: `src/ui/icons/` 本地 SVG 注册表与 Mask 组件、桌面外壳控件、窗口状态适配、组件/架构测试及 `e2e/menus-accessibility.spec.ts`
- **action**: 以类型化本地 SVG 注册表和共享 CSS Mask 组件替换桌面外壳临时字符图标（含图层管理关闭按钮）；同步原生确认的最大化/还原状态；最终审阅补齐复合控件 `aria-disabled` 图标传播、强制颜色下的本地 SVG Mask/GrayText/Highlight 浏览器证据，以及覆盖 Vue/TS/TSX/JS/JSX、生产 CSS 和根 `index.html` 的 SVG 资源边界。
- **validation**: `pnpm test` 通过 116 个测试文件、977 项测试；`pnpm build` 退出 0、转换 1206 个模块（仅保留已知的大 chunk 警告）；`pnpm exec playwright test e2e/menus-accessibility.spec.ts --project=chromium` 通过 9 项测试；`git diff --check` 退出 0、无空白错误（仅提示 5 个代码/测试/记录文件后续 Git 操作时将 LF 转为 CRLF）。
