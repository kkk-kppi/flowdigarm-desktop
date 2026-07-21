# 业务数据 JSON 与遗漏验收证据 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** 补齐图元业务数据 JSON 编辑入口，并为跳线视觉与 Windows 启动生成真实证据。

**Architecture:** application 提供 JSON 解析与可逆命令；PropertyTab 仅维护草稿和调用命令。E2E 通过 fixture 注入交叉边但验证真实 X6 路径；Windows smoke 脚本启动已构建 exe 并检查存活。

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest, Vue Test Utils, Playwright, PowerShell, Tauri 2.

## Global Constraints

- UI 不实现命令或 JSON 业务规则。
- 一次业务数据应用只产生一条撤销记录。
- `DiagramNode.data` 仍为 `Record<string, unknown>`；只接受 JSON object，不接受数组/标量。
- 错误与测试数据简体中文。

---

### Task 1: 业务数据 JSON 命令与属性入口

**Files:**
- Create: `src/application/inspector/business-data-json.ts`
- Create: `src/application/commands/set-business-data.ts`
- Modify: `src/ui/inspector/PropertyTab.vue`
- Test: `tests/unit/editor/business-data-json.test.ts`
- Test: `tests/unit/editor/commands/set-business-data.test.ts`
- Test: `tests/component/PropertyTab.test.ts`

**Interfaces:**
- Produces `parseBusinessDataJson(value): {ok:true;data:Record<string,unknown>} | {ok:false;error:string}`.
- Produces `SetBusinessDataCommand({pageId,nodeId,before,after})`, label `业务数据`.

- [ ] Write failing tests: valid nested Chinese object; invalid JSON; array/scalar rejection `业务数据必须是 JSON 对象。`; command apply/revert/immutable snapshot/one history.
- [ ] Run `pnpm vitest run tests/unit/editor/business-data-json.test.ts tests/unit/editor/commands/set-business-data.test.ts` and confirm module-not-found RED.
- [ ] Implement parser and immutable command. Parser code contract:

```ts
export function parseBusinessDataJson(value: string): ParseBusinessDataResult {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: '业务数据必须是 JSON 对象。' }
    }
    return { ok: true, data: structuredClone(parsed as Record<string, unknown>) }
  } catch {
    return { ok: false, error: '业务数据 JSON 格式无效。' }
  }
}
```

- [ ] Add PropertyTab `业务数据` accordion for exactly one selected node: formatted JSON textarea, `应用`/`重置`, invalid inline error; multi/edge disabled explanation. Apply executes one command; no change executes none.
- [ ] Component tests assert persistence/undo/error/no-change/multi disabled.
- [ ] Update features/user guide/acceptance from 未覆盖 to passing with test paths.
- [ ] Run focused + full Vitest + build.
- [ ] Commit `feat: add editable business data json property`.

### Task 2: 跳线与 Windows 启动证据

**Files:**
- Create/Modify: `e2e/canvas-interactions.spec.ts`
- Create: `scripts/windows-startup-smoke.ps1`
- Modify: `docs/acceptance.md`
- Modify: `docs/release.md`

- [ ] Add E2E fixture with two crossing unrelated orthogonal edges; showLineJumps=false/true; inspect real X6 SVG path difference and require jump arc/curve segment only when enabled; capture `test-results/screenshots/line-jump.png`.
- [ ] Add final core-path success screenshot `test-results/screenshots/editor-core-complete.png`.
- [ ] Implement PowerShell script: resolve `src-tauri/target/release/flowchart-editor.exe`, start process, wait 8 seconds, fail if exited, record PID/path/size, request Stop-Process in finally. It must not claim UI semantic success, only process startup survival.
- [ ] Run focused Playwright with zero console/page errors and screenshot existence assertions.
- [ ] Run `powershell -ExecutionPolicy Bypass -File scripts/windows-startup-smoke.ps1`; capture output in acceptance evidence.
- [ ] Update acceptance: jump visual and Windows process smoke passing;断网 Tauri/macos/signing remain 未覆盖.
- [ ] Commit `test: add line jump visual and windows startup evidence`.

## Self-Review

- No placeholders/TODO.
- Business data type matches domain exactly.
- Evidence status remains honest: Windows process smoke is not macOS or offline desktop E2E.
