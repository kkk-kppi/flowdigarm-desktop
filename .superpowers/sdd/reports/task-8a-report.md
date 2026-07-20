# Task 8a 实施报告：原子文件、SQLite、最近文件与自动恢复

日期：2026-07-21
分支：`feat/flowchart-editor-v1`

## 结果

已完成 Task 8a 的 Rust/platform/application 持久化边界：同目录临时文件、文件 fsync、Windows 原子覆盖、Unix 父目录 fsync；Tauri app data 下的 `flowchart-editor.db` 与 7 张本机元数据表；文件、最近文件、恢复、设置和形状统计 commands；application ports、文件用例、2 秒防抖恢复控制器；Tauri dialog/invoke adapters；SQLite 失败时的形状统计内存降级；document-store 保存 revision dirty 跟踪。未实现菜单、恢复对话框或查找 UI。

## TDD RED 证据

### Rust 首轮 RED

命令：

```text
cargo test --manifest-path src-tauri/Cargo.toml
```

在只加入测试和模块声明、未加入实现时，编译按预期失败：

```text
error[E0432]: unresolved imports super::normalize_save_path, super::read_diagram_file,
super::save_diagram_file, super::validate_document_json
error[E0432]: unresolved imports super::atomic_write, super::atomic_write_with_replacer
error[E0432]: unresolved imports super::RecentDocument, super::RecoverySnapshotWrite,
super::SqliteRepository, super::UserTemplate, super::WindowState
```

测试本身最初有一个非 ASCII raw byte string 编译错误；改为 UTF-8 `str.as_bytes()` 后重新运行，输出只剩上述“功能尚不存在”的预期 RED。

### TypeScript 首轮 RED

命令：

```text
pnpm vitest run tests/unit/editor/persistence tests/unit/editor/shapes/shape-usage-repository.test.ts tests/unit/stores/document-store.test.ts
```

结果：4 个测试文件失败。三个新套件按预期因模块尚不存在而失败：

```text
Failed to resolve import "@/application/persistence/autosave-controller"
Failed to resolve import "@/application/persistence/document-file-use-cases"
Failed to resolve import "@/infrastructure/persistence/tauri-shape-usage-repository"
```

store 的新增保存点测试执行到断言并按预期失败：

```text
保存点后编辑为 dirty，undo 回保存点 clean，redo 再次 dirty
expected true to be false
```

### 自评回归 RED

自评发现需要直接证明“数据库失败不改变文件保存成功”，先增加测试后运行 Rust suite：

```text
error[E0432]: unresolved import super::save_diagram_with_recent
```

同一轮先加入了 pinned 保留与 recovery IPC `json` 字段测试；实现 helper 后三项均转 GREEN。

## TDD GREEN 证据

### Rust GREEN

首轮实现后：

```text
cargo test --manifest-path src-tauri/Cargo.toml
test result: ok. 25 passed; 0 failed
```

自评修复后最终：

```text
cargo test --manifest-path src-tauri/Cargo.toml
test result: ok. 27 passed; 0 failed
```

覆盖：新文件、覆盖已有文件、替换前注入失败保持旧内容、临时文件清理、中文 JSON；20 MiB/UTF-8/JSON/schemaVersion/路径/扩展名；7 表、PRAGMA、迁移幂等、10 个默认设置、各类 CRUD、最近文件排序与 50 上限、pin 保留、事务回滚、JSON 拒绝、recovery IPC 字段，以及 metadata 失败不影响原子文件成功。

### TypeScript GREEN

实现后的直接 GREEN：

```text
pnpm vitest run tests/unit/editor/persistence tests/unit/editor/shapes/shape-usage-repository.test.ts tests/unit/stores/document-store.test.ts
Test Files 4 passed (4)
Tests 50 passed (50)
```

覆盖：打开取消、合法文件、非法 schema/几何/URL 不改原文档、recent 复用校验、保存序列化/取消/失败；1999/2000 ms、last-write-wins、flush/cancel/dispose、reject/onError；Tauri shape invoke 与 InMemory 降级；保存点、undo clean、redo/分支 dirty。

## 最终验证

| 命令 | 结果 |
|---|---|
| `pnpm vitest run tests/unit/editor/persistence tests/unit/stores` | PASS，6 files / 58 tests |
| `cargo test --manifest-path src-tauri/Cargo.toml`（timeout 900000 ms） | PASS，27 tests |
| `pnpm vitest run` | PASS，66 files / 600 tests |
| `pnpm build` | PASS，`vue-tsc --noEmit` + Vite production build |
| `git diff --check` | PASS，仅 Git 的工作区 LF→CRLF 提示，无 whitespace error |

构建过程中曾由 `vue-tsc` 捕获 recovery DTO 不能直接赋给 Tauri `InvokeArgs`；根因是 DTO 无字符串索引签名。在 IPC 边界传递 `{ ...input }` 后，生产构建通过。

## 关键实现

- `atomic_file.rs` 使用目标同目录 UUID 临时文件、`create_new`、`write_all`、`sync_all` 和失败清理 guard；Windows 使用 `ReplaceFileW`/`MoveFileExW`，Unix 使用原子 rename 并同步父目录。
- `sqlite_repository.rs` 每个连接设置 foreign keys、WAL（文件库）和 5000 ms busy timeout；迁移及全部 mutation 都使用显式 transaction。
- SQLite 只保存 schema/settings/recent/recovery/shape/window/template 元数据，图主体只进入 `.flowdiagram`。
- `save_diagram_with_recent` 先完成原子文件写入，再 best-effort 更新最近文件；后者失败只记录日志并保持成功返回。
- application use cases 负责 `parseDiagramDocument`/`serializeDiagramDocument`，Vue 和 stores 不调用 Tauri 或文件/SQL API。
- `AutosaveController` 默认 2000 ms 单 timer 防抖，flush 可等待，dispose 清理 timer，repository reject 转 `onError`，不形成未处理 Promise rejection。
- `TauriShapeUsageRepository` 首次数据库失败后永久降级至本次运行的 InMemory repository，图元创建继续成功。

## 文件清单

新增：

- `src-tauri/src/persistence/{mod.rs,atomic_file.rs,sqlite_repository.rs}`
- `src-tauri/src/commands/file_commands.rs`
- `src/application/persistence/{persistence-ports.ts,document-file-use-cases.ts,autosave-controller.ts}`
- `src/infrastructure/persistence/tauri-shape-usage-repository.ts`
- `tests/unit/editor/persistence/{document-file-use-cases.test.ts,autosave-controller.test.ts}`
- `docs/superpowers/plans/2026-07-21-task-8a-persistence.md`
- `.superpowers/sdd/reports/task-8a-report.md`

修改：

- `src-tauri/{Cargo.toml,Cargo.lock,capabilities/default.json}`
- `src-tauri/src/{lib.rs,commands/mod.rs,migrations/001_initial.sql}`
- `package.json`、`pnpm-lock.yaml`
- `src/{main.ts,platform/tauri-desktop-platform.ts,stores/document-store.ts}`
- `tests/unit/editor/shapes/shape-usage-repository.test.ts`
- `tests/unit/stores/document-store.test.ts`
- `docs/{features.md,user-guide.md}`

## 自评与修复

1. Important：recovery Rust DTO 默认会输出 `documentJson`，与 TS port 的 `json` 不一致。增加序列化测试并对该字段显式 `serde(rename = "json")`。
2. Important：普通保存用 `pinned=false` upsert 会清除已有 pin。增加回归断言并在 conflict update 中保留已有 pin。
3. Important：原有代码结构只能静态看出 DB failure 被忽略，缺少行为证明。提取先文件后 metadata 的 helper，注入失败并断言文件成功落盘。
4. Build：Tauri `InvokeArgs` 类型不接受无索引签名 DTO。仅在 IPC 边界展开为普通对象，保持 application DTO 严格类型。
5. Security：能力仅加入 dialog open/save；实际文件内容仍只经 Rust commands，不授予前端 fs wildcard，也未加入 shell execute。

## 关注项

- Vite 构建仍报告单个约 741 kB chunk 超过 500 kB；这是非阻断性能提示，不属于 Task 8a 持久化范围。
- 原子故障通过确定性的替换回调注入覆盖；未进行拔电/进程强杀的破坏性系统测试。
- 菜单、恢复提示/选择与最近文件 UI 按要求留给 Task 8b；Task 8a 只提供 ports、commands 和 use cases。
