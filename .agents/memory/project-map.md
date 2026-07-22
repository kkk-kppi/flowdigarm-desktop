# 项目关系图

```
flowdigarm-desktop/
├── AGENTS.md                 # Agent 运行协议
├── package.json              # Node 脚本与依赖
├── vite.config.ts            # Vite 配置
├── vitest.config.ts          # 单元/组件测试配置
├── playwright.config.ts      # E2E 测试配置
├── tsconfig.json             # TypeScript 配置
├── opencode.json             # OpenCode 配置
├── index.html                # 前端入口 HTML
├── src/
│   ├── domain/               # 文档模型、度量、校验规则
│   ├── application/          # 命令、用例、控制器
│   ├── infrastructure/       # X6/SVG/剪贴板/导出/持久化适配器
│   ├── platform/             # Tauri 平台适配与浏览器测试桩
│   ├── stores/               # Pinia 状态
│   ├── ui/                   # Vue 组件
│   └── styles/               # 样式
├── src-tauri/
│   ├── src/
│   │   ├── commands/         # Tauri 命令
│   │   ├── persistence/      # SQLite + 原子文件写入
│   │   ├── security/         # URL 安全策略
│   │   ├── migrations/       # 数据库迁移
│   │   ├── lib.rs            # 库入口
│   │   └── main.rs           # 可执行入口
│   ├── capabilities/         # Tauri 权限
│   ├── tauri.conf.json       # Tauri 配置
│   └── Cargo.toml            # Rust 依赖
├── tests/
│   ├── unit/                 # 单元测试
│   └── component/            # 组件测试
├── e2e/                      # Playwright E2E
├── docs/                     # 文档
│   └── superpowers/plans/    # 历史任务计划
├── .github/workflows/        # CI 工作流
└── .agents/                  # Agent 记忆
```
