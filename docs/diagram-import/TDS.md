# 可编辑通用视觉流程图导入 技术设计文档（TDS）

**版本：** 0.1

**状态：** **待实现**

**发布日期：** 未发布

**关联 PRD：** [`PRD.md`](./PRD.md)

**设计来源：** [`../superpowers/specs/2026-08-01-editable-visual-diagram-import-design.md`](../superpowers/specs/2026-08-01-editable-visual-diagram-import-design.md)

> **待实现声明：** 本文定义规划中的技术方案和目标契约。除“当前架构”明确引用的既有模块外，本文中的导入模块、接口、数据结构、任务、预览和历史协调能力均尚未实现。

## 1. 技术背景

当前应用使用 Tauri 2、Vue 3、Pinia 和 AntV X6。`DiagramDocument` 是文档真源，文档和命令使用 pt 坐标，X6 只负责运行时渲染与手势。文件保存前通过 `validateDiagramDocument()` 校验。

当前历史由 `PageManager` 按页面维护 `CommandHistory`，`document-store.executeCommand()` 将命令放入活动页历史。该结构不能直接表达一次跨多个页面的导入行为，因此本需求除导入流水线外，还必须增加文档级命令和全局用户行为协调。

## 2. 设计目标

1. 不同源格式通过适配器转换为统一源场景。
2. 矢量解析、OCR、传统视觉和模型共享一套证据与中间模型。
3. 不完整识别结果可在独立预览会话中编辑。
4. 确认前不接触正式 `DiagramDocument`。
5. 提交前完成领域校验并以一条命令原子写入。
6. 跨页导入遵守全局真实用户行为顺序撤销和重做。
7. 默认本地运行；当前安全策略下不实现网络上传。
8. 支持通过标注样本、结构评分、性能基线和版本回归持续演进。

## 3. 非目标与约束

- 不把 X6 JSON 或 Cell 作为导入中间格式。
- 不让格式适配器直接构造正式领域文档。
- 不让 OCR 或模型结果直接覆盖用户修改。
- 不允许提交部分页面或部分元素。
- 不通过整页图片伪装成可编辑导入。
- 不在当前阶段选择或启用云端供应商。
- 不绕过现有 schema、形状、引用和数量校验。
- 不改变 `.flowdiagram` schema 以保存识别会话或模型证据。

## 4. 总体架构

```text
Vue Import UI
  │
  ▼
ImportWorkflowController
  │
  ├─ SourceAdapterRegistry ──► SVG/PDF/Raster adapters
  │
  ├─ RecognitionPipeline ───► OCR/geometry/arrow/model stages
  │
  ├─ StructureResolver
  │
  ├─ ImportSessionStore ────► preview-only undo/redo
  │
  └─ DiagramConverter
          │
          ▼
    validateDiagramDocument
          │
          ▼
    ImportDiagramCommand
          │
          ▼
    HistoryCoordinator
          │
          ▼
    document-store / autosave / X6 projection
```

### 4.1 分层职责

| 层 | 职责 | 禁止事项 |
|---|---|---|
| `domain` | 复用正式文档类型和校验 | 不依赖 OCR、PDF、X6、Tauri |
| `application/import` | 中间模型、会话、结构推理、转换、用例与端口 | 不读取 DOM，不直接调用 Tauri |
| `infrastructure/import` | SVG/PDF/图片解析、OCR、视觉和模型适配 | 不修改正式文档和历史 |
| `platform` | 文件选择、任务启动、临时目录和进度桥接 | 不含结构推理规则 |
| `ui/import` | 导入对话、进度、预览和问题编辑 | 不直接解析文件或构造领域命令 |

### 4.2 建议目录

```text
src/
  application/import/
    import-types.ts
    source-adapter.ts
    source-adapter-registry.ts
    recognition-stage.ts
    recognition-pipeline.ts
    structure-resolver.ts
    import-session.ts
    import-workflow-controller.ts
    diagram-converter.ts
    import-errors.ts
  application/commands/
    import-diagram.ts
    history-coordinator.ts
  infrastructure/import/
    svg-source-adapter.ts
    pdf-source-adapter.ts
    raster-source-adapter.ts
    local-ocr-adapter.ts
    geometry-detector.ts
    arrow-detector.ts
  platform/
    import-platform.ts
    tauri-import-platform.ts
  stores/
    import-session-store.ts
  ui/import/
    ImportDialog.vue
    ImportProgress.vue
    ImportReviewWorkspace.vue
    ImportSourcePane.vue
    ImportDraftPane.vue
    ImportIssuesPanel.vue
src-tauri/src/
  commands/import_commands.rs
  import/
    source_probe.rs
    resource_limits.rs
    temp_session.rs
tests/
  fixtures/import/
  unit/editor/import/
  component/import/
e2e/
  import-diagram.spec.ts
```

目录名称是目标结构，实施时保持一个文件一个职责，不要求一次提交全部空模块。

## 5. 核心数据流

```text
ImportSource
  → probe and validate
  → SourceDocument
  → RecognitionEvidence[]
  → ImportDocument draft
  → StructureResolver
  → ImportIssue[]
  → ImportSession edits
  → DiagramDocument candidate
  → validated after snapshot
  → atomic command
```

### 5.1 输入探测

平台层先返回文件句柄或受控路径及基础元数据。后端执行：

1. 魔数与扩展名一致性检查。
2. 文件大小和页数上限检查。
3. SVG/XML 或 PDF 基础安全探测。
4. 按页确定矢量、混合或扫描类型。
5. 创建随机导入会话临时目录。

探测失败不创建 `ImportSession`，也不读取当前文档快照。

## 6. 源适配器

### 6.1 端口

```ts
export interface ImportSource {
  sessionId: string
  name: string
  mediaType: string
  size: number
  handle: ImportSourceHandle
}

export interface ImportSourceAdapter {
  readonly id: string
  supports(source: ImportSource): boolean
  extract(source: ImportSource, signal: AbortSignal): Promise<SourceDocument>
}

export class SourceAdapterRegistry {
  register(adapter: ImportSourceAdapter): void
  resolve(source: ImportSource): ImportSourceAdapter
}
```

`supports()` 只依据已校验媒体类型和探测结果，不重新信任扩展名。未命中适配器时返回类型化“不支持格式”错误。

### 6.2 原始场景

```ts
export interface SourceDocument {
  sourceName: string
  pages: SourcePage[]
  diagnostics: SourceDiagnostic[]
  extractorVersion: string
}

export interface SourcePage {
  id: string
  index: number
  width: number
  height: number
  unit: 'pt' | 'px' | 'source'
  transformToPt: Matrix2D
  mode: 'vector' | 'mixed' | 'raster'
  primitives: SourcePrimitive[]
  raster?: RasterReference
}

export type SourcePrimitive =
  | SourcePath
  | SourceText
  | SourceImage
  | SourceGroup
```

所有嵌套变换在适配器中正规化为页面坐标，同时保留来源变换用于诊断。页面尺寸和坐标转换必须是有限值。

### 6.3 SVG 适配器

- 使用安全 XML 解析，不执行脚本。
- 拒绝事件处理器、外部 URL、外部样式和动态引用。
- 展开 `transform` 层级并保留分组关系。
- 提取 `path`、基础几何、文本、图片和可见样式。
- 对 `<use>` 只解析同文档安全引用，限制递归深度。
- 未支持的滤镜和装饰进入诊断，不影响可解释主体提取。

### 6.4 PDF 适配器

- 逐页提取文本、路径、图片和变换。
- 矢量页保留原生文本及路径。
- 混合页只对嵌入图片区域运行视觉识别。
- 扫描页安全栅格化后进入位图流水线。
- 密码保护或解析失败返回明确错误，不尝试绕过保护。

PDF 解析依赖必须在实施阶段通过应用专属资格样本、离线能力、许可证、Windows/macOS 打包和资源限制评审后采用。适配器端口保证依赖更换不影响应用层。

### 6.5 位图适配器

阶段二支持 PNG、JPEG、WebP：

- 校验魔数、尺寸、颜色空间和解码后内存上限。
- 统一方向元数据。
- 建立源像素到 pt 的确定性转换。
- 保留原图引用用于预览，不将原图写入正式文档；只有某区域经用户明确确认降级时才允许生成图片节点。

## 7. 识别流水线

### 7.1 阶段接口

```ts
export interface RecognitionContext {
  page: SourcePage
  evidence: readonly RecognitionEvidence[]
  artifacts: RecognitionArtifacts
  signal: AbortSignal
}

export interface RecognitionStage {
  readonly id: string
  readonly version: string
  run(context: RecognitionContext): Promise<RecognitionEvidence[]>
}
```

每个阶段：

- 输入不可变上下文。
- 只追加证据，不修改其他阶段输出。
- 检查取消信号。
- 产出版本和耗时诊断。
- 失败时返回类型化页面或阶段错误。

### 7.2 执行顺序

```text
NormalizePageStage
  → TextExtractionStage / LocalOcrStage
  → ShapeContourStage
  → LineAndCurveStage
  → ArrowStage
  → ShapeClassificationStage
  → TextOwnershipStage
  → EndpointCandidateStage
  → ContainerCandidateStage
```

矢量页跳过不需要的 OCR 和轮廓恢复。位图页分别生成保留文字和移除文字的工作图，避免文字笔画干扰轮廓和连线检测。

### 7.3 证据结构

```ts
export interface RecognitionEvidence {
  id: string
  stageId: string
  stageVersion: string
  pageId: string
  kind: 'node' | 'edge' | 'text' | 'group' | 'relation'
  sourceBounds: Bounds
  confidence: number
  payload: Record<string, unknown>
  references: string[]
}
```

证据只存在于导入会话，不写入 `.flowdiagram`。

## 8. 导入中间模型

```ts
export interface ImportDocument {
  source: ImportSourceMetadata
  pages: ImportPage[]
  issues: ImportIssue[]
  componentVersions: Record<string, string>
}

export interface ImportPage {
  id: string
  sourcePageId: string
  name: string
  widthPt: number
  heightPt: number
  elements: ImportElement[]
}

export type ImportElement =
  | ImportNode
  | ImportEdge
  | ImportText
  | ImportGroup
  | ImportFallbackRegion

export interface ImportConfidence {
  detection: number
  classification: number
  text: number
  relation: number
  hierarchy: number
  overall: number
}

export interface ImportElementBase {
  id: string
  sourcePageId: string
  sourceBounds: Bounds
  confidence: ImportConfidence
  evidenceIds: string[]
  reviewState: 'unreviewed' | 'user-confirmed' | 'user-modified' | 'ignored'
  warnings: ImportWarning[]
}
```

中间模型允许缺少端点、未知类型、悬空文字和冲突层级。正式领域模型不承担这些临时状态。

`ImportFallbackRegion` 还必须保存处理决策：

```ts
export type FallbackDisposition =
  | 'unresolved'
  | 'retry-requested'
  | 'manual-structure'
  | 'image-approved'
  | 'excluded'

export interface ImportFallbackRegion extends ImportElementBase {
  kind: 'fallback-region'
  disposition: FallbackDisposition
  exclusionReason?: string
}
```

默认值为 `unresolved`。图片节点转换只接受 `image-approved`；`excluded` 不进入正式文档，但必须进入导入报告和评分输入。

## 9. 结构解析器

### 9.1 输入与输出

```ts
export interface StructureResolver {
  resolve(page: SourcePage, evidence: readonly RecognitionEvidence[]): ImportPageResolution
}

export interface ImportPageResolution {
  page: ImportPage
  issues: ImportIssue[]
}
```

### 9.2 解析规则

- 节点候选按轮廓重合度、来源分组和类型证据去重。
- 端点位于节点边界容差范围内时建立连接候选。
- 箭头方向决定源端和目标端；无箭头时生成方向确认问题。
- 线条穿过节点但端点不靠近边界时不连接。
- 两线相交默认仅交叉；只有源语义、连接点或明确断点支持时建立连接。
- 节点内部文字优先归属节点。
- 靠近连接路径中段的文字优先归属边标签。
- 外层大闭合轮廓包含多个节点时生成容器候选，不吞并内部节点。
- 候选冲突保留最高确定性结果并生成可定位问题。

容差统一在 pt 坐标中计算，并由样本集校准；不得在不同适配器中维护不同语义规则。

### 9.3 确定性

- 所有候选排序使用稳定 ID 和明确次序。
- 相同分数使用固定 tie-break 规则。
- 模型只提供候选证据，不直接决定最终图结构。
- 组件版本记录在导入会话和验收报告中。

## 10. 问题模型

```ts
export type ImportIssueSeverity = 'blocking' | 'structural' | 'text' | 'visual'

export interface ImportIssue {
  id: string
  pageId: string
  severity: ImportIssueSeverity
  code: string
  message: string
  elementIds: string[]
  sourceBounds?: Bounds
  resolution: 'open' | 'resolved' | 'accepted'
}
```

领域非法问题只能通过修正解决，不能标记为接受。视觉或非结构性差异可由用户明确接受。

## 11. 预览会话

### 11.1 状态机

```text
idle
  → probing
  → extracting
  → recognizing
  → resolving
  → reviewing
  → validating
  → committing
  → completed

任意提交前状态 → cancelling → cancelled
任意处理状态   → failed
```

### 11.2 会话数据

```ts
export interface ImportSession {
  id: string
  status: ImportTaskStatus
  source: SourceDocument
  draft: ImportDocument
  undoStack: ImportEdit[]
  redoStack: ImportEdit[]
  progress: ImportProgress
  error?: ImportError
}
```

预览编辑由 `ImportEdit` 表示，与正式 `EditorCommand` 分离。一次节点类型修改、文字修正或重连分别形成一条预览撤销记录。

### 11.3 并发规则

- 一个应用窗口同一时间只允许一个活动导入会话。
- 识别任务运行在 Tauri 工作线程或受控 sidecar，不阻塞 WebView。
- 页面可并行处理，但最终按源页面索引稳定合并。
- 取消使用 `AbortSignal` 和后端取消令牌共同传播。
- `committing` 状态禁止关闭预览、重复确认或启动第二次提交。

### 11.4 UI 数据边界

Vue 组件只调用 `ImportWorkflowController` 和 `ImportSessionStore`：

- 来源区读取安全预览资源。
- 重建区从 `ImportDocument` 投影，不复用正式文档 store。
- 问题面板通过 issue ID 调用应用层编辑动作。
- 同步定位使用共享预览视口变换，不修改正式页面视口。

## 12. 正式文档转换

### 12.1 转换器

```ts
export interface DiagramConversionInput {
  current: DiagramDocument
  imported: ImportDocument
  target: 'append-pages' | 'merge-active-page'
}

export interface DiagramConverter {
  convert(input: DiagramConversionInput): DiagramDocument
}
```

首期 UI 默认使用 `append-pages`：每个源页面追加为一个新 `DiagramPage`，避免与当前活动页已有几何重叠。`merge-active-page` 只有在产品入口明确提供并补齐定位规则后启用。

### 12.2 映射规则

- 页面和图元生成 UUIDv4。
- 坐标通过 `transformToPt` 转换为 pt。
- 基础形状映射到 `ShapeRegistry` 已注册类型。
- 未知闭合轮廓优先映射为可编辑通用路径节点。
- 无法结构化区域只有在 `disposition === 'image-approved'` 时映射为图片节点。
- 用户拒绝图片降级时保持 `unresolved`，转换器不得自动忽略或替换。
- `excluded` 区域不映射为图元，但必须写入导入报告并计入完整度和验收评分。
- 文本映射为 `TextContent`，缺失样式使用应用默认值。
- 连接线映射为 `DiagramEdge`，端点必须引用已生成节点。
- 容器关系映射为 `parentId/isContainer`，提交前检查循环。
- zIndex 按来源绘制顺序稳定分配。
- 页面名称由源文件名和源页码生成，并经过现有页面名称约束处理。

### 12.2.1 拒绝图片降级

用户拒绝图片降级后可执行四类动作：

1. 手动把区域标注为节点、文字、连线、容器或分组。
2. 调整区域或识别参数后局部重新识别。
3. 明确排除该区域并填写或选择排除原因。
4. 取消整个导入会话。

`unresolved` 和 `retry-requested` 不能进入正式转换。`excluded` 可以跳过转换，但提交前必须重新执行结构完整性检查；如果排除造成断线、非法层级、悬空引用或其他领域非法结果，则生成 blocking issue 并拒绝提交。

### 12.3 校验

```text
ImportDocument
  → convert to candidate
  → validateDiagramDocument(candidate, shapeContext)
  → success: command construction
  → failure: typed issue, session remains reviewing
```

校验失败不得尝试删除问题元素后自动提交。

## 13. 原子命令与历史协调

### 13.1 导入命令

```ts
export class ImportDiagramCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '导入流程图'

  constructor(
    private readonly before: DiagramDocument,
    private readonly after: DiagramDocument,
  ) {}

  apply(): DiagramDocument {
    return structuredClone(this.after)
  }

  revert(): DiagramDocument {
    return structuredClone(this.before)
  }
}
```

命令持有确认时的不可变 before/after 快照。实现阶段应通过性能基线评估大文档快照内存；在不改变命令语义的前提下可改为结构共享。

### 13.2 历史协调器

当前页面历史仍保留，但所有正式命令必须经统一协调器执行：

```ts
export type HistoryScope =
  | { kind: 'page'; pageId: string }
  | { kind: 'document' }

export interface HistoryEntry {
  sequence: number
  scope: HistoryScope
  command: EditorCommand
}

export interface HistoryCoordinator {
  execute(scope: HistoryScope, command: EditorCommand, document: DiagramDocument): DiagramDocument
  undo(document: DiagramDocument): DiagramDocument | null
  redo(document: DiagramDocument): DiagramDocument | null
}
```

协调规则：

1. `sequence` 单调递增，记录真实用户行为顺序。
2. 页面命令仍标记所属页，文档导入命令标记 `document`。
3. 撤销选择全局 undo 栈最后一项，不依赖当前活动页。
4. 重做选择全局 redo 栈最后一项。
5. 执行新行为清空全局 redo 分支及相关作用域 redo。
6. 协调器是正式命令执行、撤销和重做的唯一入口，避免页面栈与全局顺序漂移。
7. 文档命令应用或回退后调用 `PageManager.syncFromDocument()`，活动页失效时回退到有效页面。
8. 导入命令执行、撤销和重做均通过现有 revision 跟踪更新 dirty。

实施时先以测试锁定现有页面级行为，再引入协调器。禁止仅把导入命令塞入确认时的活动页历史。

### 13.3 提交事务

```text
freeze session
  → reject unresolved blocking issues
  → capture before
  → convert after
  → validate after
  → construct ImportDiagramCommand
  → HistoryCoordinator.execute(document scope)
  → sync PageManager and active page
  → clear selection
  → dirty/revision/autosave notification
  → release session
```

任一步骤抛错时，命令不入栈，正式文档引用保持不变，预览会话恢复到 `reviewing`。

## 14. 平台与任务端口

```ts
export interface ImportPlatform {
  chooseSource(): Promise<ImportSource | null>
  probe(source: ImportSource): Promise<ImportProbeResult>
  createPreviewUrl(ref: RasterReference): Promise<string>
  removePreviewUrl(url: string): void
  cancel(sessionId: string): Promise<void>
  cleanup(sessionId: string): Promise<void>
}
```

Tauri command 只接收已选择的受控路径或句柄。路径校验、临时目录、资源限制和解析任务位于 Rust 端；前端不直接读取任意路径。

## 15. 错误处理

### 15.1 类型

```ts
export type ImportErrorKind =
  | 'unsupported'
  | 'invalid-source'
  | 'protected-source'
  | 'resource-limit'
  | 'extract-failed'
  | 'recognition-failed'
  | 'cancelled'
  | 'validation-failed'
  | 'commit-failed'
```

### 15.2 行为

| 错误 | 会话 | 正式文档 | 用户反馈 |
|---|---|---|---|
| 文件无效或受保护 | 不进入预览 | 不变 | 显示原因和支持格式 |
| 单页矢量解析失败 | 页面降级到安全栅格识别 | 不变 | 标记该页降级 |
| 单页识别失败 | 保留来源页和问题 | 不变 | 允许重试、标注或删除该导入页 |
| 元素无法识别 | 降级保留 | 不变 | 显示问题及处理方式 |
| 用户拒绝图片降级 | 保持未解决 | 不变 | 提供手动结构化、局部重识别、明确排除和取消 |
| 用户明确排除区域 | 写入导入报告并重算完整度 | 不变 | 若破坏结构合法性则继续阻断 |
| 最终校验失败 | 保留 reviewing | 不变 | 定位领域非法项 |
| 提交失败 | 保留 reviewing | 不变 | 提示重试，不产生历史 |

不吞掉异常，不在错误后自动删除来源内容。

## 16. 安全设计

### 16.1 文件安全

- 只接受允许列表格式及匹配魔数。
- 限制文件大小、页数、单页像素、对象数量、递归深度和展开大小。
- SVG 禁止脚本、事件、外部资源和危险 URL。
- PDF 禁止嵌入动作，不绕过密码保护。
- 图片解码和栅格化运行在资源受限任务中。
- 错误消息不回显源文件敏感内容。

### 16.2 临时数据

- 临时目录位于应用缓存范围并使用随机会话 ID。
- 预览 URL 可撤销，不暴露原始文件路径。
- 完成、取消和启动清理时删除过期会话。
- 日志只记录阶段、耗时、版本、错误码和数量，不记录图像或 OCR 文本。

### 16.3 云端门禁

当前产品基线禁止上传用户图文件或元数据：

- 只定义 `ImportEnhancementProvider` 端口。
- 不注册网络 Provider。
- 不添加上传权限、网络域名或凭据。
- 阶段四必须重新进行产品、安全、隐私、费用和供应商评审。

## 17. 资源限制

限制值通过阶段一性能基线和目标设备测试固化。实现要求：

- 每项限制具有配置常量和边界测试。
- 超限时报告实际值与允许值。
- 不静默降分辨率、跳页或裁切。
- 任务支持取消和超时。
- 部分页完成不代表可以绕过阻断问题提交。

## 18. 可观测性

本地诊断记录：

- 会话 ID，不记录源路径和内容。
- 适配器、识别阶段及组件版本。
- 各阶段耗时、页数、候选数、问题数和峰值资源摘要。
- 降级路径和错误码。
- 用户是否取消或确认，不记录用户修正文本。

导入报告可包含对象数量和未处理问题，但不得包含敏感源内容，除非用户主动导出报告且另有明确设计。

## 19. 测试设计

### 19.1 单元测试

- 格式探测、坐标变换、SVG 安全过滤和 PDF 页面分类。
- OCR 适配器结果标准化。
- 轮廓、线条、箭头、文字归属和端点候选。
- 结构解析稳定排序、交叉线和容器规则。
- 中间模型编辑和问题状态转换。
- 无法结构化区域的五种 disposition、图片确认门禁和排除报告。
- DiagramConverter 的 UUID、pt、形状、文字、边和层级映射。
- ImportDiagramCommand apply/revert 不修改输入。
- HistoryCoordinator 跨页面与文档作用域顺序。

### 19.2 原子历史测试

必须覆盖：

- 一个元素和数百个元素都只增加一条正式历史。
- 多页导入一次撤销恢复原页面集合、顺序和内容。
- 导入到已有文档后撤销恢复原始快照。
- 撤销后重做恢复相同结果。
- 导入后切换页面仍撤销导入。
- 导入前后夹杂不同页面命令时按全局 sequence 撤销。
- 撤销后新建命令清空所有相关 redo 分支。
- 校验失败不改变 revision、dirty 和历史标签。
- 保存点、自动恢复 token 和撤销导入后的 dirty 判断正确。

### 19.3 组件测试

- 三栏预览与多页状态。
- 来源区和重建区同步定位。
- 问题筛选、定位、修正和接受。
- 低置信度样式及无障碍名称。
- 识别中取消、预览取消和提交防重复。
- 阻断问题确认门禁。
- 拒绝图片降级后的四种处理入口，以及排除导致结构非法时继续阻断。

### 19.4 端到端测试

```text
导入 SVG
  → 等待识别
  → 修正节点类型
  → 修正断线
  → 确认
  → 保存
  → 关闭并重开
  → 校验结构
  → 撤销/重做导入
```

另覆盖多页 PDF、损坏文件、资源超限、取消、页面降级、应用关闭和临时目录清理。

### 19.5 90% 评分

验收工具输入源文件、标准 `DiagramDocument` 和实际结果，输出：

- 节点检测、召回和类型准确率。
- 连接端点、方向和标签归属准确率。
- OCR 字符错误率、完整文本和归属准确率。
- 页面、容器和分组准确率。
- 加权总分和逐样本差异。

调参集和验收集分离；每次更新解析器、OCR、模型或结构规则都运行完整验收集并生成差异报告。

## 20. 实施顺序

### 20.1 阶段一

1. 建立标注样本格式和评分骨架。
2. 以测试锁定现有页面历史并实现 `HistoryCoordinator`。
3. 实现导入中间模型、问题模型和预览会话。
4. 实现安全探测与 SVG 适配器。
5. 实现矢量 PDF 适配器资格验证和接入。
6. 实现基础结构解析器。
7. 实现三栏预览和校对动作。
8. 实现 DiagramConverter、原子提交和撤销。
9. 完成组件、E2E、安全、评分和性能门禁。

### 20.2 后续阶段

- 阶段二：位图预处理、本地 OCR 和传统视觉。
- 阶段三：本地模型和复杂结构增强。
- 阶段四：另行批准后的云端增强。
- 阶段五：VSDX、draw.io 等结构适配器。

## 21. 需求追踪

| PRD 范围 | TDS 模块 |
|---|---|
| `IMP-FILE-*` | 源探测、SourceAdapterRegistry、平台端口 |
| `IMP-REC-*` | RecognitionPipeline、证据模型、StructureResolver |
| `IMP-REV-*` | ImportSession、预览 UI、问题模型 |
| `IMP-ISS-*` | ImportIssue、错误处理和降级 |
| `IMP-COM-*` | DiagramConverter、ImportDiagramCommand、HistoryCoordinator |
| `IMP-PRV-*` | 安全设计、临时数据和云端门禁 |

## 22. 完成门禁

- [ ] 阶段一模块和接口已实现
- [ ] P0 需求均有测试证据
- [ ] 预览确认后结构语义评分达到 PRD 门槛
- [ ] 原子导入和跨页撤销矩阵通过
- [ ] 文件安全、资源限制和临时清理通过
- [ ] 完整 Vitest、Rust、E2E 和生产构建无新增失败
- [ ] `features.md`、`interactions.md`、`user-guide.md`、`acceptance.md` 已同步
- [ ] PRD/TDS 状态已由“待实现”更新为真实交付状态

**当前结论：待实现。**
