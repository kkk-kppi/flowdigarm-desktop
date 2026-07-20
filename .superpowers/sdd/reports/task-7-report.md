# Task 7（P6）报告：排列、格式刷、超链接、组合/容器与常用形状

- 提交：`98e096a feat: add formatting links structure and shape usage`（分支 `feat/flowchart-editor-v1`，未 push）
- 验证：`pnpm vitest run` 63 文件 / 579 用例全绿；`pnpm build`（vue-tsc + vite）通过
- 聚焦命令：`pnpm vitest run tests/unit/editor/arrangement tests/unit/editor/format-paint.test.ts tests/unit/editor/group-cells.test.ts tests/unit/editor/container-membership.test.ts tests/unit/editor/hyperlink-validator.test.ts tests/unit/editor/set-link.test.ts tests/unit/editor/shapes` → 13 文件 / 104 用例全绿

## 交付内容

### application 层：排列（`src/application/arrangement/`）

- **align-cells.ts** `createAlignCommand(page, orderedIds, mode)`：基准 = 选择序列第一个图元（测试构造反例：外接矩形左边 10 ≠ 锚点左边 100）；六模式；<2 有效节点或全部无位移 → null；label「对齐图元」（MoveCellsCommand 增加可选 label 参数，默认仍「移动图元」）。
- **distribute-cells.ts** `createDistributeCommand`：按轴几何顺序排序、固定最外两个；`gap=(last.start−first.end−Σmiddle.size)/(n−1)`；<3 抛「等距排列至少需要三个图元。」；gap<0 抛「间距不足，无法等距排列。」；label「等距排列」。
- **z-order.ts** `ZOrderCommand` + `createZOrderCommand`：四动作（置顶/置底/上移一层/下移一层），节点与边共享 z 空间；上移/下移 = 相邻交换（连续选中块整体一格）；执行后全页规范化 1..n；before/after 记录全部受影响图元（含规范化改号的未选中项），revert 精确还原；顺序无变化 → null；label 分别为「置于顶层/置于底层/上移一层/下移一层」。
- **auto-connect.ts** `createAutoConnectCommand`：按选择顺序 n−1 条边；source 端口 = 距目标中心最近允许端口、target 对称（nearest-port）；容器节点跳过（不作连接端点）、同节点自连跳过；连线类型/箭头随页面设置；autoConnectLabel 开 → 每边一个空标签（position 0.5）；label「自动连线」，一条 CreateCellsCommand。
- **descendants.ts** `collectDescendantIds(page, rootIds)`：沿 parentId 链 BFS，环安全，按页面节点序返回；容器移动手势层据此把后代并入同一条 MoveCellsCommand。

### application 层：格式刷

- **commands/apply-format-paint.ts**：`captureFormatPaintSource`（节点 → 样式全键 + 文本 style/block/paragraph 全键；边 → EdgeStyle 全键）、`FormatPaintCommand`、`createFormatPaintCommand`。不复制 ID/位置/尺寸/旋转/内容/图片/链接/端口/业务数据/形状类型/结构关系（测试逐键断言）；before 仅捕获被覆盖键，文本三段全键捕获保证 revert 精确还原（修复了缺键浅合并残留 apply 写入键的缺陷）；类型不匹配跳过、无变化跳过、全部跳过 → null；label「格式刷」。
- **stores/format-paint-store.ts**（Pinia）：`mode: off/once/continuous` + `sourceCellId`；`armOnce/armContinuous`（恰好 1 个选中且页面内存在才生效）；`applyTo` 经 document-store 执行命令（once 应用后自动 off 清源；无效目标 false 不退模式）；`cancel`（Esc/空白）。

### application 层：超链接

- **links/hyperlink-validator.ts**：`validateHyperlink` 包装领域 `isAllowedHyperlinkProtocol`，空串合法（清除语义），非法 → 「仅支持 http、https、mailto 链接。」。
- **links/open-hyperlink.ts**：`shouldOpenHyperlink`（ctrl||meta）、`openCellHyperlink`（非法返回错误串不调平台；合法调 `platform.openExternalLink`；空串静默）。
- **commands/set-link.ts** `SetLinkCommand`：label「设置链接」；apply 时 after 非空且协议非法抛中文错误；空串归一化为 undefined；节点/边通用；目标不存在抛「命令目标不存在。」。

### application 层：组合与容器

- **注册表新增 `group` 形状**（common-shapes.ts）：category `'group'`（union 扩展，不入图元库 basic/flowchart）、isContainer、透明填充（fillOpacity 0）+ 虚线边框（strokeDash 'dash'）、无端口（不可作连接端点）。
- **commands/group-cells.ts**：`createGroupCommand`（<2 → null；group bbox=成员外接矩形；zIndex=成员最小值并插入最前成员之前保证渲染于成员之下；成员 beforeParentId 记录，嵌套允许）、`GroupCellsCommand`（label「组合」）、`createUngroupCommand`（非组合 → null）、`UngroupCellsCommand`（label「取消组合」；快照含原下标，revert 恢复原 group 节点含原 ID 与样式，多组按原下标升序插回）。
- **commands/container-membership.ts** `ContainerMembershipCommand`：`createAddToContainerCommand`（非容器抛「目标节点不是容器。」；成员含容器自身或其祖先抛「加入容器会形成循环。」；label「加入容器」）与 `createRemoveFromContainerCommand`（label「移出容器」）；仅改 parentId，成员数据/ID 保留，可逆。

### application 层：常用形状

- **shapes/shape-usage-repository.ts**：`ShapeUsageRepository` 接口 + `InMemoryShapeUsageRepository`（Task 8 换 SQLite，接口不变）+ `computeTopShapes(rows, allTypes, limit=20)`（次数降序、同次按内置序、不足补足、去重）。
- **document-store**：非响应式仓库注入（WeakMap，默认 InMemory，`setShapeUsageRepository` 替换点）、`shapeUsageVersion` 状态、`recordShapeUsage`（失败静默不阻断编辑）；`createNodeFromShape` 成功后记录使用（拖入与双击两路径均覆盖）。

### infrastructure 层

- **cell-mapper.ts**：`CellMetadata.parentId`；纯函数 `relativePositionFor(node, parent)`（子文档坐标 − 父文档坐标）。
- **graph-adapter.ts**（薄胶合，jsdom 不可测）：renderPage 后 `wireParentChildren` 按 parentId 组装 X6 父子（addChild + 显式相对坐标定位，与 X6 版本行为无关确定）；移动手势改用 `absolutePosition`（沿父链累加，子节点 position() 为父相对坐标）；新增 `onNodeClick/onEdgeClick/onBlankClick`（携带 ctrl/meta 修饰键）与 `suppressSelection(cellId)` 选择抑制（接入 Selection filter）。

### UI 层

- **CompactToolbar.vue**：格式刷按钮接线——单击 armOnce、双击 armContinuous、非单选且 off 时禁用、once→蓝色 active、continuous→橙色 active、完整 tooltip（名称+行为+Esc）；Esc 全局 keydown 取消（输入控件聚焦不拦截）。
- **CanvasArea.vue**：`format-painting` 容器类 + 十字游标；onNodeClick 格式刷应用 / Ctrl/Cmd+点击带链接节点经注入 platform 打开（失败/非法 → lastNotice 中文提示）；onEdgeClick 应用；onBlankClick 取消；suppressSelection（格式刷期间全部禁选；Ctrl/Cmd 按住且节点带链接时禁选）；Esc 取消；onNodeMoved 收集 collectDescendantIds 后代并入同一条 MoveCellsCommand（容器移动成员一起移动）。
- **PropertyTab.vue**：节点信息区与边属性区各加「链接」输入框（失焦提交 SetLinkCommand、非法显示「仅支持 http、https、mailto 链接。」不执行、留空清除、切换选择清错误）。
- **ElementLibrary.vue**：顶部「常用」手风琴（默认展开、搜索时隐藏）：`computeTopShapes(rows, 库内12型, 20)` → 过滤 basic/flowchart 渲染；onMounted + shapeUsageVersion watch 异步刷新；格子与分类格子同一创建交互（data-testid=`top-shape-cell` 以与既有 12 格断言兼容）。
- **feature-help-registry.ts**：追加 format-paint/align/distribute/z-order/auto-connect/group-container/hyperlink/top-shapes 8 条目（8 字段齐全）。
- **docs**：features.md §6.1 格式刷、§8 排列全字段、§3 常用形状；interactions.md 格式刷状态机（off→once→off / off→continuous→Esc）与超链接点击（普通=选择，Ctrl/Cmd=打开）。

## TDD 证据（RED → GREEN）

| 模块 | RED（首跑失败） | GREEN |
|---|---|---|
| align-cells | 模块不存在，0 测试收集 | 10/10 |
| distribute-cells | 模块不存在 | 6/6 |
| z-order | 模块不存在 | 10/10 |
| auto-connect | 模块不存在 | 7/7 |
| descendants | 模块不存在 | 3/3 |
| format-paint | 模块不存在；首轮 9/10（revert 文本残留 background 键）→ 全键捕获修复 | 10/10 |
| format-paint-store | 模块不存在 | 8/8 |
| hyperlink | 模块不存在 | 7/7 |
| set-link | 模块不存在 | 5/5 |
| group-cells（含 registry） | 模块不存在；首轮 6/11（测试 idGen 模块态未重置）→ beforeEach 修复 | 11/11 |
| container-membership | 模块不存在 | 7/7 |
| shape-usage-repository | 模块不存在 | 8/8 |
| document-store 统计 | 2 用例失败（getter/action 不存在） | 26/26 |
| cell-mapper 容器 | 2 用例失败（parentId/relativePositionFor 不存在） | 18/18 |
| CompactToolbar 格式刷 | 4 用例失败 | 16/16 |
| ElementLibrary 常用区 | 3 用例失败（首轮含 flushPromises/recordShapeUsage 路径修正） | 10/10 |
| PropertyTab 链接 | 4 用例失败 | 23/23 |
| help-registry 8 条目 | 4 用例失败 | 19/19 |

既有测试同步更新（接口/注册表变化）：shape-registry.test.ts（14→15 注册数、group 无端口豁免）、CompactToolbar 占位断言（Task 7 占位文案 → 实装）、ElementLibrary 挂载接入 pinia。

## 变更文件

新增：`src/application/arrangement/{align-cells,distribute-cells,z-order,auto-connect,descendants}.ts`、`src/application/commands/{apply-format-paint,set-link,group-cells,container-membership}.ts`、`src/application/links/{hyperlink-validator,open-hyperlink}.ts`、`src/application/shapes/shape-usage-repository.ts`、`src/stores/format-paint-store.ts` + 对应 13 个测试文件/块。

修改：`move-cells.ts`（label 参数）、`shape-registry.ts`/`common-shapes.ts`（group 形状）、`cell-mapper.ts`/`graph-adapter.ts`（容器支持+点击事件+选择抑制）、`document-store.ts`（仓库注入+记录）、`CanvasArea.vue`/`CompactToolbar.vue`/`PropertyTab.vue`/`ElementLibrary.vue`、`feature-help-registry.ts`、`docs/features.md`、`docs/interactions.md` + 6 个既有测试文件。

## 自审发现（已修复）

1. format-paint revert 文本样式残留（缺键浅合并）→ 文本三段全键捕获。
2. group-cells/auto-connect 测试 idGen 模块级状态跨用例污染 → beforeEach 重置。
3. format-paint-store 多余公开 action `arm` → 收敛为模块私有 `singleSelectedCellId()`。
4. distribute 测试 `Parameters<>` 类型错误（build 阶段 vue-tsc 捕获）→ 改 `DiagramNode[]`。
5. 既有 shape-registry 断言被 group 形状击穿 → 同步更新（15 注册数、端口豁免）。

## 遗留与风险

- graph-adapter 父子装配/点击回流/选择抑制、CanvasArea 接线为 X6 胶合层，jsdom 不可实例化，无单测覆盖（逻辑均下沉纯模块并测全）；建议 Task 8 后以 E2E 验证组合拖拽、格式刷画布点击与 Ctrl+点击打开链接。
- distribute 已完全等距时返回空 moves 命令（brief 签名非 null）；UI 层（Task 8 菜单）触发前可忽略此边界。
- X6 `addChild` 后显式重设相对坐标，与 X6 版本默认行为解耦，升级 X6 时安全。
- 未跟踪文件 `opencode.json` 非本任务产物，未纳入提交。

## 评审修复（2026-07-21）

- `UngroupCellsCommand.revert()` 移除错误的 `+ offset`，按快照原下标直接回插；新增多组、嵌套组、间隔节点及完整数据的文档深比较回归，并验证连续 undo/redo/undo 结果稳定。
- `CanvasArea.vue` 捕获合法链接的平台打开拒绝，写入 `lastNotice = '无法打开链接，请检查系统默认应用。'`；新增组件测试覆盖平台拒绝、非法协议原提示及普通点击选择语义。
- 强化格式刷黑名单夹具：源与目标均设置不同的非空图片、链接、业务数据、父级、容器标记、几何、角度、内容、形状；边覆盖不同端点/端口、连接器、拐点、标签、链接，并逐字段比对目标原值。
- 格式刷的 `NodeStyle`、`EdgeStyle`、`TextStyle`、`TextBlock`、`TextParagraph` 字段列表改为 `Record<keyof T, true>` 穷尽映射后生成 typed keys；新增运行时键集合断言，未来字段增加会先触发类型检查或测试失败。

### 验证记录

- RED：`pnpm vitest run tests/unit/editor/group-cells.test.ts tests/unit/editor/format-paint.test.ts tests/component/CanvasArea.test.ts` → 3 文件各 1 个预期失败（组合顺序、平台拒绝通知、强化夹具后的旧默认样式断言），并捕获 1 个未处理 rejection；其余 23 用例通过。
- GREEN：`pnpm vitest run tests/unit/editor/group-cells.test.ts tests/unit/editor/format-paint.test.ts tests/component/CanvasArea.test.ts` → 3 文件 / 26 用例全绿，无未处理错误。
- 覆盖套件：`pnpm vitest run tests/unit/editor/group-cells.test.ts tests/unit/editor/format-paint.test.ts tests/unit/editor/hyperlink-validator.test.ts tests/component/CanvasArea.test.ts` → 4 文件 / 33 用例全绿。
- 全量：`pnpm vitest run` → 64 文件 / 584 用例全绿。
- 构建：`pnpm build` → `vue-tsc --noEmit` 与 Vite production build 通过；保留既有 >500 kB chunk 警告（产物 JS 738.36 kB，gzip 216.77 kB）。
- 差异检查：`git diff --check` → 通过（仅 Git 的 LF→CRLF 工作区提示，无空白错误）。
