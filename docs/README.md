# 流程图编辑器

> 本文档随实现更新：当前为 P0 工程基座阶段的骨架版本。

离线桌面流程图编辑器（类 Visio），基于 Tauri 2 + Vue 3 + TypeScript 构建，图形文档保存为 `.flowdiagram`（UTF-8 JSON），应用元数据存于本地 SQLite。全部界面与提示使用简体中文。

## 技术栈

- 前端：Vue 3（^3.5）、TypeScript（^5.6，strict）、Vite（^6）、Pinia（^2.2）、@antv/x6（^2.18）及配套插件
- 桌面：Tauri 2（Rust 1.77+，MSVC）、tauri-plugin-dialog / fs / opener、rusqlite（bundled）
- 测试：vitest + @vue/test-utils + jsdom（单元/组件）、cargo test（Rust）、Playwright（E2E）
- 包管理：pnpm 10

## 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 启动 Vite 开发服务器（端口 1420） |
| `pnpm build` | 类型检查（vue-tsc）+ 生产构建 |
| `pnpm test` / `pnpm test:watch` | 运行全部单元与组件测试 / 监听模式 |
| `pnpm test:component` | 仅运行组件测试（tests/component） |
| `pnpm e2e` | Playwright E2E（用例在后续任务补充） |
| `pnpm tauri dev` | 启动桌面应用开发模式 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Rust 侧单元测试（URL 策略、持久化等） |

## 目录结构

```
src/                    前端源码
  main.ts               应用入口（注册 Pinia、引入设计令牌）
  App.vue               根组件，渲染 AppShell
  styles/tokens.css     CSS 变量设计令牌（颜色与各栏尺寸）
  platform/             DesktopPlatform 契约、Tauri 实现、依赖注入入口
  ui/                   全部 .vue 组件（.vue 只允许出现在此目录）
    shell/              应用外壳
    help/               帮助注册表与 Tooltip
src-tauri/              Tauri Rust 侧
  src/commands/         Tauri commands（按职责分文件）
  src/security/         安全策略（URL 白名单等）
  src/migrations/       SQLite 迁移 SQL
  capabilities/         最小权限能力声明
tests/unit/             vitest 单元测试（domain/application/infrastructure）
tests/component/        Vue 组件测试（ui 组件）
e2e/                    Playwright E2E 用例
docs/                   规格与交付文档
```

依赖方向：`ui → application → domain`；`infrastructure → application/domain`。平台能力一律经 `DesktopPlatform` 接口注入，UI 不直接调用 Tauri API。
