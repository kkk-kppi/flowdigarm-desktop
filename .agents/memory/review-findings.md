# 审阅发现

## 当前状态

初始化阶段，仅完成顶层结构只读扫描，尚未执行深入审阅。

## 已观察到的问题/风险

1. **已知限制记录在 `docs/README.md` 第 81-86 行**：
   - PDF 页面绘制内容当前为 72 pixels/in 栅格内容，非矢量。
   - 主前端 bundle 有 Vite 大 chunk 警告。
   - macOS Intel / Apple Silicon 本地完整关键路径 E2E 尚未执行。
   - Windows/macOS 真实证书签名、Apple 公证、签名安装包人工安装验证尚未执行。

2. **文档文件名编码**：部分 `docs/` 下中文文件名在 PowerShell 默认编码输出中显示为乱码；文件本身内容未检查，需后续确认是否为有效 Markdown 或 HTML。

3. **CSP 配置**：`src-tauri/tauri.conf.json` 中 CSP 为 `default-src 'self'; img-src 'self' data:`，较为严格，符合离线工具定位。

## 待验证

- 实际运行 `pnpm test`、`cargo test`、`pnpm exec playwright test` 的结果。
- `pnpm build` 是否通过。
- `pnpm tauri build --no-bundle` 是否通过。
