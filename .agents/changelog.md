# Changelog

2026-07-22T10:13:00Z | opencode:init | create | AGENTS.md | 从 AgentGo v1.13.0 简中模板下载并安装到 ./AGENTS.md | 用户要求初始化项目
2026-07-22T10:18:00Z | opencode:init | bootstrap | .agents/ | 创建 .agents/ 标准目录结构与初始记忆文件 | 按 AGENTS.md 启动指令初始化
2026-07-22 | update | .agents/memory/gotchas.md | 记录 X6 绝对行距与共享文本区域计算约束
2026-07-22 | update | .agents/memory/outcomes.md | 记录系统化调试与 TDD 修复文本编辑布局缺陷的验证结果
2026-07-22 | update | text overflow behavior | 节点保持固定尺寸，X6、覆盖编辑器与 SVG 导出改为显示全部溢出文本
2026-07-22 | update | .agents/memory/gotchas.md | 记录 X6 无限高度换行的窄文本区保护约束
2026-07-22 | update | .agents/memory/outcomes.md | 记录固定节点文字可见溢出的实现与验证结果
2026-07-25 | update | `src/styles/tokens.css`, `tests/unit/root-layout.test.ts` | 清除 WebView 默认根边距并添加根布局回归测试；960 项测试及生产构建通过
2026-07-25 | update | `.agents/memory/project-overview.md` | 添加 CodeGraph 代码图谱工具的安装与初始化说明 | 每个开发者需要运行 codegraph init 生成本地索引
2026-07-25 | create | `docs/superpowers/specs/2026-07-25-application-icon-system-design.md` | 记录全应用外壳 SVG 图标系统、CSS Mask 渲染、窗口状态同步与验证设计
2026-07-25 | create | `docs/superpowers/plans/2026-07-25-application-icon-system.md` | 将批准的图标系统设计拆分为 8 个 TDD 实施与验证任务
2026-07-26 | update | application icon system and `.agents/memory/outcomes.md` | 完成类型化本地 SVG Mask 图标系统（含图层管理关闭按钮）、复合控件禁用/强制颜色传播、覆盖 Vue/TS/TSX/JS/JSX/CSS/根 HTML 的资源架构守卫及无障碍/宽度矩阵覆盖；`pnpm test` 116 个文件/977 项、`pnpm build`（1206 个模块）、Chromium E2E 9 项及 `git diff --check` 通过
2026-07-26 | create | `docs/superpowers/specs/2026-07-26-element-library-collapse-design.md` | 记录图元库帮助按钮对齐及折叠后展开按钮可达性修复设计
2026-07-26 | create | `docs/superpowers/plans/2026-07-26-element-library-collapse-fix.md` | 将图元库折叠头部修复拆分为组件 TDD、浏览器边界验证和完整回归步骤
2026-07-26 | update | Element Library collapse header and `.agents/memory/outcomes.md` | 标题与帮助按钮改为仅展开时渲染，48px 折叠头部居中保留展开按钮；组件 11 项、Chromium E2E 9 项、完整 Vitest 116 个文件/977 项及生产构建（1206 个模块）通过
2026-07-26 | update | `src/ui/shell/TitleBar.vue`, `tests/component/DesktopShellParts.test.ts`, `e2e/menus-accessibility.spec.ts` | 隔离品牌图标 scoped 样式，消除三个窗口图标 4px 左偏；组件测试、浏览器中心点断言、完整 Vitest 116 个文件/978 项、Chromium E2E 9 项及生产构建通过
2026-07-26 | update | `.agents/memory/project-overview.md`, `.agents/memory/outcomes.md` | 记录压缩恢复后必须校验目标工作树的 standing correction，以及本轮错误工作区写入的纠正结果
2026-07-26 | create | `docs/superpowers/specs/2026-07-26-editor-layout-prototype-alignment-design.md` | 记录页签层级、重复缩放控件、图元分类标题和属性面板布局的原型对齐设计
2026-07-26 | create | `docs/superpowers/plans/2026-07-26-editor-layout-prototype-alignment.md` | 将批准的编辑器布局原型对齐设计拆分为外壳页签、图元分类、属性面板和浏览器回归验证任务
2026-07-26 | update | editor layout prototype alignment, verification, and `.agents/memory/outcomes.md` | 完成页签归入画布列并移除重复缩放、图元分类全宽灰底、属性分区平直边框、几何字段两列及顺序验证，并覆盖多页窄窗口滚动和删除确认态；完整 Vitest 116 个文件/977 项、生产构建 1206 个模块、完整 Chromium 25 项及 `git diff --check` 通过
2026-07-26 | update | `src/ui/pages/PageTabs.vue`, `e2e/editor-core.spec.ts`, `.agents/memory/outcomes.md` | 修复删除确认层固定在页签栏最右侧的问题；按点击页签定位并做左右边界夹取，滚动或缩放时关闭；完整 Vitest 116 个文件/977 项、构建 1206 个模块、Chromium 26 项通过
2026-07-26 | create | `docs/superpowers/specs/2026-07-26-menu-conditional-check-column-design.md` | 记录仅在当前菜单包含可勾选项时保留统一勾选列的设计
2026-07-26 | create | `docs/superpowers/plans/2026-07-26-menu-conditional-check-column.md` | 将菜单条件勾选列设计拆分为组件 TDD、菜单 Chromium 与完整回归验证步骤
2026-07-27 | update | `src/ui/shell/MenuBar.vue`, `tests/component/MenuBar.test.ts`, `tests/component/DesktopShellParts.test.ts`, `.agents/memory/outcomes.md` | 菜单仅在含可勾选项时保留勾选列，并同步已提交标题空格行为的陈旧断言；完整 Vitest 116 个文件/977 项、Chromium 菜单 9 项、构建 1206 个模块及 `git diff --check` 通过
