# 来源索引

## 事实源产物

| 文件 | 类型 | 说明 |
|------|------|------|
| `package.json` | 配置 | Node 依赖、脚本、pnpm 设置 |
| `src-tauri/Cargo.toml` | 配置 | Rust 依赖、crate 类型、最小 Rust 版本 |
| `src-tauri/tauri.conf.json` | 配置 | Tauri 窗口、构建、打包、CSP、图标 |
| `src-tauri/capabilities/default.json` | 配置 | Tauri 权限声明 |
| `vite.config.ts` | 配置 | Vite 插件、别名、开发服务器端口 |
| `vitest.config.ts` | 配置 | Vitest 测试配置 |
| `playwright.config.ts` | 配置 | E2E 测试配置 |
| `tsconfig.json` | 配置 | TypeScript 编译选项 |
| `opencode.json` | 配置 | OpenCode 插件与技能路径 |

## 文档

| 文件 | 说明 |
|------|------|
| `docs/README.md` | 项目总览、技术栈、目录、开发环境、命令、安全边界、已知限制 |
| `docs/acceptance.md` | L1-L6 验收状态与证据 |
| `docs/features.md` | 文件格式、恢复、保存等行为详情 |
| `docs/interactions.md` | 交互规格 |
| `docs/release.md` | 发布矩阵、签名变量、回滚 |
| `docs/user-guide.md` | 用户操作指南 |
| `docs/superpowers/plans/*.md` | 历史任务计划（business-data、final-review-blockers、 persistence、desktop-shell、file-ux、export、release-gates） |

## 工作流

| 文件 | 说明 |
|------|------|
| `.github/workflows/release-gate.yml` | CI release gate：安装依赖、测试、构建、签名/未签名打包、上传产物 |

## 模块关系（简要）

```
ui (Vue) -> application (controllers/use-cases/commands)
                |
                v
        domain (models/validation)
                ^
                |
        infrastructure (X6/SVG/clipboard/export/persistence adapters)
                |
        platform (Tauri invoke / browser test stubs)
```

- Vue 组件不直接导入命令、领域换算或平台模块；通过 `CanvasInteractionController`、`PropertyController` 等应用层入口交互。
- X6 作为渲染和交互适配器，不担任业务真源。
- Rust 后端通过 Tauri commands 暴露文件、图片、链接、导出能力。
