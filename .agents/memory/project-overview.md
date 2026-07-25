# 项目概览

## 基本信息

- **项目名**: flowchart-editor（流程图编辑器）
- **仓库路径**: `C:\Users\lazasons\Workspace\flowdigarm-desktop`
- **版本**: 0.1.0
- **产品范围**: 面向 Windows 10/11 与 macOS（Intel、Apple Silicon）的离线桌面流程图编辑工具。

## 项目类型

Tauri v2 + Vue 3 + TypeScript 桌面应用，使用 AntV X6 作为画布渲染与交互引擎。

## 技术栈

- **前端框架**: Vue 3（Composition API）、TypeScript strict、Vite 6
- **状态管理**: Pinia 2
- **画布引擎**: AntV X6 及插件（clipboard、dnd、export、history、scroller、selection、snapline、transform）
- **桌面层**: Tauri 2（Rust 1.77.2+）
- **本地数据库**: rusqlite（bundled），用于首选项、最近文件、恢复快照、形状统计、窗口状态、用户模板元数据
- **构建/包管理**: pnpm 10、Node.js 22
- **测试**: Vitest + Vue Test Utils + jsdom（单元/组件测试）、Cargo test（Rust 测试）、Playwright Chromium（E2E）

## 主要产物

- `src/` —— 前端源码
  - `domain/` —— 文档模型、度量、校验规则
  - `application/` —— 命令、页面、排列、搜索、持久化、导出用例
  - `infrastructure/` —— X6 映射、SVG 语义渲染、剪贴板、导出、持久化实现
  - `platform/` —— 浏览器测试与 Tauri 平台适配器
  - `stores/` —— 文档、选择、应用、格式刷等 Pinia store
  - `ui/` —— Vue 桌面界面、对话框、帮助、画布组件
- `src-tauri/` —— Tauri/Rust 后端
  - `src/commands/` —— 文件、图片、链接、导出命令
  - `src/persistence/` —— SQLite 与原子文件写入
  - `src/security/` —— URL 安全策略
  - `capabilities/default.json` —— Tauri 最小权限声明
  - `tauri.conf.json` —— Tauri 应用配置
- `tests/` —— 单元测试与组件测试
- `e2e/` —— Playwright E2E 测试
- `docs/` —— 产品、开发、用户、发布、验收文档

## 入口点

- **前端入口**: `index.html` → `src/main.ts`（待验证具体文件名）
- **Rust 入口**: `src-tauri/src/main.rs`
- **库入口**: `src-tauri/src/lib.rs`
- **开发服务器**: `pnpm dev`（Vite 端口 1420）
- **桌面开发**: `pnpm tauri dev`

## 验证命令

| 命令 | 用途 |
|------|------|
| `pnpm test` | Vitest 单元与组件测试 |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | Rust 测试 |
| `pnpm exec playwright test` | E2E 测试 |
| `pnpm build` | 前端类型检查 + 生产构建 |
| `pnpm tauri build --no-bundle -- -- --locked` | 当前平台 release 可执行文件构建 |

## CodeGraph（代码图谱）

本项目使用 CodeGraph 提供语义代码智能，帮助 AI Agent 快速理解代码结构。

### 首次设置（每个开发者）

```bash
# 1. 全局安装 CLI（只需一次）
npm i -g @colbymchenry/codegraph

# 2. 连接 Agent（只需一次）
codegraph install

# 3. 初始化项目索引（每个项目）
cd flowdigarm-desktop
codegraph init
```

### 注意事项

- `.codegraph/` 目录包含本地索引数据，**不应提交到 Git**
- 索引会自动同步：编辑文件后图谱自动更新
- 每个开发者需要在自己的机器上运行 `codegraph init`
- 数据库文件（`codegraph.db`）是机器相关的，包含本地路径

### 使用方式

在 Agent 会话中使用 `codegraph_explore` 工具查询代码图谱：

```
codegraph_explore "how does edge routing work"
codegraph_explore "DiagramNode DiagramEdge"
```

## 关键约束

- 依赖方向：`ui -> application -> domain`，`infrastructure` 实现端口。
- 唯一逻辑长度单位：pt；换算固定。
- 文件格式：`.flowdiagram`，UTF-8 JSON，顶层 `DiagramDocument`，ID 为 UUIDv4。
- 外链只允许 `http`、`https`、`mailto`。
- 不上传用户图文件或元数据到网络。

## 已知缺口

- macOS Intel / Apple Silicon 本地完整关键路径 E2E 尚未执行。
- Windows/macOS 真实证书签名、Apple 公证、签名安装包人工安装验证尚未执行。
- 主前端 bundle 仍有 Vite 大 chunk 警告。

## Standing corrections

（暂无）
