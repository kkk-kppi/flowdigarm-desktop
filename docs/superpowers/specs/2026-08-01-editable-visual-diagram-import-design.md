# 可编辑通用视觉流程图导入设计

## 目标

为当前桌面流程图应用增加通用视觉导入能力，支持从 SVG、PDF、PNG、JPEG、WebP 等来源重建可编辑流程图。导入优先保证结构与语义，而不是逐像素复刻；节点、连线关系、文字内容、页面与容器层级是主要验收对象，样式和位置允许合理偏差。

系统采用本地优先策略，并预留用户明确授权后的云端增强入口。用户确认导入后，对当前 `.flowdiagram` 的全部修改必须视为一次原子用户行为，只产生一条历史记录，一次撤销完整恢复导入前文档，一次重做完整恢复导入结果。

## 已确认的产品语义

- 不论源格式，导入结果均优先可编辑。
- 本地解析、OCR、图形识别和结构推理是默认路径。
- 云端只增强低置信度区域，默认关闭，上传前必须由用户明确确认范围。
- 还原度以结构与语义为主，节点、连线、文字、页面及层级关系是主要指标。
- 导入结果先进入独立预览校对工作区，确认前不修改正式文档。
- 预览支持节点类型、文字归属、连线端点、分组及页面关系修正。
- 无法识别的内容不得静默丢弃；优先转为通用路径，图片降级必须经用户确认，明确排除必须进入导入报告并计入完整度。
- 用户确认导入是一次原子行为，遵守“一次行为一次撤回”。

## 方案选择

采用分层混合识别：能从源格式确定性提取的结构不交给模型猜测，位图使用 OCR 与传统视觉算法，本地模型处理复杂和低置信度区域，云端模型作为可选增强器。

未采用的方案：

- 纯规则与传统视觉：可解释且完全离线，但难以覆盖非标准图形、复杂连线和低质量扫描件。
- 端到端视觉模型：复杂场景适应性较好，但几何精度、稳定性、可解释性及本地部署成本不适合作为唯一主路径。

## 总体架构

```text
文件选择
   ↓
Source Adapter
   ↓
Source Scene
   ↓
Recognition Pipeline
   ↓
Import Intermediate Representation
   ↓
Structure Resolver
   ↓
Preview Session
   ↓ 用户确认
Diagram Converter
   ↓
ImportDiagramCommand
   ↓
当前 DiagramDocument
```

导入子系统位于 application/infrastructure 边界内。源文件解析、OCR、模型及栅格化属于基础设施能力；结构推理、中间模型、预览会话、转换和提交语义属于应用层。X6 只渲染预览或正式领域模型，不作为导入真源。

## 源适配器与原始场景

每种输入格式实现独立适配器：

```ts
interface ImportSourceAdapter {
  supports(input: ImportSource): boolean
  extract(input: ImportSource): Promise<SourceDocument>
}
```

首期适配器：

- `SvgSourceAdapter`：解析路径、文字、分组和变换矩阵。
- `PdfSourceAdapter`：逐页判断矢量、混合或扫描内容；优先提取矢量对象和原生文字。
- `RasterSourceAdapter`：处理 PNG、JPEG 和 WebP。

后续 `.vsdx`、`.drawio` 等结构格式只需增加适配器，仍输出统一场景。

```ts
interface SourcePage {
  id: string
  width: number
  height: number
  coordinateSystem: SourceCoordinateSystem
  primitives: SourcePrimitive[]
  raster?: RasterReference
}

type SourcePrimitive =
  | SourcePath
  | SourceText
  | SourceImage
  | SourceGroup
```

适配器只提取源内容，不直接判断业务上的节点和连接线。矢量输入保留原始几何和文字；纯位图页面由后续识别阶段产生候选。

## 识别流水线

```text
页面预处理
  → OCR
  → 轮廓和形状检测
  → 线段、折线、曲线与箭头检测
  → 图形分类
  → 文字归属候选
  → 连接端点候选
  → 容器和页面层级候选
```

识别阶段实现统一接口，只产生候选和证据，不修改正式结果：

```ts
interface RecognitionStage {
  run(context: RecognitionContext): Promise<RecognitionEvidence[]>
}
```

矢量输入直接使用路径和原生文字，只有嵌入图片及无法解释区域进入视觉识别。位图先执行方向校正、去噪和对比度增强，再分别生成保留文字和移除文字的工作图，用于 OCR 与轮廓、连线检测。

本地模型和未来云端服务实现相同的增强端口。模型结果只是证据，最终冲突由确定性的结构解析器裁决，以保证相同输入和相同组件版本得到可复现结果。

## 导入中间模型

```ts
interface ImportDocument {
  pages: ImportPage[]
  issues: ImportIssue[]
  sourceMetadata: ImportSourceMetadata
}

interface ImportPage {
  id: string
  name: string
  width: number
  height: number
  elements: ImportElement[]
}

type ImportElement =
  | ImportNode
  | ImportEdge
  | ImportText
  | ImportGroup
  | ImportFallbackRegion
```

每个元素保存临时 ID、来源页面和区域、几何、候选类型、文字、结构关系、分项置信度、识别证据、警告及用户确认状态。中间模型不使用 X6 Cell，也不要求满足 `.flowdiagram` schema，可以表达断线、悬空文字和类型冲突等不完整状态。

```ts
interface ImportConfidence {
  detection: number
  classification: number
  text: number
  relation: number
  hierarchy: number
  overall: number
}
```

用户修改并确认某项后，该项状态改为 `user-confirmed`，不再使用模型置信度判断是否阻断提交。

## 结构解析

结构解析器负责：

- 判断文字属于节点、连接线还是独立文本。
- 判断线条是否为连接线并推断端点与方向。
- 区分交叉和实际连接。
- 识别容器、泳道、分组与嵌套关系。
- 合并重复候选并报告冲突证据。

核心规则：

- 连接线端点在节点边界容差内时建立候选连接。
- 箭头朝向决定边方向；无箭头线条标记为待确认方向。
- 线条穿过节点但端点不接近边界时不自动连接。
- 两线相交时，除非有连接点、明显断点或源格式语义，否则默认仅交叉。
- 节点内部文字优先绑定到节点；靠近连接线中段的文字优先作为边标签。
- 包含多个节点的外层大矩形只生成容器候选，不覆盖内部节点。
- 多页源文件默认按源顺序一页映射为一个 `DiagramPage`。

## 预览校对

预览是独立导入会话，不是正式文档的只读截图：

```ts
interface ImportSession {
  source: SourceDocument
  draft: ImportDocument
  undoStack: ImportEdit[]
  redoStack: ImportEdit[]
  status: 'recognizing' | 'reviewing' | 'ready' | 'committing'
}
```

预览采用原图、重建图和问题面板三部分。原图与重建画布同步缩放和平移；多页文件逐页显示置信度和问题数量。

置信度建议分级：

| 状态 | 初始阈值 | 处理 |
|---|---:|---|
| 高 | `>= 0.90` | 默认无需处理 |
| 中 | `0.70-0.89` | 建议检查 |
| 低 | `< 0.70` | 强提示或要求确认 |
| 无候选 | 无 | 保留来源区域并要求处理 |

阈值必须通过真实样本校准，不等同于真实还原准确率。

预览支持：

- 修改节点类型和批量映射同类形状。
- 修正 OCR 文字、拆分或合并文本、重新指定文字归属。
- 修改连接线起点、终点、方向和标签。
- 合并或拆分误识别节点。
- 修正容器、泳道、分组和页面关系。
- 框选来源区域局部重新识别。
- 对低置信度区域请求云端增强。

预览编辑使用独立撤销栈。关闭或取消会话时不改变正式文档及其历史。

## 问题与确认门禁

问题按阻断、结构、文字和视觉差异排序。点击问题时原图和重建图同时定位。

以下问题默认阻止直接确认：

- 页面完全没有识别结果。
- 连接线缺少起点或终点。
- 节点或页面数量超过领域限制。
- 坐标、尺寸或变换结果非法。
- 容器关系成环。
- 页面层级引用非法。
- 最终文档 schema 校验失败。

非结构性问题可由用户明确选择仍然导入；领域非法结果不能强制提交。

## 转换与原子提交

`DiagramConverter` 在用户确认后执行：

- 坐标统一转换为 pt。
- 节点类型映射到 `ShapeRegistry`。
- 文字转换为 `TextContent`。
- 连接关系转换为 `DiagramEdge`。
- 容器关系转换为 `parentId/isContainer`。
- 源页面转换为 `DiagramPage`。
- 未知形状优先转换为通用路径，其次为普通矩形。
- 无法结构化区域只有在用户明确同意后才转换为图片节点。
- 用户拒绝图片降级时，区域保持未解决；用户必须手动结构化、局部重识别、明确排除或取消导入。
- 明确排除会降低完整度和验收评分；若排除造成断线、非法层级或其他领域非法结果，仍阻止提交。

提交顺序：

```text
冻结 ImportSession
  → 检查阻断问题
  → 构造导入后的完整文档 after
  → validateDiagramDocument(after)
  → 创建 ImportDiagramCommand(before, after)
  → 写入文档级历史
  → 更新当前文档和 revision
  → 标记 dirty 并触发自动恢复
  → 释放 ImportSession
```

任何步骤失败都保留预览会话和正式文档原状，不允许部分提交。

## 一次行为一次撤回

确认导入无论增加多少页面、节点和连接线，都只产生一条“导入流程图”历史记录。

```ts
class ImportDiagramCommand implements EditorCommand {
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

当前实现按页面维护独立 `CommandHistory`，无法正确表达跨页导入后的全局行为顺序。需要增加文档级历史及撤销协调器，按真实执行顺序选择最近的页面级或文档级行为。用户导入后即使切换页面，仍可一次撤销最近的导入；撤销后重做恢复完全相同结果；撤销导入后执行新行为会清除对应重做分支。

## 本地优先与云端增强

本地默认负责源结构提取、栅格化、OCR、几何与箭头检测、基础形状分类、结构推理和预览修正。

```ts
interface ImportEnhancementProvider {
  enhance(request: EnhancementRequest): Promise<EnhancementCandidate[]>
}
```

云端增强约束：

- 当前产品基线禁止上传用户图文件或元数据；阶段四属于未来门禁范围。在产品与安全策略明确变更前，只定义 Provider 端口，不实现或启用任何网络上传。
- 默认关闭，每次上传前明确提示并取得授权。
- 优先上传裁剪后的低置信度区域，不上传完整文件。
- 用户可查看待上传内容。
- 返回结果只形成新候选，不覆盖用户修改，不直接提交正式文档。
- 供应商实现与应用层接口解耦。
- 云端不可用不影响本地基础导入。

## 错误处理与降级

错误分为输入、页面、元素和提交四类。

- 文件损坏、格式伪装或密码保护：停止导入，不修改文档。
- 单页解析失败：该页先安全栅格化并改走视觉识别。
- 视觉识别失败：保留页面图像为待处理区域，其他页面继续预览。
- 元素无法识别：依次尝试通用路径和普通节点；图片区域需用户明确同意，拒绝后保持未解决，明确排除则记录并重算完整度。
- 提交校验失败：不进入历史，不改变 revision、dirty、选择或当前页。

任务状态：

```ts
type ImportTaskStatus =
  | 'queued'
  | 'extracting'
  | 'recognizing'
  | 'resolving'
  | 'reviewing'
  | 'committing'
  | 'completed'
  | 'cancelled'
  | 'failed'
```

解析、OCR 和模型运行在 Tauri 后端工作线程或受控 sidecar 中，不阻塞 WebView。任务可取消，提交阶段保持原子性。

## 安全与资源限制

- 校验文件魔数和扩展名。
- 限制源文件大小、页数、单页像素和矢量对象数。
- 限制压缩文件的展开大小，防止压缩炸弹。
- SVG 禁止脚本、事件处理器和外部资源。
- PDF 禁止执行嵌入动作。
- 图片解码、OCR 和模型限制内存及运行时间。
- 超限时显示实际值和允许值，不静默降采样、跳页或裁切。
- 栅格、OCR 中间图和模型输出只保存在随机会话临时目录。
- 完成、取消和过期恢复时清理临时文件。
- 日志不记录完整源文件、识别图片或敏感文字。

## 90% 验收标准

真实还原度通过人工标注标准答案计算，不能使用系统自身置信度替代：

```text
总分 =
  节点识别与类型准确率 × 30%
+ 连线端点与方向准确率 × 30%
+ 文字内容及归属准确率 × 25%
+ 页面、容器和分组准确率 × 15%
```

目标：

- 预览确认后的导入结果综合分不低于 90%。
- 任一核心分项不低于 85%。
- 自动识别结果和人工修正后结果分别统计。
- 召回率纳入评分，不能通过遗漏困难对象提高准确率。
- 样式、颜色和精确位置不进入主要 90% 指标，只作为辅助差异。

验收样本为版本化资产，包含源文件、标准 `DiagramDocument`、对象对应关系、期望问题、允许偏差、来源和难度标签。调参集和验收集必须分离。

## 验证设计

### 模块测试

- 各 Source Adapter 的格式探测、坐标变换、分组和文本提取。
- OCR 文字框、内容和置信度标准化。
- 基础形状、路径、箭头和交叉线检测。
- Structure Resolver 的端点绑定、文字归属、容器推断和冲突消解。
- Diagram Converter 的 pt 转换、形状映射和 schema 合法性。
- ImportSession 的校对、独立撤销、取消和清理。
- 云端增强的授权、裁剪范围、超时和候选合并。

### 原子撤销测试

- 导入一个或数百个元素都只增加一条历史。
- 多页导入一次撤销恢复原页面集合、顺序和内容。
- 导入到已有页面后一次撤销恢复原节点、边和属性。
- 撤销后一次重做恢复相同导入结果。
- 导入后切换页面仍可撤销最近的导入。
- 页面级行为与文档级行为按真实执行顺序撤销。
- 校验失败不增加历史，不改变 revision 和 dirty。
- 保存、自动恢复、撤销与重做的 revision 判断正确。

### 组件与端到端测试

- 原图和重建图同步定位。
- 问题列表定位正确元素。
- 用户修正后问题状态和评分重新计算。
- 阻断问题门禁和显式继续导入行为正确。
- 取消不改变正式文档。
- 完整执行选择文件、识别、校对、确认、保存、重开、撤销和重做。
- 覆盖取消、应用关闭、页面失败、超大文件、模型缺失和云端不可用。

### 性能基线

在目标设备实测矢量 PDF、150/300 DPI 扫描件、多页文件、100/500/2000 节点预览、命令快照内存、撤销重做耗时和安装包体积。识别在后台运行时，现有画布编辑和窗口交互不能明显卡顿。

## 分阶段交付

### 阶段一：基础设施与矢量导入

- 建立源适配器、原始场景和导入中间模型。
- 支持 SVG 和矢量 PDF。
- 实现基础节点、文字、直线、箭头和结构推理。
- 实现预览会话、问题列表、转换器及原子撤销。
- 建立标注样本和评分工具。

### 阶段二：扫描件与位图

- 支持 PNG、JPEG、WebP 和扫描 PDF。
- 实现预处理、本地 OCR、基础形状和连线检测。
- 支持局部重新识别和人工修正。

### 阶段三：本地模型增强

- 增强非标准形状、曲线、复杂箭头、泳道、容器和交叉线识别。
- 管理模型下载、版本、完整性、CPU/GPU 能力及降级。

### 阶段四：云端增强

- 实现授权、区域裁剪、供应商适配、结果比较、超时和隐私控制。

### 阶段五：原生结构格式

- 增加 `.vsdx`、`.drawio` 等结构适配器，共用同一中间模型与提交链路。

## 首期完成标准

- SVG 和矢量 PDF 可转换为可编辑节点、连线、文字和多页面。
- 导入预览能发现并修正低置信度结构问题。
- 未识别内容不会静默丢失。
- 确认导入前不改变正式文档。
- 确认导入只产生一条“导入流程图”历史记录。
- 跨页导入可一次撤销、一次重做，且遵守全局用户行为顺序。
- 提交前通过现有领域 schema 和形状校验。
- 建立可重复运行的标注样本、评分工具和性能基线。
- 本地导入不依赖网络，云端增强接口保持可选且默认关闭。
