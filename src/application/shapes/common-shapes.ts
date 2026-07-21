// src/application/shapes/common-shapes.ts
// 内置形状注册：6 基本 + 6 流程图 + 文本框 + 图片，共 14 个。
// path 几何遵循 shape-registry.ts 的「100×100 单位正方形」约定（渲染按 bbox 缩放）。
// 本模块加载时自动完成注册（幂等）；需要注册表的模块直接 import 本模块即可获得形状。
import { createDefaultNodeStyle, type NodeStyle } from '@/domain/diagram'
import { shapeRegistry, type PortDef, type ShapeDefinition } from './shape-registry'

/** 四边中点端口（全部内置形状一致）。 */
const SIDE_PORTS: PortDef[] = [
  { id: 'top', position: 'top' },
  { id: 'right', position: 'right' },
  { id: 'bottom', position: 'bottom' },
  { id: 'left', position: 'left' },
]

const BASIC_SIZE = { width: 120, height: 72 }
const FLOWCHART_SIZE = { width: 140, height: 72 }
const DEFAULT_MIN_SIZE = { width: 36, height: 24 }
const DEFAULT_INSET = { top: 4, right: 4, bottom: 4, left: 4 }

/** 菱形安全内接文本区：约为宽高的 25%。 */
function diamondInset(size: { width: number; height: number }) {
  return {
    top: size.height * 0.25,
    right: size.width * 0.25,
    bottom: size.height * 0.25,
    left: size.width * 0.25,
  }
}

/** 文本框样式：白底但完全透明、描边线宽 0（无边框无填充的纯文本外观）。 */
function textShapeStyle(): NodeStyle {
  return { ...createDefaultNodeStyle(), fillOpacity: 0, strokeWidth: 0 }
}

function def(partial: Omit<ShapeDefinition, 'ports'> & { ports?: PortDef[] }): ShapeDefinition {
  return { ports: SIDE_PORTS, ...partial }
}

/** 内置形状定义（注册顺序即图元库展示顺序）。 */
const COMMON_SHAPES: ShapeDefinition[] = [
  // 基本形状（默认 120×72pt）
  def({
    type: 'rect',
    label: '矩形',
    category: 'basic',
    body: { markup: 'rect' },
    defaultSize: BASIC_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    textAreaInset: DEFAULT_INSET,
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: false,
  }),
  def({
    type: 'rounded-rect',
    label: '圆角矩形',
    category: 'basic',
    body: { markup: 'rect', roundedRadius: 8 },
    defaultSize: BASIC_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    textAreaInset: DEFAULT_INSET,
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: false,
  }),
  def({
    type: 'circle',
    label: '圆形',
    category: 'basic',
    body: { markup: 'ellipse' },
    defaultSize: BASIC_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    textAreaInset: DEFAULT_INSET,
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: false,
  }),
  def({
    type: 'ellipse',
    label: '椭圆',
    category: 'basic',
    body: { markup: 'ellipse' },
    defaultSize: BASIC_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    textAreaInset: DEFAULT_INSET,
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: true,
  }),
  def({
    type: 'triangle',
    label: '三角形',
    category: 'basic',
    body: { markup: 'path', path: 'M 50 0 L 100 100 L 0 100 Z' },
    defaultSize: BASIC_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    textAreaInset: DEFAULT_INSET,
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: false,
  }),
  def({
    type: 'diamond',
    label: '菱形',
    category: 'basic',
    body: { markup: 'path', path: 'M 50 0 L 100 50 L 50 100 L 0 50 Z' },
    defaultSize: BASIC_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    textAreaInset: diamondInset(BASIC_SIZE),
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: false,
  }),
  // 流程图（默认 140×72pt）
  def({
    type: 'process',
    label: '流程',
    category: 'flowchart',
    body: { markup: 'rect' },
    defaultSize: FLOWCHART_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    textAreaInset: DEFAULT_INSET,
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: false,
  }),
  def({
    type: 'decision',
    label: '判定',
    category: 'flowchart',
    body: { markup: 'path', path: 'M 50 0 L 100 50 L 50 100 L 0 50 Z' },
    defaultSize: FLOWCHART_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    textAreaInset: diamondInset(FLOWCHART_SIZE),
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: false,
  }),
  def({
    type: 'terminator',
    label: '终止',
    category: 'flowchart',
    // 全圆角（stadium）：圆角半径 = 高度一半
    body: { markup: 'rect', roundedRadius: FLOWCHART_SIZE.height / 2 },
    defaultSize: FLOWCHART_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    textAreaInset: DEFAULT_INSET,
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: false,
  }),
  def({
    type: 'subprocess',
    label: '子流程',
    category: 'flowchart',
    // 矩形 + 两侧竖线（竖线位于 10% / 90% 宽度处）
    body: { markup: 'path', path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z M 10 0 L 10 100 M 90 0 L 90 100' },
    defaultSize: FLOWCHART_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    textAreaInset: DEFAULT_INSET,
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: false,
  }),
  def({
    type: 'document',
    label: '文档',
    category: 'flowchart',
    // 波浪底：底部为 S 形三次贝塞尔曲线
    body: { markup: 'path', path: 'M 0 0 L 100 0 L 100 80 C 75 95 25 65 0 80 Z' },
    defaultSize: FLOWCHART_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    textAreaInset: DEFAULT_INSET,
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: false,
  }),
  def({
    type: 'data',
    label: '数据流',
    category: 'flowchart',
    // 圆柱体：顶椭圆（后半弧闭合填充、前半弧仅描边）+ 两侧竖线 + 底前弧
    body: {
      markup: 'path',
      path: 'M 0 15 A 50 15 0 0 0 100 15 L 100 85 A 50 15 0 0 1 0 85 Z M 0 15 A 50 15 0 0 1 100 15',
    },
    defaultSize: FLOWCHART_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    textAreaInset: DEFAULT_INSET,
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: false,
  }),
  // 文本框（无边框无填充）
  def({
    type: 'text',
    label: '文本框',
    category: 'text',
    body: { markup: 'rect' },
    defaultSize: BASIC_SIZE,
    minSize: { width: 24, height: 20 },
    textAreaInset: DEFAULT_INSET,
    defaultStyle: textShapeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: false,
  }),
  // 图片（Shift 缩放保持纵横比）
  def({
    type: 'image',
    label: '图片',
    category: 'image',
    body: { markup: 'image' },
    defaultSize: BASIC_SIZE,
    minSize: { width: 24, height: 24 },
    textAreaInset: DEFAULT_INSET,
    defaultStyle: createDefaultNodeStyle(),
    isContainer: false,
    keepAspectOnShiftResize: true,
  }),
  // 组合（Task 7）：由「组合」命令创建的容器节点——透明填充、虚线边框；
  // category='group' 不入图元库分类；无端口（不可作为连接端点）。
  def({
    type: 'group',
    label: '组合',
    category: 'group',
    body: { markup: 'rect' },
    defaultSize: BASIC_SIZE,
    minSize: DEFAULT_MIN_SIZE,
    ports: [],
    textAreaInset: DEFAULT_INSET,
    defaultStyle: { ...createDefaultNodeStyle(), fillOpacity: 0, strokeDash: 'dash' },
    isContainer: true,
    keepAspectOnShiftResize: false,
  }),
]

let registered = false

/** 注册全部内置形状（幂等：重复调用不再重复注册）。 */
export function registerCommonShapes(): void {
  if (registered) {
    return
  }
  registered = true
  for (const shape of COMMON_SHAPES) {
    shapeRegistry.register(shape)
  }
}

// 模块加载即注册，保证任何 import 方拿到完整注册表
registerCommonShapes()
