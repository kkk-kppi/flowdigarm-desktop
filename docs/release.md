# 发布指南

发布目标仅包括 Windows 10/11 x64 与 macOS Intel/Apple Silicon，不构建或分发 Linux 版本。发布负责人必须以 `docs/acceptance.md` 的逐项状态为准；存在「失败」或「未覆盖」时不得标记整体完成。

## 环境与锁文件

- Node.js 22、pnpm 10、stable Rust；Rust 最低版本由 `src-tauri/Cargo.toml` 声明。
- Windows 需要 MSVC Build Tools、WebView2，以及 Tauri 使用的 NSIS/WiX 打包前置条件。
- macOS 需要 Xcode Command Line Tools；签名需要 Apple Developer ID 证书，公证需要有效 Apple 开发者账户。
- Chromium 使用 `pnpm exec playwright install chromium` 安装。
- JavaScript 与 Rust 构建必须分别使用 `pnpm-lock.yaml`、`src-tauri/Cargo.lock`；CI 安装使用 frozen/locked 模式，不接受隐式升级。

## 本地门禁

在仓库根目录按顺序执行：

```text
pnpm install --frozen-lockfile
pnpm test
cargo test --locked --manifest-path src-tauri/Cargo.toml
pnpm playwright test
pnpm build
pnpm tauri build --no-bundle -- -- --locked
```

Windows no-bundle 产物为 `src-tauri/target/release/flowchart-editor.exe`；macOS 为 `src-tauri/target/release/flowchart-editor`。如执行启动 smoke，必须在验收报告记录启动命令、PID、观察时长、窗口/异常结果和退出方式；没有执行就标「未覆盖」，不能只凭文件存在推断可启动。

2026-07-21 Windows x64 本机证据：当前源码执行 `pnpm tauri build --no-bundle -- -- --locked` 成功；随后最终验证执行 `powershell -ExecutionPolicy Bypass -File scripts/windows-startup-smoke.ps1`，进程 PID 33096 存活 8 秒，exe 路径为 `src-tauri/target/release/flowchart-editor.exe`、大小 15,497,216 bytes，并在脚本 `finally` 中通过 `Stop-Process` 停止。此 smoke 只证明进程启动后短时存活，不验证窗口内容、保存/打开/导出等 UI 语义，也不替代 Windows 安装包或 macOS 验收。

## 平台包

- Windows：`pnpm tauri build --bundles nsis,msi -- -- --locked`，产出 NSIS 与 MSI。
- macOS：`pnpm tauri build --bundles app,dmg -- -- --locked`，产出 app 与 DMG。
- 指定 Rust target 时，产物目录位于 `src-tauri/target/<target>/release/bundle/`；本机默认 target 位于 `src-tauri/target/release/bundle/`。
- 应用 bundle 配置在 `src-tauri/tauri.conf.json`，标识符为 `com.flowchart.editor`。版本发布前应同时核对 npm、Cargo 与 Tauri 配置中的版本。

## CI 矩阵

`.github/workflows/release-gate.yml` 仅配置以下 runner/target：

| 平台 | Runner | Rust target | Bundle |
|---|---|---|---|
| Windows x64 | `windows-latest` | `x86_64-pc-windows-msvc` | NSIS、MSI |
| macOS Intel | `macos-15-intel` | `x86_64-apple-darwin` | app、DMG |
| macOS Apple Silicon | `macos-15` | `aarch64-apple-darwin` | app、DMG |

每个 runner 安装锁定依赖和 Chromium，运行 Vitest、Cargo test、Playwright、前端构建和 Tauri no-bundle，并上传浏览器证据与原生可执行文件。tag 构建才生成安装包。工作流配置、排队或步骤定义本身不是平台通过证据，必须保留对应 run URL、结论和 artifacts。

## 签名与公证

禁止把证书、私钥、密码或公证凭据写入仓库、报告或命令历史。CI 只读取以下变量名，文档不记录值：

- Windows：`WINDOWS_CERTIFICATE`、`WINDOWS_CERTIFICATE_PASSWORD`、`WINDOWS_CERTIFICATE_THUMBPRINT`。
- macOS 签名：`APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`。
- macOS 公证：`APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID`。

完整 secrets 存在时，tag job 把证书导入临时证书库或 keychain，再构建签名包；缺任一变量时工作流必须明确写入“unsigned”，不能报告签名/公证通过。真实 secrets 分支未执行时，签名与公证状态为「未覆盖」。

## 报告与产物

- Playwright HTML：`playwright-report/index.html`。
- Playwright JSON：`test-results/results.json`。
- 性能结果：`test-results/performance.json`。
- 失败截图、视频、trace 和附件：`test-results/artifacts/`。
- 本地阶段报告：`.superpowers/sdd/reports/`；最终文档任务报告为 `.superpowers/sdd/reports/task-docs-report.md`。
- CI artifact 名称由工作流生成，至少保留 `playwright-<target>`、`executable-<target>` 和 tag 的 `bundles-<target>`。

发布归档应包含安装包/app/DMG、对应原生可执行文件、测试报告、性能 JSON、版本和提交 SHA。对外分发前在仓库外生成并保存 SHA-256 校验值，不覆盖已发布版本的产物。

## 回滚

发现阻断问题后立即停止受影响 tag 的分发，保留问题产物和报告用于追踪；恢复上一个已验证、已签名的安装包/app/DMG及其校验值。修复必须使用新的补丁版本和新 tag，重新执行完整平台门禁、签名、公证和安装验证，不替换旧 tag 下的文件。

## 发布检查单

- [ ] 工作树只包含预期提交，版本号和 release notes 已核对。
- [ ] `pnpm install --frozen-lockfile` 与 Cargo `--locked` 无锁文件漂移。
- [ ] Windows、macOS Intel、macOS Apple Silicon 各自 Vitest/Cargo/Playwright/build/no-bundle 通过并有报告。
- [ ] Windows 关键路径与启动/退出 smoke 有本机或目标 runner 证据。
- [ ] 两种 macOS 架构的完整关键路径 E2E 有目标机器证据，不能只引用 CI 配置。
- [ ] NSIS、MSI、app、DMG 均完成安装、首次启动、打开/保存/恢复/导出检查。
- [ ] Windows 签名、macOS 签名与公证使用真实 secrets 执行并验证；否则明确标「未覆盖」。
- [ ] Playwright 报告、性能 JSON、失败附件策略、原生可执行文件和 bundles 已归档。
- [ ] SHA-256 校验值已在仓库外保存并与待发布产物一致。
- [ ] `docs/acceptance.md` 的整体状态无「失败」或「未覆盖」后，才允许宣称发布完成。
