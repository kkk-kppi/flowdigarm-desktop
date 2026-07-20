# 功能文档

> 本文档随实现更新：当前仅按需求追踪表 A 组 11 项建立章节骨架，各字段在对应功能任务落地后补全。

## 1. 文档与页面（新建/打开/保存/多页标签/页面设置）

- 入口：页面标签栏 `src/ui/pages/PageTabs.vue`（单击切换、双击行内重命名、× 内联确认删除、末尾 + 新建、右侧缩放控件）；右侧"页面设置"标签页 `src/ui/pages/PageSetupTab.vue`；分页符叠层 `src/ui/canvas/PageBreakOverlay.vue`。文件打开/保存的应用用例与平台能力已就绪，菜单入口和恢复对话框由 Task 8b 接线。
- 前置条件：存在已打开文档（至少一页）；背景页引用目标必须是背景类型页面且不成循环。
- 成功结果：多页新建/切换/重命名/删除及页面设置保持既有行为；`.flowdiagram` 打开经 Rust 做 20 MiB、UTF-8、JSON 与 schemaVersion 基础校验，再由 application 做完整领域校验；保存使用目标同目录临时文件、文件 fsync、原子替换（Windows 可覆盖已有文件）及 Unix 父目录 fsync。显式保存成功记录保存 revision，undo 回保存点时 `dirty=false`，redo 或分支编辑时恢复 `dirty=true`。脏文档可由 `AutosaveController` 在最后一次变化 2 秒后写恢复快照，显式保存调用方负责删除快照。
- 失败反馈：删除最后一页「至少保留一个页面。」；删除被引用为背景页的页面「该页面被引用为背景页，无法删除。」；重命名空名或纯空白「页面名称不能为空。」；背景页引用循环或指向非背景页「背景页设置无效。」；页面无图元时"自动调整大小"禁用（title 提示"页面无图元"）。
- 撤销边界：新建/删除/重命名页面各一条记录；页面设置一次"应用"一条记录（无变化不产生）；"自动调整大小"一条记录；切换页与分页符等视图开关不产生命令、不进入撤销历史。
- 数据字段：图文件只保存 `DiagramDocument`；SQLite `flowchart-editor.db` 只保存 7 张本机元数据表：迁移版本、设置、最近文件、恢复快照、形状统计、窗口状态和用户模板。最近文件含 path/documentId/name/lastOpenedAt/pinned，恢复快照含 documentId/name/json/sourcePath/updatedAt，时间为 Unix 毫秒 UTC。应用契约见 `src/application/persistence/persistence-ports.ts`，SQLite 不保存用户图文件主体。
- 失败反馈：非法文件返回「文件格式无效，未打开文件。」且不替换当前文档；保存失败返回「无法保存，原文件未被覆盖。」。原子图文件保存成功后，即使最近文件 SQLite 更新失败也保持保存成功；自动恢复失败报告「自动恢复快照保存失败，图文件不受影响。」。
- 自动化测试位置：文件用例与自动恢复在 `tests/unit/editor/persistence/*`，保存点在 `tests/unit/stores/document-store.test.ts`，形状统计降级在 `tests/unit/editor/shapes/shape-usage-repository.test.ts`；Rust 原子文件、SQLite、迁移和 command 校验测试与实现同模块位于 `src-tauri/src/{persistence,commands}`。

## 2. 画布与视图（工作区/标尺/缩放/网格/状态栏）

- 入口：应用主窗口中央画布区（`src/ui/canvas/CanvasArea.vue`，由 `src/App.vue` 经 AppShell 包裹渲染）；缩放/平移/适应入口为 Ctrl+滚轮、中键或 Space+左键拖拽（菜单与状态栏控件入口在后续任务接线）。
- 前置条件：存在已打开的文档页；页面单位 ∈ mm/cm/in/pt/px（默认 A4、mm）。
- 成功结果：X6 画布按 cell-mapper 元数据渲染页面节点与边；顶部/左侧标尺随单位、缩放、平移实时换算，主刻度约 60–120 CSS px（1/2/5×10ⁿ 自适应，连续缩放极端值可达约 150）；Ctrl+滚轮以光标为锚缩放（10%–400% 钳制）；中键/Space+左键平移；适应窗口/页面/内容/选择使目标矩形在视口居中；网格开关控制 X6 点阵网格显示；100% 缩放 = 96 CSS px/in。
- 失败反馈：视口操作为纯视图状态，无失败路径；空内容时"适应内容"不改变视口（由调用方回退到适应页面）。
- 撤销边界：缩放、平移、四种适应、标尺/网格/参考线/分页符开关均为视图操作，不进入撤销历史。
- 数据字段：视口状态 `ViewportState { zoom, panX, panY }`（pan 单位 CSS px，`src/application/viewport/viewport-transform.ts`）；视图设置 `showRulers/showGrid/showGuides/showPageBreaks/snapToGrid/theme`（`src/stores/app-store.ts`，默认值对齐详细设计 §9.4）。
- 自动化测试位置：`tests/unit/editor/viewport/viewport-transform.test.ts`、`tests/unit/editor/viewport/ruler-scale.test.ts`、`tests/unit/editor/viewport/viewport-controller.test.ts`、`tests/unit/editor/cell-mapper.test.ts`、`tests/unit/stores/app-store.test.ts`、`tests/component/RulerOverlay.test.ts`、`tests/unit/editor/help-registry.test.ts`。

## 3. 图元创建（库拖入/双击创建/文本与连接工具/图片导入）

- 入口：左栏图元库 `src/ui/shapes/ElementLibrary.vue`（220px，搜索/基本形状与流程图手风琴/3 列缩略图）；拖入经 X6 Dnd（`src/infrastructure/x6/graph-adapter.ts` startShapeDrag，拖拽预览与落点 pt）；双击/回车在视口中心创建（`src/ui/canvas/CanvasArea.vue` createShapeAtViewportCenter，经 ViewportTransform 换算）；创建逻辑统一走 document-store `createNodeFromShape`；连接创建经连线手势（端口拖出，落端口或节点主体自动取最近端口）。文本工具/图片导入 Task 6b 及后续补全。
- 前置条件：存在已打开文档页；形状类型已注册（14 个内置形状，`src/application/shapes/common-shapes.ts`）。
- 成功结果：新节点按 ShapeDefinition 默认尺寸/样式/角度 0 创建，zIndex 取页面现有最大递增，创建后自动选中；新边使用页面默认连线类型与默认箭头（none/single/double → 无/末端/双端）；落节点主体时按落点 pt 计算最近端口（等距按 top→right→bottom→left）；图元库顶部「常用」手风琴默认展开，按本机使用次数降序展示 Top 20（次数相同按内置顺序、新用户按内置顺序补足、搜索时隐藏），创建成功即记录一次使用（`recordShapeUsage` 经 document-store 注入的 repository，Task 8 换 SQLite 实现）。
- 失败反馈：未知形状类型抛「未知形状类型：{type}」；点击「+ 更多形状...」提示「更多形状将在后续版本提供。」。
- 撤销边界：一次拖入/双击创建/连接各一条「创建图元」记录；重连一条「重新连接」；拐点编辑一条「编辑拐点」。
- 数据字段：`ShapeDefinition`（type/label/category/body/defaultSize/minSize/ports/textAreaInset/defaultStyle/isContainer/keepAspectOnShiftResize，`src/application/shapes/shape-registry.ts`）；`DiagramNode`/`DiagramEdge`（`src/domain/diagram.ts`）；端口 id 固定 top/right/bottom/left；常用形状统计 `ShapeUsageRepository/computeTopShapes`（`src/application/shapes/shape-usage-repository.ts`）。
- 自动化测试位置：`tests/unit/editor/shapes/*`（含 shape-usage-repository）、`tests/unit/editor/commands/create-cells.test.ts`、`tests/unit/editor/commands/reconnect-vertices.test.ts`、`tests/component/ElementLibrary.test.ts`、`tests/unit/editor/cell-mapper.test.ts`、`tests/unit/stores/document-store.test.ts`。

## 4. 图元编辑（选择/拖拽/缩放/旋转/删除/复制粘贴）

- 入口：画布直接交互——单击/框选/Ctrl 多选（X6 Selection，`src/infrastructure/x6/graph-adapter.ts`）；拖动移动；Transform 手柄缩放/旋转；Delete/Backspace 删除；选中边后拖动端点重连、拖动拐点编辑路径。选择真源 `src/stores/selection-store.ts`（保序，首元素为锚点）。
- 前置条件：图元已存在于当前页；背景页图元不可在前景页选择/交互。
- 成功结果：移动/缩放/旋转手势结束各产生一条命令（down→up 合并）；缩放最小尺寸按 ShapeDefinition.minSize 钳制（X6 Transform 部件级）；Shift 缩放在 keepAspectOnShiftResize 形状（图片/椭圆）上保持纵横比；旋转角度规范化 0≤a<360；删除节点连带删除其全部关联边；切换页自动清空选择。
- 失败反馈：命令目标不存在时抛「命令目标不存在。」（文档与历史均不变）。
- 撤销边界：一次拖拽/缩放手势/旋转手势/重连/拐点/删除各一条记录；一次删除多个图元只产生一条「删除图元」记录。
- 数据字段：`CellMove`/`CellResize`/`CellRotate` before/after（`src/application/commands/{move-cells,resize-cells,rotate-cells}.ts`）；删除快照（`src/application/commands/delete-cells.ts`）；`selectedIds`（`src/stores/selection-store.ts`）。
- 自动化测试位置：`tests/unit/editor/commands/*`（move-cells/resize-rotate/delete-cells/reconnect-vertices）、`tests/unit/stores/selection-store.test.ts`、`tests/unit/stores/document-store.test.ts`。

## 5. 剪贴板（应用内复制/剪切/粘贴）

- 入口：Ctrl+C/X/V（macOS Cmd；`src/ui/canvas/CanvasArea.vue` 键盘接线）→ document-store `copySelection`/`cutSelection`/`pasteClipboard`；纯函数层 `src/application/clipboard/clipboard-service.ts`。
- 前置条件：复制/剪切需存在选中图元；粘贴需应用内剪贴板非空。
- 成功结果：复制保留源与目标均在复制集内的边（详细设计 §10.3）；剪切 = 复制 + 一条「删除图元」命令；粘贴生成全部新 UUID、边端点按旧→新 ID 映射重写、整体偏移 12pt×粘贴序号（同一 payload 连续粘贴逐次偏移）、落在页面最上层。
- 失败反馈：剪贴板为空时粘贴仅提示「剪贴板为空。」（document-store lastNotice；toast 机制后续）。
- 撤销边界：一次粘贴一条「粘贴图元」记录（含多个图元）；剪切为一条删除记录；复制不产生命令。
- 数据字段：`ClipboardPayload { nodes, edges }`（深拷贝，仅内部边）；document-store `clipboard`/`pasteCount`/`lastNotice`。
- 自动化测试位置：`tests/unit/editor/clipboard/clipboard-service.test.ts`、`tests/unit/stores/document-store.test.ts`。

## 6. 文字与样式（标签输入/字体样式/对齐/格式刷）

- 入口：覆盖式文本编辑器 `src/ui/text/TextEditorOverlay.vue`（双击节点 / 选中单节点按 F2 或 Enter / 双击边编辑首标签，画布接线 `src/ui/canvas/CanvasArea.vue`）；文本样式控件在紧凑工具栏字体/段落对齐组 `src/ui/toolbar/CompactToolbar.vue` 与属性面板文本区 `src/ui/inspector/PropertyTab.vue`；会话状态机 `src/application/text/text-session.ts`。
- 前置条件：节点或边已存在；进入编辑时该图元可为空文本（以默认 TextContent 开始）。
- 成功结果：编辑镜像当前字体样式并按文本区就地覆盖显示；Esc 取消（文档不变），失焦或 Ctrl/Cmd+Enter 提交，Enter 在文本内换行；IME 组合过程不入撤销栈（组合中失焦挂起，上屏后提交）；提交有变更才写文档。批量文本样式（字体/字号/B/I/U/S/字体色/背景色/水平垂直对齐/方向/四边距/段前段后行距）一次控件变更作用于全部选中节点与选中边首标签；多选一致显示值、不一致显示「多个值」（不定态）、无文本禁用。竖排为逐字排版（每字符一行，源文本换行视为换列空行占位），不旋转整段。
- 失败反馈：提交文本超过 MAX_TEXT_LENGTH（10000）抛「文本长度超出限制。」（通知栏提示，文档不变）。
- 撤销边界：一次编辑会话一条「编辑文本」记录（未变更不产生）；一次控件变更的全部目标合并为一条「文本样式」记录；编辑期间画布快捷键挂起。
- 数据字段：`TextContent/TextStyle/TextBlock/TextParagraph`（`src/domain/diagram.ts`）；`EditTextCommand`（`src/application/commands/edit-text.ts`，node 与 edgeLabel 目标，edgeLabel 可追加新标签）；`TextStyleCommand`（`src/application/commands/text-style-command.ts`，style/block/paragraph 三段浅合并）；聚合 `aggregateTextStyles`（`src/application/inspector/aggregate-style.ts`）；目标构建 `buildTextStyleTargets`（`src/application/inspector/text-style-targets.ts`）；渲染布局 `layoutText/textAreaForNode`（`src/infrastructure/x6/text-layout.ts`）。
- 自动化测试位置：`tests/unit/editor/text/text-session.test.ts`、`tests/unit/editor/commands/edit-text.test.ts`、`tests/unit/editor/commands/text-style-command.test.ts`、`tests/unit/editor/aggregate-style.test.ts`、`tests/unit/editor/text-style-targets.test.ts`、`tests/unit/editor/text-layout.test.ts`、`tests/unit/editor/cell-mapper-text.test.ts`、`tests/component/TextEditorOverlay.test.ts`、`tests/component/CompactToolbar.test.ts`、`tests/component/PropertyTab.test.ts`、`tests/unit/editor/format-paint.test.ts`、`tests/unit/stores/format-paint-store.test.ts`。

### 6.1 格式刷

- 入口：紧凑工具栏「格式刷」按钮（`src/ui/toolbar/CompactToolbar.vue`）：单击 `armOnce`（恰好 1 个选中图元否则禁用）、双击 `armContinuous`（橙色 continuous 态）、Esc 全局取消（输入控件聚焦/文本编辑中不拦截）；应用到目标由画布点击触发（`src/ui/canvas/CanvasArea.vue`，点击空白或 Esc 取消，mode≠off 时画布容器加 `format-painting` 类、选择被抑制）；状态机 `src/stores/format-paint-store.ts`。
- 前置条件：源为恰好 1 个选中图元；目标与源同类型（节点→节点、边→边）。
- 成功结果：复制填充/填充透明度/边框色/边框宽/虚线/圆角/阴影（节点样式全键）与字体/文本块/段落；边复制 EdgeStyle 全键；类型不匹配目标跳过，全部不匹配或无变化不产生命令；once 应用后自动退出，continuous 保持至 Esc/空白点击。
- 失败反馈：无效目标（类型不匹配/不存在/无变化）不动作且不退模式。
- 撤销边界：一次应用一条「格式刷」记录（多目标一次应用也只一条），撤销一步全部恢复。
- 数据字段：`FormatPaintSnapshot { nodeStyle?/edgeStyle?/text? }`（`src/application/commands/apply-format-paint.ts`）；`mode/sourceCellId`（`src/stores/format-paint-store.ts`）。
- 自动化测试位置：`tests/unit/editor/format-paint.test.ts`、`tests/unit/stores/format-paint-store.test.ts`、`tests/component/CompactToolbar.test.ts`。

## 7. 形状与边样式（填充/边框/阴影/线型/箭头）

- 入口：属性面板 `src/ui/inspector/PropertyTab.vue` 样式区（节点：填充色/填充透明度/边框色/边框宽度/虚线/圆角/阴影五参）与边属性区（线条颜色/宽度/透明度/线型/起始箭头/结束箭头/连接类型/标签文本）；右侧面板容器 `src/ui/inspector/RightPanel.vue`。
- 前置条件：选中至少一个节点（样式区）或至少一条边（边属性区）；节点多选与边混选时仅显示共有可操作区。
- 成功结果：样式写入立即重渲染（cell-mapper 映射为 X6 attrs：填充/描边/虚线 dasharray/圆角 rx/阴影 dropShadow/箭头 block marker）；多选聚合一致显示值、不一致显示「多个值」（颜色混合标记）；连线类型直线/直角/曲线切换经 X6 connector 生效；边标签文本失焦写入（无标签时追加 position 0.5）。
- 失败反馈：命令目标不存在时抛「命令目标不存在。」（文档与历史均不变）。
- 撤销边界：一次控件变更的全部目标合并为一条「应用样式」记录；连线类型变更合并为一条「连线类型」记录；标签文本一次失焦提交一条「编辑文本」记录。
- 数据字段：`NodeStyle`（fill/fillOpacity/stroke/strokeWidth/strokeDash/cornerRadius/shadow）与 `EdgeStyle`（stroke/strokeWidth/opacity/dash/sourceArrow/targetArrow）、`DiagramEdge.connector`（`src/domain/diagram.ts`）；`ApplyStyleCommand`（`src/application/commands/apply-style.ts`）；`UpdateEdgeConnectorCommand`（`src/application/commands/update-edge-connector.ts`）；聚合 `aggregateNodeStyles/aggregateField`（`src/application/inspector/aggregate-style.ts`）。
- 自动化测试位置：`tests/unit/editor/commands/apply-style.test.ts`、`tests/unit/editor/commands/update-edge-connector.test.ts`、`tests/unit/editor/aggregate-style.test.ts`、`tests/component/PropertyTab.test.ts`、`tests/component/RightPanel.test.ts`、`tests/unit/editor/cell-mapper-text.test.ts`。

## 8. 排列（对齐/等距/层序/组合/容器/自动连线）

- 入口：application 层全部就绪（`src/application/arrangement/*`、`src/application/commands/{group-cells,container-membership}.ts`）；菜单栏/右键菜单入口 Task 8 接线。容器移动时成员一起移动由画布手势层完成（`src/ui/canvas/CanvasArea.vue` onNodeMoved 收集后代 id 并入同一条移动命令）。
- 前置条件：对齐 ≥2 个选中节点；等距 ≥3；自动连线 ≥2（容器除外）；组合 ≥2；加入容器要求目标为 isContainer 节点。
- 成功结果：对齐以**选择序列第一个图元**为基准（左/水平居中/右/顶/垂直居中/底）；等距按轴几何顺序排序、固定最外两个、相邻边界间空隙相等（`gap=(last.start−first.end−Σmiddle.size)/(n−1)`）；层序四动作（置顶=最大 zIndex+1…/置底/上移一层=相邻交换/下移一层）执行后全页规范化为 1..n；自动连线按选择顺序生成 n−1 条边（页面默认连线类型与箭头，端口为互相对侧最近端口，autoConnectLabel 开时带空标签）；组合创建 group 容器节点（bbox=成员外接矩形，成员 parentId 指向之，ID/数据保留，嵌套允许）；取消组合还原；加入/移出容器显式改变 parentId。
- 失败反馈：等距 <3 图元抛「等距排列至少需要三个图元。」；间距不足抛「间距不足，无法等距排列。」；非容器目标抛「目标节点不是容器。」；循环成员关系抛「加入容器会形成循环。」；对齐/自动连线/组合有效节点不足时不产生命令（UI 禁用）。
- 撤销边界：对齐/等距/层序/自动连线/组合/取消组合/加入容器/移出容器各为一条记录（自动连线一次撤销删除全部新边；层序含规范化改号的未选中图元精确还原）。
- 数据字段：`AlignMode/DistributeMode/ZOrderAction`（`src/application/arrangement/*`）；group 形状定义（`src/application/shapes/common-shapes.ts`，透明填充虚线边框、无端口、不入图元库）；`DiagramNode.parentId/isContainer`（`src/domain/diagram.ts`）；cell-mapper `parentId` 元数据与 `relativePositionFor`（`src/infrastructure/x6/cell-mapper.ts`）。
- 自动化测试位置：`tests/unit/editor/arrangement/*`（align-cells/distribute-cells/z-order/auto-connect/descendants）、`tests/unit/editor/group-cells.test.ts`、`tests/unit/editor/container-membership.test.ts`、`tests/unit/editor/shapes/shape-registry.test.ts`、`tests/unit/editor/cell-mapper.test.ts`。

## 9. 属性和数据（右侧面板/几何显示/业务数据）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：实现后补全（规划：`tests/component/RightPanel.test.ts`）

## 10. 发现与帮助（查找替换/右键菜单/tooltip/帮助注册表）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：已实现首批——`tests/unit/editor/help-registry.test.ts`；其余（`tests/unit/editor/search/*`、`tests/component/CanvasContextMenu.test.ts`）实现后补全

## 11. 输出（SVG/PNG/PDF/JSON 导出）

- 入口：实现后补全
- 前置条件：实现后补全
- 成功结果：实现后补全
- 失败反馈：实现后补全
- 撤销边界：实现后补全
- 数据字段：实现后补全
- 自动化测试位置：实现后补全（规划：`tests/unit/editor/export/*`、Rust 导出单测）
