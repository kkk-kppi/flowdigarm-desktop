# 交付文档与验收证据收口报告

日期：2026-07-21

分支：`feat/flowchart-editor-v1`

提交信息：`docs: 完善功能交互用户指南与验收证据`

## 状态

**未完成（存在未覆盖）**。本任务完成文档、注册表和自动一致性检查的收口，不改变平台验收事实；macOS Intel/Apple Silicon 本地完整关键路径、真实签名/公证等仍未覆盖。

## 实际审计

- 对照 `src/application/menus/menu-model.ts`、`src/application/menus/context-menu-model.ts`、`src/ui/shell/MenuBar.vue`、属性/页面/导出/查找组件和帮助注册表核对 UI 标签与入口。
- 对照领域模型、命令、持久化、导出、Rust 原子写入以及 103 个 Vitest 文件、5 个 Playwright spec 和既有阶段报告核对行为与证据。
- 确认业务数据仅有 `DiagramNode.data` 模型和文件往返，没有 JSON 编辑 UI；功能组 9 和验收表保持未覆盖。
- 确认跳线映射到 X6 `jumpover`，但没有直接视觉断言“只在不相连交叉处出现”；L4.2 保持未覆盖。
- 确认 Windows release no-bundle 已在 task-9b 通过，但本任务未启动 exe；没有虚构 PID/时长 smoke。

## 交付内容

- 将 `docs/README.md`、`docs/features.md`、`docs/interactions.md`、`docs/user-guide.md` 从骨架更新为可交付中文项目/用户文档。
- `docs/features.md` 按 11 组逐项保留入口、前置条件、成功结果、失败反馈、撤销边界、数据字段和自动化测试位置。
- 更新 `docs/需求追踪表.md` 的真实路径、测试、代表提交、冲突裁决和通过/失败/未覆盖状态。
- 将 `docs/acceptance.md` 展开为 L1.1-L6.6 逐项状态、命令、结果和证据，并固定整体状态为「未完成（存在未覆盖）」。
- 将 `docs/release.md` 完善为 Windows NSIS/MSI、macOS app/DMG、runner/target、锁文件、secrets 变量名、artifacts、回滚和发布检查单。
- QuickHelp tooltip 改为读取 `feature-help-registry.ts` 的标题与目的；清理注册表中系统剪贴板、首选项和导出的过期说明。
- 新增自动检查：四份中文文档实质内容、无交付占位；features 11x7 字段；registry 文件/标题锚点；交付文档精确源码/测试路径；帮助按钮复用 registry。

## 验证

| 命令 | 结果 |
|---|---|
| `pnpm exec vitest run tests/unit/editor/help-registry.test.ts tests/component/ComplexFeatureHelpEntries.test.ts tests/component/FeatureHelp.test.ts` | 通过：3 文件，28 测试。包含路径、标题锚点、11x7 字段和 registry 复用检查。 |
| `pnpm test` | 通过：103 文件，869 测试，0 失败。 |
| `git diff --check` | 通过：提交前最终检查无空白错误。 |

既有未重跑门禁证据来自 `.superpowers/sdd/reports/task-9b-report.md`：Cargo 44/44、Playwright 16/16、repeat 48/48、前端 build、Windows Tauri release no-bundle 均通过。本任务只改文档、帮助提示读取和一致性测试，未把既有结果伪装成本次重跑。

## 未覆盖

- macOS Intel 与 Apple Silicon 本地完整关键路径 E2E、启动和安装验证。
- Windows/macOS 使用真实证书 secrets 的签名；macOS Apple 公证。
- Windows no-bundle 可执行文件本任务启动 smoke（无 PID/观察时长）。
- 显式断网环境下的完整桌面新建/编辑/保存/打开/恢复/导出。
- 跳线只在不相连交叉边出现的直接视觉验收。
- 业务数据 JSON 可视化编辑入口。
