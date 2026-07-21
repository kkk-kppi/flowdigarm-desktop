# L1-L6 验收证据

**验收日期：** 2026-07-21

**分支：** `feat/flowchart-editor-v1`

**本次执行平台：** Windows x64
**整体状态：** **未完成（存在未覆盖）**

状态口径：只有与条目直接对应且已实际执行的证据才标「通过」；CI/workflow 配置、源代码存在或其他平台结果不能代替目标平台实跑。「未覆盖」不是通过。

## L1 可运行与平台

| 子项 | 状态 | 命令与结果 | 证据 |
|---|---|---|---|
| L1.1 Windows 10/11、macOS Intel、macOS Apple Silicon 首次启动无白屏/未捕获异常 | 未覆盖 | Windows 当前源码 no-bundle 构建通过；`powershell -ExecutionPolicy Bypass -File scripts/windows-startup-smoke.ps1` 最终验证启动 PID 33096，存活 8 秒后由 `finally` 停止，exe 为 15,497,216 bytes。该 smoke 只证明进程存活，不证明 UI 语义；两种 macOS 本地启动均未执行。 | `scripts/windows-startup-smoke.ps1`、`.superpowers/sdd/reports/task-final-gaps-report.md`、`.github/workflows/release-gate.yml`（仅配置） |
| L1.2 断网状态可新建、编辑、保存、打开、恢复、导出 | 未覆盖 | Chromium 关键路径已通过且产品无网络服务依赖，但没有在显式断网环境执行完整桌面路径。 | `e2e/editor-core.spec.ts`、`e2e/persistence-errors.spec.ts` |
| L1.3 简体中文界面及按钮、图标、快捷键、菜单、错误可见可操作 | 通过 | `pnpm playwright test`：17/17 通过；Vitest 菜单、对话框和 tooltip 测试通过。 | `e2e/menus-accessibility.spec.ts`、`tests/component/MenuBar.test.ts`、`tests/component/Tooltip.test.ts` |
| L1.4 无 console error、未捕获 rejection、残留定时器或失效监听 | 通过 | `pnpm playwright test`：17/17 通过；自动错误门禁为零、资源计数归零；`pnpm vitest run` 全套通过。 | `e2e/fixtures.ts`、`tests/unit/e2e/resource-tracker.test.ts`、`.superpowers/sdd/reports/task-final-gaps-report.md` |

## L2 文件、单位与页面

| 子项 | 状态 | 命令与结果 | 证据 |
|---|---|---|---|
| L2.1 文件/最近/自动保存/恢复闭环，保存失败不损坏原文件 | 通过 | 最近 Cargo 44/44、本次 Playwright 17/17 通过；强制失败前后字节一致。 | `tests/unit/editor/persistence`、`e2e/persistence-errors.spec.ts`、`src-tauri/src/persistence/atomic_file.rs` |
| L2.2 `.flowdiagram` 往返，非法 schema/几何/URL 可读失败且不崩溃 | 通过 | Vitest 文档校验与 Playwright 三类错误用例通过。 | `tests/unit/domain/document-schema.test.ts`、`e2e/persistence-errors.spec.ts` |
| L2.3 mm/cm/in/pt/px 切换保持内部 pt，标尺与属性即时换算 | 通过 | 度量、属性组件和浏览器 pt 不变量断言通过。 | `tests/unit/domain/measurement.test.ts`、`tests/component/PropertyTab.test.ts`、`e2e/editor-core.spec.ts` |
| L2.4 标尺、网格、参考线、分页符、缩放、平移及四种适应 | 通过 | 视口/标尺/覆盖层 Vitest 与真实画布 E2E 通过。 | `tests/unit/editor/viewport`、`tests/component/RulerOverlay.test.ts`、`tests/component/PageBreakOverlay.test.ts`、`e2e/canvas-interactions.spec.ts` |
| L2.5 页面设置一次应用一条历史，取消不改变页面 | 通过 | 页面设置组件与命令测试通过。 | `tests/component/PageSetupTab.test.ts`、`tests/unit/editor/pages/update-page.test.ts` |
| L2.6 分页符显示打印分块，关闭后文档不变 | 通过 | 分页计算和覆盖层开关测试通过。 | `tests/unit/editor/pages/page-breaks.test.ts`、`tests/component/PageBreakOverlay.test.ts` |

## L3 编辑与排版

| 子项 | 状态 | 命令与结果 | 证据 |
|---|---|---|---|
| L3.1 规定形状/文本/图片可创建、选择、变换、复制粘贴和删除 | 通过 | 形状注册、创建命令、图片、剪贴板、画布组件及关键路径 E2E 通过；“数据库”按冲突裁决对应圆柱「数据流」。 | `tests/unit/editor/shapes`、`tests/unit/editor/images/image-import.test.ts`、`tests/unit/editor/clipboard`、`e2e/editor-core.spec.ts` |
| L3.2 双击/F2/Enter 编辑，Esc 取消，失焦/Ctrl/Cmd+Enter 提交，IME 正常 | 通过 | 文本会话、覆盖编辑器和浏览器编辑路径通过。 | `tests/unit/editor/text/text-session.test.ts`、`tests/component/TextEditorOverlay.test.ts`、`e2e/editor-core.spec.ts` |
| L3.3 全套文字样式可保存、撤销、重做并导出 | 通过 | 文本命令、布局、SVG 导出和 E2E 样式路径通过。 | `tests/unit/editor/commands/text-style-command.test.ts`、`tests/unit/editor/text-layout.test.ts`、`tests/unit/editor/export/svg-export.test.ts` |
| L3.4 多选 mixed 与批量统一更新 | 通过 | 聚合、属性、工具栏和 E2E mixed 断言通过。 | `tests/unit/editor/aggregate-style.test.ts`、`tests/component/PropertyTab.test.ts`、`e2e/editor-core.spec.ts` |
| L3.5 格式刷单次/连续/Esc 与排除字段 | 通过 | 格式刷命令、store、工具栏和关键路径 E2E 通过。 | `tests/unit/editor/format-paint.test.ts`、`tests/unit/stores/format-paint-store.test.ts`、`tests/component/CompactToolbar.test.ts` |
| L3.6 节点与边样式可编辑、批量、保存和导出 | 通过 | 样式命令、属性组件、映射和 SVG 测试通过。 | `tests/unit/editor/commands/apply-style.test.ts`、`tests/component/PropertyTab.test.ts`、`tests/unit/editor/export/svg-export.test.ts` |

## L4 连接、排列与结构

| 子项 | 状态 | 命令与结果 | 证据 |
|---|---|---|---|
| L4.1 三种连接、端口、重连、标签与基础拐点 | 通过 | 最近端口、重连/拐点命令、连接器映射和真实 X6 手柄 E2E 通过。 | `tests/unit/editor/shapes/nearest-port.test.ts`、`tests/unit/editor/commands/reconnect-vertices.test.ts`、`e2e/canvas-interactions.spec.ts` |
| L4.2 跳线只在不相连边交叉处出现且不改拓扑 | 通过 | 四个不同端点构成两条交叉直角边；关闭时真实 X6 SVG 路径无曲线，开启时路径变化并出现两段 cubic 跳弧，前后 source/target/vertices 相同；截图已生成。 | `e2e/canvas-interactions.spec.ts`、`test-results/screenshots/line-jump.png`、`src/infrastructure/x6/edge-connector-map.ts` |
| L4.3 六种对齐以选择序列第一个形状为基准 | 通过 | 六模式、保序锚点和菜单入口测试通过。 | `tests/unit/editor/arrangement/align-cells.test.ts`、`tests/unit/editor/menus/menu-command-controller.test.ts` |
| L4.4 水平/垂直等距固定两端且相邻边界等距 | 通过 | 正常、顺序和间距不足测试通过。 | `tests/unit/editor/arrangement/distribute-cells.test.ts` |
| L4.5 自动连线按选择顺序，一次撤销删除全部新边 | 通过 | 端口、顺序、n-1 边及单命令撤销测试通过。 | `tests/unit/editor/arrangement/auto-connect.test.ts` |
| L4.6 组合/取消组合/加入/移出容器可撤销且不丢 ID/数据 | 通过 | 组合、成员关系、循环拒绝与真实菜单 E2E 通过。 | `tests/unit/editor/group-cells.test.ts`、`tests/unit/editor/container-membership.test.ts`、`e2e/canvas-interactions.spec.ts` |

## L5 工具、帮助与安全

| 子项 | 状态 | 命令与结果 | 证据 |
|---|---|---|---|
| L5.1 分类/搜索/Top 20/图片/右键/查找替换 | 通过 | 对应单元、组件与菜单 E2E 通过。 | `tests/component/ElementLibrary.test.ts`、`tests/unit/editor/shapes/shape-usage-repository.test.ts`、`tests/component/CanvasContextMenu.test.ts`、`e2e/menus-accessibility.spec.ts` |
| L5.2 全部替换仅节点/边标签且整批一条历史 | 通过 | 搜索范围、预览/确认和撤销测试通过。 | `tests/unit/editor/search/replace-all-text.test.ts`、`tests/component/FindReplaceTab.test.ts`、`e2e/editor-core.spec.ts` |
| L5.3 http/https/mailto 白名单、普通点击选择、Ctrl/Cmd+点击打开、前后端拒绝危险协议 | 通过 | 前端 URL 测试、Rust URL 测试和错误 E2E 通过。 | `tests/unit/editor/hyperlink-validator.test.ts`、`src-tauri/src/security/url_policy.rs`、`e2e/persistence-errors.spec.ts` |
| L5.4 中文 tooltip、复杂帮助入口、四份中文 docs 与实现一致 | 通过 | `pnpm exec vitest run tests/unit/editor/help-registry.test.ts tests/component/ComplexFeatureHelpEntries.test.ts tests/component/FeatureHelp.test.ts`：3 文件、28 测试通过；检查注册表锚点、真实路径、11x7 字段、非骨架文档和注册表复用。 | `tests/unit/editor/help-registry.test.ts`、`tests/component/ComplexFeatureHelpEntries.test.ts`、`docs/README.md`、`docs/features.md`、`docs/interactions.md`、`docs/user-guide.md` |

## L6 历史、测试、性能与导出

| 子项 | 状态 | 命令与结果 | 证据 |
|---|---|---|---|
| L6.1 列出的每次用户动作只产生一条历史 | 通过 | 命令级、store、组件和画布 E2E 均断言单条 history label/revision。 | `tests/unit/editor/commands`、`tests/unit/stores/document-store.test.ts`、`e2e/canvas-interactions.spec.ts` |
| L6.2 视图不入栈，新命令清 redo | 通过 | 命令历史与视口/应用 store 测试通过。 | `tests/unit/editor/commands/command-history.test.ts`、`tests/unit/editor/viewport/viewport-controller.test.ts`、`tests/unit/stores/app-store.test.ts` |
| L6.3 Vitest、组件、Rust、Playwright E2E 全部通过 | 通过 | 本任务 `pnpm vitest run` 为 105 文件、890 测试通过，`pnpm playwright test` 为 17/17 通过，当前源码 no-bundle 构建通过；最近 Cargo 仍为 44/44。 | `.superpowers/sdd/reports/task-final-gaps-report.md`、`.superpowers/sdd/reports/task-9b-report.md` |
| L6.4 500 节点/800 边选择、拖动、缩放、保存无冻结 | 通过 | 四次采样：选择 62.7-91.1ms，缩放 110.0-122.4ms，拖动 73.9-103.5ms，保存 239.9-346.4ms，均低于门禁。 | `e2e/performance.spec.ts`、`test-results/performance.json`、`.superpowers/sdd/reports/task-9b-report.md` |
| L6.5 SVG/PNG/PDF 导出，安全链接和 PNG DPI 不改文档 | 通过 | Vitest 导出、Rust 导出 6 项集成测试和 E2E 96/150/300 DPI/PDF URI/JSON 断言通过。 | `tests/unit/editor/export`、`src-tauri/tests/export_commands.rs`、`e2e/editor-core.spec.ts` |
| L6.6 Windows 与 macOS 分别执行完整关键路径 E2E并留报告/截图 | 未覆盖 | Windows Chromium E2E 已执行；macOS Intel 与 Apple Silicon 本地完整关键路径均未执行。CI 矩阵不能替代证据。 | `.superpowers/sdd/reports/task-9b-report.md`、`.github/workflows/release-gate.yml`（仅配置） |

## 发布附加项

| 项目 | 状态 | 说明 |
|---|---|---|
| Windows release no-bundle 与进程启动 smoke | 通过 | 当前源码 `pnpm tauri build --no-bundle -- -- --locked` 通过，exe 为 15,497,216 bytes；最终验证 PID 33096 存活 8 秒后停止。仅证明进程启动存活，不代表窗口内容或完整桌面关键路径通过。 |
| Windows NSIS/MSI 安装与签名 | 未覆盖 | 工作流已配置；未使用真实证书 secrets 构建、安装和验证。 |
| macOS app/DMG 两架构 | 未覆盖 | 仅有 runner/target 配置，没有本地构建、安装和关键路径报告。 |
| macOS 签名与公证 | 未覆盖 | 未使用真实 Apple secrets 执行签名或公证。 |
| 业务数据 JSON 编辑入口 | 通过 | 单节点可格式化编辑 JSON 对象；解析错误、非对象拒绝、应用/重置、单条历史、撤销和禁用状态均通过。未保存草稿不受样式或移动命令的不可变节点替换影响，持久业务数据或选择变化时会同步重置。证据：`tests/unit/editor/business-data-json.test.ts`、`tests/unit/editor/commands/set-business-data.test.ts`、`tests/component/PropertyTab.test.ts`。 |

## 结论

Windows 自动化、性能、导出、no-bundle 构建、进程启动 smoke、跳线视觉和业务数据 JSON 编辑有通过证据；macOS 两架构本地 E2E、真实签名/公证、Windows 安装与签名以及显式断网桌面路径仍未覆盖。故整体状态保持 **未完成（存在未覆盖）**，不得宣称产品或发布验收完成。
