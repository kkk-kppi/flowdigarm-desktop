# 坑点

## 开发环境

- Vite 开发服务器固定端口 `1420`（`strictPort: true`），被 Tauri `tauri.conf.json` 和 Playwright `playwright.config.ts` 共同依赖；更换端口需同步修改多处配置。
- Playwright E2E 使用 `cross-env VITE_E2E=1 pnpm dev --host 127.0.0.1` 启动 webServer；`reuseExistingServer: !process.env.CI` 在本地会复用已有服务器。

## 构建与发布

- Tauri release no-bundle 命令格式：`pnpm tauri build --no-bundle -- -- --locked`（注意多个 `--` 分隔符）。
- CI 中签名凭据缺失时会构建未签名包，并在 `GITHUB_STEP_SUMMARY` 中记录；不会导致构建失败。

## 安全

- 外链打开由 Rust `open_external_link` 统一处理，前端不直接持有 opener URL 权限。
- 文件保存使用同目录临时文件 + 原子替换；保存前校验失败时不写文件、不删除恢复快照、不标记已保存。

## 测试

- Vitest 配置 `globals: true` 并提供 `vitest/globals` 类型，测试中可直接使用全局 API。
- Playwright 当前仅配置 Chromium 项目，且 `workers: 1`、`fullyParallel: false`。
