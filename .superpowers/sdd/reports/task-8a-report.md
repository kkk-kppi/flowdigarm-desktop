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

## 评审修复（2026-07-21）

提交目标：`fix: 隔离数据库故障并接通自动恢复生命周期`

### 修复明细

1. Rust 启动改为管理 `PersistenceState { repository: Option<SqliteRepository>, initialization_error }`。应用数据目录创建、SQLite 打开或迁移失败只记录内部详情并以降级状态启动；移除 `.expect` 启动 panic。所有数据库 commands 统一返回 `本机数据库暂时不可用，图文件不受影响。`，不暴露 rusqlite/英文错误。
2. `save_diagram` 和 `read_diagram` 都先完成真实图文件操作，再 best-effort upsert 最近文件。使用真实失败初始化状态（把目录作为 SQLite 文件路径）验证数据库不可用时原子保存仍成功；打开合法文件在数据库可用时写 recent，不可用时仍返回文档。
3. 新增 `DocumentPersistenceController`：订阅 document store；dirty 文档变化调度 2 秒恢复快照；clean/load 取消；`dispose` 解除订阅并清 timer。协调保存按“文件成功 -> 等待 autosave -> best-effort 删除 recovery -> `markSaved`”执行，失败保持 store 不变并返回精确 `无法保存，原文件未被覆盖。`。`main.ts` 使用 Tauri 文件/recovery repository 初始化控制器，并在 Vue unmount/window unload 时释放。
4. `AutosaveController` 改为单一串行写循环。timer 和 `flush()` 复用同一运行 Promise；旧写入进行中时只保留最新 pending，旧写入完成后再写，`flush()` 等待两者；repository 与 `onError` 异常均不会产生未处理 rejection。两个 deferred-promise 测试覆盖 in-flight flush 和最终快照顺序。
5. document store 删除每命令 `JSON.stringify`/指纹 Map，改用单调 revision token 与每页并行 `{ undo, redo }` transition 栈。execute 记录 `{beforeRevision, afterRevision}`；undo/redo 仅在当前 token 匹配端点时恢复旧 token，否则为跨页/分支生成新 token；每页元数据与 `COMMAND_HISTORY_LIMIT=100` 同步裁剪。覆盖保存后 undo/redo、相同 JSON 分支、跨页撤销和 100 条上限。
6. 原子替换成功后父目录 sync 改为 best-effort：失败只记录内部日志并返回保存成功，因为替换已不可回滚；替换前失败仍保持原文件。注入父目录 sync 失败测试断言目标内容已更新且临时文件清理。
7. 扩展名契约统一：前端/Rust 无扩展名追加 `.flowdiagram`，任意大小写 `.FLOWDIAGRAM` 接受，已有 `.json` 等其他扩展名拒绝，不再生成 `.json.flowdiagram`。前端 helper 与 Rust path 测试覆盖三类。
8. SQLite 默认设置测试精确比较全部 10 个 key/value。事务回滚测试通过 `upsert_recent` 的第二步 prune trigger 失败，证明同一 repository operation 的第一步 insert 被回滚，不再直接演示裸 transaction。打开失败测试通过真实 `DocumentPersistenceController` + Pinia store 断言 document/path/dirty/activePageId 全部不变。

### TDD RED 证据

- `pnpm vitest run tests/unit/editor/persistence tests/unit/stores/document-store.test.ts tests/unit/platform/tauri-desktop-platform.test.ts`：预期 RED；controller 模块缺失，扩展 helper 3 项失败，autosave 两项并发/flush 失败，精确保存错误失败，相同 JSON 分支 dirty 失败。
- `cargo test --manifest-path src-tauri/Cargo.toml`：预期编译 RED；缺少 `PersistenceState`、`read_diagram_with_state`、`save_diagram_with_state` 和 `atomic_write_with_operations`。
- `cargo test --manifest-path src-tauri/Cargo.toml commands::file_commands::tests::repository_failures_map_to_stable_chinese_at_the_command_boundary`：预期编译 RED；缺少 command boundary `database_result` mapper。

### 最终验证

| 命令 | 结果 |
|---|---|
| `pnpm vitest run tests/unit/editor/persistence tests/unit/stores/document-store.test.ts tests/unit/platform/tauri-desktop-platform.test.ts` | PASS，5 files / 52 tests |
| `pnpm vitest run` | PASS，68 files / 612 tests |
| `cargo test --manifest-path src-tauri/Cargo.toml`（timeout 900000 ms） | PASS，31 tests / 0 failed |
| `pnpm build` | PASS，`vue-tsc --noEmit` + Vite production build |

构建仍仅报告既有单 chunk 超过 500 kB 的非阻断提示（JS 748.96 kB，gzip 220.57 kB）；本次未改构建拆包。`opencode.json` 未读取、修改或纳入提交。

## 二次评审竞态修复（2026-07-21）

提交目标：`fix: 修复保存并发与精确修订状态竞态`

### 修复明细

1. `DocumentPersistenceController.save` 在首次 `await` 前捕获 document id、revision、路径和序列化 JSON。文件成功后仅在 id/revision 仍精确匹配时 flush、best-effort 删除 recovery 并标记该 revision；同文档继续编辑只更新仍适用的路径并保持 dirty，不同文档不接收旧路径，两者都保留或重新调度当前恢复快照。cleanup 等待期间再次变化也会重新检查；recovery 删除失败仍返回文件保存成功。
2. document store 暴露只读 `currentRevision` 与 path-only `updateFilePath`。跨页 mismatch 的 undo 转换改写为 `{before: freshResultRevision, after: preUndoCurrentRevision}`，redo 转换改写为 `{before: preRedoCurrentRevision, after: freshResultRevision}`，使跨页分歧后的重复逆操作可精确回到保存点；转换元数据继续与 100 条命令历史同步裁剪。
3. `AutosaveController` 使用显式 `pendingReady`。schedule 的独立 2 秒 timer 只负责把 pending 标为 ready，旧 writer 完成时不会消费尚未到期的新快照；`flush()` 会立即提升 pending 并等待当前及提升后的写入，dispose 清除 pending/timer，repository/onError 失败仍不产生未处理 rejection。

### TDD RED 证据

- `pnpm vitest run tests/unit/editor/persistence/document-persistence-controller.test.ts tests/unit/editor/persistence/autosave-controller.test.ts tests/unit/stores/document-store.test.ts`：预期 RED，3 files / 4 failures。旧 autosave 在 writer 于新快照 deadline 前完成时立即写入新快照；旧 save completion 覆盖替换文档路径；store/controller 尚无 `currentRevision` 精确 token。

### 最终验证

| 命令 | 结果 |
|---|---|
| `pnpm vitest run tests/unit/editor/persistence tests/unit/stores` | PASS，7 files / 74 tests |
| `pnpm vitest run` | PASS，68 files / 619 tests |
| `pnpm build` | PASS，`vue-tsc --noEmit` + Vite production build |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 未运行：本次未修改 Rust，按二次评审要求可选 |

构建仍仅报告既有单 chunk 超过 500 kB 的非阻断提示（JS 750.44 kB，gzip 220.92 kB）。`opencode.json` 保持未跟踪且未纳入本次修改或提交。

## 三次评审 TOCTOU 修复（2026-07-21）

提交目标：`fix: 使用恢复版本令牌关闭并发删除窗口`

### 修复明细

1. document store 新增单调 `documentEpoch`，每次 new/load/replace 均递增；显式保存捕获 epoch、document id 与 revision，三者共同判定当前实例，避免同 ID、同 revision 的替换文档碰撞。
2. recovery write/read DTO、Tauri command 与 SQLite `recovery_snapshots` 新增 `versionToken`/`version_token`（`epoch:revision`）。删除改为事务内 `DELETE ... WHERE document_id=? AND version_token=?`，旧 token 删除不能移除后写入的新快照。
3. 未并发变化的显式保存先写入并 flush 捕获 token，再执行条件删除。延迟删除期间的新编辑继续按原 2 秒防抖写入，不在删除完成后重启防抖。
4. 并发 Save As 仅在 document epoch 相同时更新路径，并无条件用新 `sourcePath` 替换当前 pending schedule、重启其 2 秒防抖；epoch 已变化时不覆盖替换文档路径。pending 与 in-flight 两类回归均覆盖。
5. SQLite 仍为 7 张本机元数据表，migration/default/idempotency 与全部 mutation transaction 测试保持通过；数据库不可用不改变真实图文件保存成功。

### TDD RED 证据

- TS focused 首轮：4 files / 9 failures；缺失 epoch/token、adapter 未传条件 token、同 ID/revision 替换被误认、延迟删除与 Save As sourcePath 回归均按预期失败。
- Rust repository 首轮：因 `RecoverySnapshotWrite.version_token` 与双参数 `delete_recovery` 尚不存在产生 8 个预期编译错误。

### 最终验证

| 命令 | 结果 |
|---|---|
| `pnpm vitest run tests/unit/editor/persistence tests/unit/stores` | PASS，7 files / 79 tests |
| `pnpm vitest run` | PASS，68 files / 626 tests |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS，32 tests / 0 failed |
| `pnpm build` | PASS，`vue-tsc --noEmit` + Vite production build |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、`git diff --check` | PASS（格式修正后；仅工作区 LF/CRLF 提示） |

关注项仍仅为既有 Vite 单 chunk 超过 500 kB 的非阻断提示（JS 750.65 kB，gzip 220.99 kB）。`opencode.json` 保持未跟踪且未读取、修改或纳入提交。
