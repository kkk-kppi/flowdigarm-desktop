# 流程图编辑器

流程图编辑器是一款面向 Windows 10/11 与 macOS（Intel、Apple Silicon）的离线桌面制图工具。它使用 Tauri 2、Vue 3、TypeScript 和 AntV X6 构建，支持多页流程图、图元与连线编辑、文本和样式、组合容器、查找替换、恢复以及 SVG/PNG/PDF/JSON 导出。编辑、保存和导出不依赖网络服务，界面与错误反馈使用简体中文。

当前产品范围是单机流程图编辑与本地文件交付。不包含 Linux 发布、云同步、多人协作、在线模板市场、自动更新、业务数据 JSON 可视化编辑器或矢量 PDF 内容输出。

## 平台与技术栈

- 支持平台：Windows 10/11 x64、macOS Intel、macOS Apple Silicon；不提供 Linux 包。
- 前端：Vue 3、TypeScript strict、Vite、Pinia、AntV X6 及选择、拖放、导出、滚动等插件。
- 桌面层：Tauri 2、Rust 1.77.2+、原生文件对话框、文件系统与安全外链能力。
- 本机元数据：rusqlite（bundled），保存首选项、最近文件、恢复快照、形状统计、窗口状态和用户模板元数据。
- 测试：Vitest、Vue Test Utils、jsdom、Cargo test 与 Playwright Chromium E2E。
- 包管理：Node.js 22、pnpm 10；依赖版本由 `pnpm-lock.yaml` 和 `src-tauri/Cargo.lock` 锁定。

## 架构与单位

依赖方向为 `ui -> application -> domain`，`infrastructure` 实现 application/domain 定义的端口。Vue 组件不直接调用 Tauri invoke、文件系统或 SQLite；平台能力通过 `src/platform/desktop-platform.ts` 注入。X6 是渲染和交互适配器，文档与撤销历史由领域模型和命令维护，不使用 X6 History 作为业务真源。

文档中的唯一逻辑长度单位是 pt。换算固定为 1in=72pt、1cm=72/2.54pt、1mm=72/25.4pt、1px=72/96pt；屏幕 100% 缩放时 1in=96 CSS px。页面单位切换只改变标尺和属性显示，不改节点、页面和拐点的内部 pt 几何，devicePixelRatio 不写入文件。

## 目录

```text
src/domain/                 文档模型、度量、校验规则
src/application/            命令、页面、排列、搜索、持久化和导出用例
src/infrastructure/         X6 映射与 SVG 语义渲染
src/platform/               浏览器测试与 Tauri 平台适配器
src/stores/                 文档、选择、应用和格式刷状态
src/ui/                     Vue 桌面界面、对话框、帮助和画布组件
src-tauri/src/commands/     文件、图片、链接和导出命令
src-tauri/src/persistence/  SQLite 与原子文件写入
src-tauri/capabilities/     Tauri 最小权限声明
tests/unit/                 领域、应用、基础设施与平台单元测试
tests/component/            Vue 组件测试
e2e/                        Playwright 关键路径、错误、性能和无障碍测试
docs/                       产品、开发、用户、发布与验收文档
```

## 开发环境

1. 安装 Node.js 22、pnpm 10 和 stable Rust；Windows 需要 MSVC Build Tools 与 WebView2，macOS 需要 Xcode Command Line Tools。
2. 在仓库根目录执行 `pnpm install --frozen-lockfile`。
3. Playwright 首次运行前执行 `pnpm exec playwright install chromium`。
4. 浏览器开发执行 `pnpm dev`；桌面开发执行 `pnpm tauri dev`。

常用命令：

| 命令 | 用途 |
|---|---|
| `pnpm dev` | 启动 Vite，默认端口 1420 |
| `pnpm build` | 执行 vue-tsc 类型检查并生成前端生产包 |
| `pnpm test` | 运行全部 Vitest 单元与组件测试 |
| `pnpm test:component` | 仅运行 `tests/component/` |
| `pnpm playwright test` | 运行 `e2e/` 下的 Chromium E2E |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | 运行 Rust 单元与集成测试 |
| `pnpm tauri build --no-bundle -- -- --locked` | 构建当前平台 release 可执行文件，不打安装包 |
| `pnpm tauri build --bundles nsis,msi` | 在 Windows 构建 NSIS/MSI |
| `pnpm tauri build --bundles app,dmg` | 在 macOS 构建 app/DMG |

## 文件与本机数据

用户图文件扩展名为 `.flowdiagram`，内容是 UTF-8 JSON，顶层结构为 `DiagramDocument`。文件保存前后均经过 schema、UUID、有限几何、页面背景引用、端口与 URL 协议校验；保存使用同目录临时文件、同步和原子替换，失败不应覆盖原文件。图片以受限 PNG/JPEG/WebP data URL 嵌入图文件，单张导入上限为 5 MiB。

SQLite 数据库不保存图文件主体，只保存本机元数据。自动恢复在脏文档最后变化约 2 秒后写快照；恢复后的文档仍为未保存状态，只有显式保存成功才删除对应版本快照。文件格式和恢复行为详见 `docs/features.md`，用户操作见 `docs/user-guide.md`。

## 测试与证据

本地发布门禁依次运行 Vitest、Cargo、Playwright、前端构建和 Tauri release no-bundle。Playwright HTML/JSON 报告位于 `playwright-report/` 与 `test-results/`，性能数据位于 `test-results/performance.json`，失败截图、视频和 trace 位于 `test-results/artifacts/`。这些目录是运行产物，不代替平台实跑结论。

逐项 L1-L6 状态、命令和证据见 `docs/acceptance.md`；发布矩阵、签名变量与回滚见 `docs/release.md`。CI 工作流存在不等于对应平台已经在本地通过，验收只引用实际执行结果。

## 安全边界

- 外链只允许 http、https、mailto；前端与 Rust 双重校验，普通点击不打开链接。
- Tauri 能力声明采用最小权限，UI 经 typed platform adapter 使用原生能力。
- 文件打开、剪贴板导入与图片导入均校验大小、结构和内容；导出先生成全部临时产物，再事务替换目标。
- 证书、私钥、密码和公证凭据不得提交。CI 只从环境 secrets 读取变量，缺失时必须明确记录未签名，而不是报告签名通过。
- 应用离线工作，不上传图文件、最近文件、恢复快照或形状使用统计。

## 已知限制

- PDF 的页面尺寸和安全链接注释按 pt 输出，但页面绘制内容当前是 72 pixels/in 的栅格内容；需要矢量内容时使用 SVG。
- 主前端 bundle 仍有 Vite 大 chunk 警告，当前不影响构建门禁。
- 领域模型保留节点 `data` 扩展字段并可文件往返，但当前 UI 没有业务数据 JSON 编辑入口。
- macOS Intel 与 Apple Silicon 的本地完整关键路径 E2E 尚未执行；工作流配置不能视为通过证据。
- Windows/macOS 的真实证书签名、Apple 公证以及签名安装包人工安装验证尚未执行。
