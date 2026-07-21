# Acceptance Evidence

This table is the initial L1-L6 evidence index. “未覆盖” is not a pass. macOS local execution remains uncovered until evidence is produced by the corresponding CI runners or physical machines.

| Level | Current status | Gate and evidence |
|---|---|---|
| L1 可运行与平台 | 部分通过；macOS 未覆盖 | `pnpm playwright test`; console/page/unhandled-rejection fixture; `e2e/menus-accessibility.spec.ts`; Windows `pnpm tauri build --no-bundle`; CI runners are configuration, not local pass evidence. |
| L2 文件、单位与页面 | 通过（Windows browser E2E） | `e2e/editor-core.spec.ts`, `e2e/persistence-errors.spec.ts`; invalid schema/geometry/URL preserve the current document; unit switch preserves pt geometry. |
| L3 编辑与排版 | 通过（Windows browser E2E） | `e2e/editor-core.spec.ts`, `e2e/canvas-interactions.spec.ts`; text session, mixed batch format, format paint, selection, resize/rotation handles. |
| L4 连接、排列与结构 | 部分通过 | `e2e/editor-core.spec.ts`, `e2e/canvas-interactions.spec.ts`; auto-connect ports, connector visuals, edge tools, grouping. Detailed manual visual inspection remains release acceptance work. |
| L5 工具、帮助与安全 | 通过（automated scope） | `e2e/menus-accessibility.spec.ts`, `e2e/persistence-errors.spec.ts`, Vitest and Rust URL-policy tests. |
| L6 历史、测试、性能与导出 | 部分通过；macOS 未覆盖 | Full Vitest/Cargo/Playwright/build gates; `test-results/performance.json`; SVG, PNG 96/150/300, PDF URI, JSON assertions; macOS E2E is not locally covered. |

## Platform Matrix

| Platform | Local evidence | CI gate |
|---|---|---|
| Windows 10/11 x64 | Task 9b report records tests, release executable path, and size. | `windows-latest` |
| macOS Intel | 未覆盖 | `macos-13`, target `x86_64-apple-darwin` |
| macOS Apple Silicon | 未覆盖 | `macos-14`, target `aarch64-apple-darwin` |

Detailed command output and counts are recorded in `.superpowers/sdd/reports/task-9b-report.md` and CI artifacts. No Linux claim or job is included.
