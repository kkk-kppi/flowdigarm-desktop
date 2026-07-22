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

## X6 文本布局

- X6 `lineHeight` 会直接成为 SVG `<tspan>` 的绝对 `dy`；领域模型保存的是倍率，映射时必须使用 `fontSize * lineHeight`，否则多行文字会重叠。
- 节点实时画布、覆盖编辑器和 SVG 导出必须共用 `textAreaForNode`，统一叠加形状 `textAreaInset`、文本块四边距及段前/段后，避免编辑态与导出漂移。
- X6 `textWrap` 的有限 `height` 会删行，极大 `height` 遇到超宽字形又可能无进展循环；节点标签不得使用它。X6 与 SVG 导出共同消费 `wrapHorizontalText` 的预分行结果。
