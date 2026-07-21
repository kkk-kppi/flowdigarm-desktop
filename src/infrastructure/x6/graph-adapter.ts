// src/infrastructure/x6/graph-adapter.ts
// X6 Graph 适配层：文档页渲染、视口同步与 X6 手势事件回流。
// 严禁注册 X6 History 插件驱动用户撤销（用户历史只由 application 命令栈负责）。
// X6 只是一层"视图"：连线/重连/拐点/缩放/旋转手势结束后统一回流为事件，
// 领域变更只经命令完成（命令成功后由 renderPage 按文档重建，临时边/端点改动随即被覆盖）。
//
// 视口说明：X6 Scroller 的平移基于滚动位置（缩放时 graph.translate 会被 Scroller
// 重置为原点），因此 pan 的读写通过 Scroller 完成——写入用 positionPoint 将文档原点
// 定位到视口 (panX, panY)（自动扩展 padding，与 screenPx = pan + pt×96/72×zoom 一致），
// 读取取 SVG 相对容器的偏移。jsdom 无法完整渲染 X6，本文件保持薄胶合，逻辑下沉到
// viewport-transform / ruler-scale / cell-mapper / nearest-port 等纯模块。
import { Graph, type Cell, type Edge, type Node } from '@antv/x6'
import { Dnd } from '@antv/x6-plugin-dnd'
import { Keyboard } from '@antv/x6-plugin-keyboard'
import { Scroller } from '@antv/x6-plugin-scroller'
import { Selection } from '@antv/x6-plugin-selection'
import { Snapline } from '@antv/x6-plugin-snapline'
import { Transform } from '@antv/x6-plugin-transform'
import type { DiagramPage } from '@/domain/diagram'
import { MAX_ZOOM, MIN_ZOOM } from '@/application/viewport/viewport-controller'
import { shapeRegistry, type ShapeDefinition } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes' // 模块副作用：注册内置形状
import { nearestPortId } from '@/application/shapes/nearest-port'
import { pageToCells, relativePositionFor, type CellMetadata } from './cell-mapper'
import { isCellInteractable, toBackgroundCell } from './background-cells'
import { SelectionBridge } from './selection-bridge'
import { PT_TO_CSS_PX, type ViewportState } from '@/application/viewport/viewport-transform'

/** 边端点（节点 id + 端口 id）。 */
export interface EdgeEndpointRef {
  nodeId: string
  port?: string
}

export interface GraphAdapterEvents {
  onSelectionChanged?: (ids: string[]) => void
  /** 节点移动手势（mousedown→up）结束合并为一次回调，坐标为手势前后的 pt 位置。 */
  onNodeMoved?: (id: string, before: { x: number; y: number }, after: { x: number; y: number }) => void
  /** X6 手势（Ctrl+滚轮缩放、平移）回流：读取到的最新视口状态。 */
  onViewportChanged?: (state: ViewportState) => void
  /** 新边连接完成（端口已解析：落节点主体时按最近端口补全）。 */
  onCreateEdgeRequest?: (args: { source: EdgeEndpointRef; target: EdgeEndpointRef }) => void
  /** 边端点重连完成（before 由调用方从文档读取）。 */
  onReconnectRequest?: (args: { edgeId: string; end: 'source' | 'target'; endpoint: EdgeEndpointRef }) => void
  /** 拐点手势（拖拽 vertices 工具）结束合并为一次回调。 */
  onVerticesChanged?: (args: { edgeId: string; vertices: { x: number; y: number }[] }) => void
  /** 缩放手势（Transform 手柄 down→up）结束合并为一次回调。 */
  onResizeGesture?: (args: {
    nodeId: string
    before: { x: number; y: number; width: number; height: number }
    after: { x: number; y: number; width: number; height: number }
  }) => void
  /** 旋转手势结束合并为一次回调（角度为 X6 原始值，规范化由命令负责）。 */
  onRotateGesture?: (args: { nodeId: string; before: number; after: number }) => void
  /** Dnd 放置图元库形状（topLeftPt 为放置点节点左上角 pt）。 */
  onShapeDropped?: (args: { shapeType: string; topLeftPt: { x: number; y: number } }) => void
  /** 双击节点（进入文本编辑入口之一）。 */
  onNodeDblClick?: (nodeId: string) => void
  /** 双击边（进入边标签文本编辑入口）。 */
  onEdgeDblClick?: (edgeId: string) => void
  /** 单击节点（携带修饰键状态；格式刷应用/链接打开由调用方判定）。 */
  onNodeClick?: (nodeId: string, modifiers: { ctrlKey: boolean; metaKey: boolean }) => void
  /** 单击边。 */
  onEdgeClick?: (edgeId: string, modifiers: { ctrlKey: boolean; metaKey: boolean }) => void
  /** 单击空白（格式刷取消等）。 */
  onBlankClick?: () => void
  /** 右键菜单请求，坐标为浏览器视口 CSS px。 */
  onContextMenu?: (args: { kind: 'blank' | 'node' | 'edge'; cellId?: string; x: number; y: number }) => void
  /** 返回 true 时禁止该图元被选中（格式刷/链接打开期间不进入选择逻辑）。 */
  suppressSelection?: (cellId: string) => boolean
}

type Unsubscribe = () => void

/** 将 cell-mapper 的扁平 attrs 路径键（body/fill 等）展开为 X6 嵌套 attrs。 */
function expandStyle(style: Record<string, unknown>): Record<string, unknown> {
  const attrs: Record<string, unknown> = {}
  for (const [path, value] of Object.entries(style)) {
    const segments = path.split('/')
    let node = attrs
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      node[segment] = (node[segment] as Record<string, unknown> | undefined) ?? {}
      node = node[segment] as Record<string, unknown>
    }
    node[segments[segments.length - 1]] = value
  }
  return attrs
}

/** 端口圆点样式：默认隐藏，节点悬停/连线吸附高亮时显示（CSS 见 CanvasArea 全局样式）。 */
const PORT_CIRCLE_ATTRS = {
  circle: {
    r: 4,
    magnet: true,
    fill: '#FFFFFF',
    stroke: '#5F95FF',
    strokeWidth: 1,
    style: 'visibility: hidden;',
  },
} as const

/** 四边中点端口组（单端口即边中点）。 */
const SIDE_PORT_GROUPS = {
  top: { position: 'top', attrs: PORT_CIRCLE_ATTRS },
  right: { position: 'right', attrs: PORT_CIRCLE_ATTRS },
  bottom: { position: 'bottom', attrs: PORT_CIRCLE_ATTRS },
  left: { position: 'left', attrs: PORT_CIRCLE_ATTRS },
} as const

/** 由 ShapeDefinition 生成 X6 节点注册配置：继承内置 rect/ellipse/path 以获得 label 布局。 */
function shapeNodeOptions(def: ShapeDefinition): Parameters<typeof Graph.registerNode>[1] {
  return {
    inherit: def.body.markup === 'path' ? 'path' : def.body.markup,
    attrs: {
      body: {
        // path 采用「100×100 单位正方形」约定：refD 将路径 bbox 归一化缩放到节点 bbox
        ...(def.body.markup === 'path' ? { refD: def.body.path } : {}),
        ...(def.body.roundedRadius
          ? { rx: def.body.roundedRadius, ry: def.body.roundedRadius }
          : {}),
      },
    },
    ports: {
      groups: SIDE_PORT_GROUPS,
      items: def.ports.map((port) => ({ id: port.id, group: port.position })),
    },
  }
}

/** 形状默认样式（Dnd 拖拽预览用）。 */
function previewAttrs(def: ShapeDefinition): Record<string, unknown> {
  return expandStyle({
    'body/fill': def.defaultStyle.fill,
    'body/fillOpacity': def.defaultStyle.fillOpacity,
    'body/stroke': def.defaultStyle.stroke,
    'body/strokeWidth': def.defaultStyle.strokeWidth,
  })
}

export class GraphAdapter {
  private readonly graph: Graph
  private readonly scroller: Scroller
  private readonly dnd: Dnd
  private readonly container: HTMLElement
  private readonly events: GraphAdapterEvents
  private readonly unsubscribes: Unsubscribe[] = []
  /** 抑制 syncViewport 引发的回流事件，避免视口状态回声。 */
  private applyingViewport = false
  private moveGestureBefore: { id: string; x: number; y: number; rawX: number; rawY: number } | null = null
  private moveGesturePointer: { x: number; y: number } | null = null
  private resizeGestureBefore: {
    id: string
    x: number
    y: number
    width: number
    height: number
  } | null = null
  private rotateGestureBefore: { id: string; angle: number } | null = null
  private verticesGestureBefore: { id: string; vertices: { x: number; y: number }[] } | null = null
  /** Shift 修饰键实时状态（Transform 部件创建时读取，keepAspectOnShiftResize 形状按修饰键等比缩放）。 */
  private shiftHeld = false

  constructor(container: HTMLElement, events: GraphAdapterEvents = {}) {
    this.container = container
    this.events = events

    // 从形状注册表动态注册 X6 节点（覆盖模式：重复构造安全）
    for (const def of shapeRegistry.all()) {
      Graph.registerNode(def.type, shapeNodeOptions(def), true)
    }

    this.graph = new Graph({
      container,
      autoResize: true,
      grid: { visible: false, type: 'dot', size: 10 },
      // 背景页图元禁止一切交互（移动/连接/选择框等）
      interacting: (cellView) => isCellInteractable(cellView.cell),
      mousewheel: {
        enabled: true,
        modifiers: ['ctrl', 'meta'],
        zoomAtMousePosition: true,
        // X6 缩放值 = 96/72 × zoom；与用户缩放钳制 0.1–4 对齐，避免越界后回弹
        minScale: MIN_ZOOM * PT_TO_CSS_PX,
        maxScale: MAX_ZOOM * PT_TO_CSS_PX,
      },
      // 端口高亮：可连接（available）与已吸附（adsorbed）两档描边
      highlighting: {
        magnetAvailable: {
          name: 'stroke',
          args: { padding: 3, attrs: { 'stroke-width': 2, stroke: '#5F95FF' } },
        },
        magnetAdsorbed: {
          name: 'stroke',
          args: { padding: 6, attrs: { 'stroke-width': 3, stroke: '#5F95FF' } },
        },
      },
      connecting: {
        snap: { radius: 20 },
        allowBlank: false,
        allowLoop: false,
        // 允许落到节点主体：落点端口由 edge:connected 用 nearestPortId 解析补全
        allowNode: true,
        allowEdge: false,
        highlight: true,
        validateMagnet: ({ cell, magnet }) => {
          // 只有端口圆点可发起连线（节点主体不可）；容器节点不作为连接端点
          if (magnet.getAttribute('magnet') !== 'true') {
            return false
          }
          return !this.isContainerCell(cell)
        },
      },
    })

    // 选择：框选、多选、节点选择框（X6 选择仅作视觉与交互，领域真源为 selection-store）
    // filter 排除背景页图元：背景内容在前景页不可选；
    // suppressSelection（格式刷/链接打开期间）逐图元禁止进入选择
    this.graph.use(
      new Selection({
        enabled: true,
        multiple: true,
        multipleSelectionModifiers: ['ctrl', 'meta', 'shift'],
        rubberband: true,
        movable: true,
        showNodeSelectionBox: true,
        filter: (cell) =>
          isCellInteractable(cell) && this.events.suppressSelection?.(cell.id) !== true,
      }),
    )
    this.graph.use(new Snapline({ enabled: true }))
    this.graph.use(new Keyboard({ enabled: true }))
    // 变换手势：最小尺寸按形状 minSize（部件创建时解析）；Shift 等比缩放仅对
    // keepAspectOnShiftResize 形状生效；手势结束经 node:resized/node:rotated 各回调一次
    this.graph.use(
      new Transform({
        resizing: {
          enabled: true,
          minWidth: (node) => this.shapeMinSize(node).width,
          minHeight: (node) => this.shapeMinSize(node).height,
          preserveAspectRatio: (node) =>
            this.shiftHeld && this.shapeDefOf(node)?.keepAspectOnShiftResize === true,
          allowReverse: false,
        },
        rotating: { enabled: true },
      }),
    )
    // X6 v2 的 ModifierKey 仅支持 alt/ctrl/meta/shift（无 space），Scroller 自带 panning
    // 无法表达"Space+左键"，故关闭；Space+左键与中键平移由下方自定义手势驱动同一 Scroller。
    this.scroller = new Scroller({ pannable: false })
    this.graph.use(this.scroller)
    // 图元库拖入：Dnd 提供拖拽预览；放置后不直接建模，经 onShapeDropped 走命令创建
    this.dnd = new Dnd({ target: this.graph })

    this.bindViewportReflow()
    this.bindCustomPanGestures()
    this.bindNodeMoveGesture()
    this.bindSelectionReflow()
    this.bindEdgeGestures()
    this.bindTransformGestures()
    this.bindEdgeTools()
    this.bindShapeDrop()
    this.bindDblClickReflow()
    this.bindClickReflow()
    this.bindContextMenuReflow()
  }

  /**
   * 清空并按 cell-mapper 元数据重建整页。
   * 传入 backgroundPage 时先渲染背景页 cells（zIndex 整体偏移到前景之下、
   * data 标记 background → 不可交互、不可选），再渲染前景页 cells；
   * 单参调用 = 无背景页（既有行为）。
   */
  renderPage(page: DiagramPage, backgroundPage?: DiagramPage): void {
    this.graph.clearCells()
    const nodeMetas: CellMetadata[] = []
    if (backgroundPage) {
      for (const meta of pageToCells(backgroundPage)) {
        this.addCell(toBackgroundCell(meta))
        if (meta.kind === 'node') nodeMetas.push(meta)
      }
    }
    for (const meta of pageToCells(page)) {
      this.addCell(meta)
      if (meta.kind === 'node') nodeMetas.push(meta)
    }
    this.wireParentChildren(nodeMetas)
  }

  /** 按 parentId 组装 X6 父子（children 相对坐标 = 子文档坐标 − 父文档坐标，pt）。 */
  private wireParentChildren(nodeMetas: CellMetadata[]): void {
    const metaById = new Map(nodeMetas.map((meta) => [meta.id, meta]))
    for (const meta of nodeMetas) {
      if (!meta.parentId) continue
      const parentMeta = metaById.get(meta.parentId)
      const parentCell = this.graph.getCellById(meta.parentId)
      const childCell = this.graph.getCellById(meta.id)
      if (!parentMeta || !parentCell?.isNode() || !childCell?.isNode()) continue
      ;(parentCell as Node).addChild(childCell as Node)
      const rel = relativePositionFor(
        { x: meta.x ?? 0, y: meta.y ?? 0 },
        { x: parentMeta.x ?? 0, y: parentMeta.y ?? 0 },
      )
      ;(childCell as Node).position(rel.x, rel.y)
    }
  }

  /**
   * 将视口状态写入 X6：缩放值 = 96/72 × zoom（absolute），
   * pan 通过 positionPoint 将文档原点定位到视口 (panX, panY)。
   */
  syncViewport(state: ViewportState): void {
    this.applyingViewport = true
    try {
      this.graph.zoom(PT_TO_CSS_PX * state.zoom, { absolute: true })
      const scale = PT_TO_CSS_PX * state.zoom
      // positionPoint 的负数坐标表示"从右/下边缘起算"，故换算为非负锚点 + 局部点
      const viewportX = Math.max(0, state.panX)
      const viewportY = Math.max(0, state.panY)
      this.scroller.positionPoint(
        { x: (viewportX - state.panX) / scale, y: (viewportY - state.panY) / scale },
        viewportX,
        viewportY,
      )
    } finally {
      this.applyingViewport = false
    }
  }

  /** 将选择状态写入 X6（保序；忽略不存在于画布的 id；与当前一致时不重置，避免事件回声）。 */
  syncSelection(ids: string[]): void {
    const existing = ids.filter((id) => this.graph.getCellById(id) != null)
    const current = this.graph.getSelectedCells().map((cell) => cell.id)
    if (current.length === existing.length && current.every((id, index) => id === existing[index])) {
      return
    }
    this.graph.resetSelection(existing)
  }

  /** 图元库拖拽起点：创建预览节点并交给 Dnd（放置结果经 onShapeDropped 回流）。 */
  startShapeDrag(shapeType: string, e: MouseEvent): void {
    const def = shapeRegistry.get(shapeType)
    const node = this.graph.createNode({
      shape: def.type,
      width: def.defaultSize.width,
      height: def.defaultSize.height,
      attrs: previewAttrs(def) as Node.Metadata['attrs'],
      data: { pendingCreateShape: def.type },
    })
    this.dnd.start(node, e)
  }

  /** 网格可见性（X6 内置点阵网格），由 app-store 控制。 */
  setGridVisible(visible: boolean): void {
    if (visible) {
      this.graph.showGrid()
    } else {
      this.graph.hideGrid()
    }
  }

  /** 供调试/E2E 访问底层 Graph。 */
  getGraph(): Graph {
    return this.graph
  }

  /** 解绑全部监听并销毁 Graph，杜绝泄漏。 */
  dispose(): void {
    for (const unsubscribe of this.unsubscribes.splice(0)) {
      unsubscribe()
    }
    this.dnd.dispose()
    this.graph.dispose()
  }

  private addCell(meta: CellMetadata): void {
    if (meta.kind === 'node') {
      this.addNode(meta)
    } else {
      this.addEdge(meta)
    }
  }

  private addNode(meta: CellMetadata): void {
    this.graph.addNode({
      id: meta.id,
      shape: meta.shape,
      x: meta.x,
      y: meta.y,
      width: meta.width,
      height: meta.height,
      angle: meta.angle,
      zIndex: meta.zIndex,
      label: meta.label,
      attrs: expandStyle(meta.style) as Node.Metadata['attrs'],
      data: meta.data ? { ...meta.data } : undefined,
    })
  }

  private addEdge(meta: CellMetadata): void {
    this.graph.addEdge({
      id: meta.id,
      shape: meta.shape,
      source: meta.source,
      target: meta.target,
      vertices: meta.vertices,
      zIndex: meta.zIndex,
      // 多标签经 labels 数组渲染（逐标签字体样式）；无标签时为 undefined
      labels: meta.labels?.map((label) => ({
        position: label.position,
        attrs: { label: { text: label.text, ...label.attrs } },
      })),
      label: meta.labels ? undefined : meta.label,
      ...connectorOptionsOf(meta),
      attrs: expandStyle(meta.style) as Edge.Metadata['attrs'],
      data: meta.data ? { ...meta.data } : undefined,
    })
  }

  /** 节点的形状定义；未注册形状（如 'edge'）返回 undefined。 */
  private shapeDefOf(cell: Cell): ShapeDefinition | undefined {
    return shapeRegistry.has(cell.shape) ? shapeRegistry.get(cell.shape) : undefined
  }

  private shapeMinSize(cell: Cell): { width: number; height: number } {
    return this.shapeDefOf(cell)?.minSize ?? { width: 1, height: 1 }
  }

  /** 容器节点不作为连接端点（详细设计 §10.3）。 */
  private isContainerCell(cell: Cell): boolean {
    return cell.isNode() && this.shapeDefOf(cell)?.isContainer === true
  }

  /** 读取当前视口状态：zoom 由 scale 换算；pan 取 SVG 相对容器偏移（CSS px）。 */
  private readViewportState(): ViewportState {
    const containerRect = this.container.getBoundingClientRect()
    const svgRect = this.graph.view.svg.getBoundingClientRect()
    return {
      zoom: this.graph.zoom() / PT_TO_CSS_PX,
      panX: svgRect.left - containerRect.left,
      panY: svgRect.top - containerRect.top,
    }
  }

  private emitViewportIfGesture(): void {
    if (this.applyingViewport) {
      return
    }
    this.events.onViewportChanged?.(this.readViewportState())
  }

  /** Ctrl+滚轮缩放（scale 事件）与 Scroller 平移（scroll 事件）回流。 */
  private bindViewportReflow(): void {
    const onScale = () => this.emitViewportIfGesture()
    this.graph.on('scale', onScale)
    this.unsubscribes.push(() => this.graph.off('scale', onScale))

    const scrollerContainer = this.scroller.container
    const onScroll = () => this.emitViewportIfGesture()
    scrollerContainer.addEventListener('scroll', onScroll)
    this.unsubscribes.push(() => scrollerContainer.removeEventListener('scroll', onScroll))
  }

  /**
   * 平移手势：中键拖动 + Space+左键拖动，均驱动 Scroller 滚动位置。
   * Space+左键在捕获阶段拦截，避免触发框选与节点拖拽。
   * 顺带跟踪 Shift 实时状态（Transform 部件创建时用于 keepAspectOnShiftResize 判定）。
   */
  private bindCustomPanGestures(): void {
    let spaceHeld = false
    let panning = false
    let lastClientX = 0
    let lastClientY = 0

    const isEditableTarget = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        this.shiftHeld = true
      }
      if (event.code === 'Space' && !isEditableTarget(event.target)) {
        spaceHeld = true
        event.preventDefault() // 阻止空格触发页面滚动
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        this.shiftHeld = false
      }
      if (event.code === 'Space') {
        spaceHeld = false
        panning = false
      }
    }
    // 窗口失焦时 keyup 可能丢失，重置修饰键标记避免卡滞
    const onWindowBlur = () => {
      spaceHeld = false
      this.shiftHeld = false
    }
    const onMouseDown = (event: MouseEvent) => {
      const isMiddleButton = event.button === 1
      const isSpaceLeftButton = spaceHeld && event.button === 0
      if (!isMiddleButton && !isSpaceLeftButton) {
        return
      }
      event.preventDefault() // 阻止中键自动滚动等默认行为
      if (isSpaceLeftButton) {
        event.stopPropagation() // 抑制框选/节点拖拽
      }
      panning = true
      lastClientX = event.clientX
      lastClientY = event.clientY
    }
    const onMouseMove = (event: MouseEvent) => {
      if (!panning) {
        return
      }
      const { left, top } = this.scroller.getScrollbarPosition()
      this.scroller.setScrollbarPosition(
        left - (event.clientX - lastClientX),
        top - (event.clientY - lastClientY),
      )
      lastClientX = event.clientX
      lastClientY = event.clientY
    }
    const onMouseUp = () => {
      panning = false
    }

    this.container.addEventListener('mousedown', onMouseDown, true)
    // 键盘事件挂在画布容器上（随焦点生效），避免全局监听干扰其他输入场景
    this.container.addEventListener('keydown', onKeyDown)
    this.container.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    this.unsubscribes.push(() => {
      this.container.removeEventListener('mousedown', onMouseDown, true)
      this.container.removeEventListener('keydown', onKeyDown)
      this.container.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    })
  }

  /** 节点文档绝对位置（pt）：子节点 position() 为父相对坐标，沿父链累加还原。 */
  private absolutePosition(node: Node): { x: number; y: number } {
    const position = node.position()
    const parent = node.getParent()
    if (parent && parent.isNode()) {
      const parentAbs = this.absolutePosition(parent as Node)
      return { x: parentAbs.x + position.x, y: parentAbs.y + position.y }
    }
    return { x: position.x, y: position.y }
  }

  /** 节点移动手势合并：mousedown 记录起点，mouseup 对比终点，一次回调。 */
  private bindNodeMoveGesture(): void {
    const finish = (node: Node, event?: { clientX: number; clientY: number }) => {
      const before = this.moveGestureBefore
      const pointer = this.moveGesturePointer
      this.moveGestureBefore = null
      this.moveGesturePointer = null
      if (!before || before.id !== node.id) return
      if (event && pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) <= 3) {
        node.position(before.rawX, before.rawY)
        return
      }
      const after = this.absolutePosition(node)
      if (after.x !== before.x || after.y !== before.y) {
        this.events.onNodeMoved?.(node.id, { x: before.x, y: before.y }, after)
      }
    }
    this.graph.on('node:mousedown', ({ node, e }) => {
      const position = this.absolutePosition(node)
      const raw = node.position()
      this.moveGestureBefore = { id: node.id, x: position.x, y: position.y, rawX: raw.x, rawY: raw.y }
      this.moveGesturePointer = { x: e.clientX, y: e.clientY }
    })
    this.graph.on('node:mouseup', ({ node, e }) => {
      finish(node, e)
    })
    const onWindowMouseUp = (event: MouseEvent) => {
      const cell = this.moveGestureBefore ? this.graph.getCellById(this.moveGestureBefore.id) : null
      if (cell?.isNode()) finish(cell as Node, event)
    }
    window.addEventListener('mouseup', onWindowMouseUp)
    this.unsubscribes.push(() => window.removeEventListener('mouseup', onWindowMouseUp))
    // graph.dispose 会解绑全部 graph.on 监听，无需逐个退订
  }

  /** 选择变化回流（经 SelectionBridge，领域选择真源为 selection-store）。 */
  private bindSelectionReflow(): void {
    const bridge = new SelectionBridge(this.graph)
    this.unsubscribes.push(
      bridge.subscribe((ids) => {
        this.events.onSelectionChanged?.(ids)
      }),
    )
  }

  /**
   * 连线手势：新边创建与端点重连统一在 edge:connected 回流。
   * 落节点主体（无端口）时按落点 pt 计算最近端口并补全；容器端点直接回滚。
   * X6 侧的临时改动（新边/新端点）随后撤销——领域变更只经命令完成，renderPage 重绘。
   */
  private bindEdgeGestures(): void {
    this.graph.on('edge:connected', (args) => {
      const { edge, isNew, type, currentCell, currentPort, currentPoint } = args
      if (!currentCell || currentCell.isEdge()) {
        return
      }
      if (this.isContainerCell(currentCell)) {
        this.rollbackEdge(edge, isNew, type, args.previousCell, args.previousPort)
        return
      }
      let port = currentPort ?? undefined
      if (!port) {
        // 落点（graph 局部 pt，X6 逻辑单位即 pt）→ 最近端口；缺省参考对端节点中心
        const point = currentPoint ?? this.oppositeTerminalCenter(edge, type)
        const bbox = currentCell.getBBox()
        port = nearestPortId(
          { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
          point,
        )
        if (type === 'target') {
          edge.setTarget({ cell: currentCell.id, port })
        } else {
          edge.setSource({ cell: currentCell.id, port })
        }
      }
      const endpoint: EdgeEndpointRef = { nodeId: currentCell.id, port }
      if (isNew) {
        const otherEndpoint = this.otherEndpointOf(edge, type)
        const [source, target] =
          type === 'target' ? [otherEndpoint, endpoint] : [endpoint, otherEndpoint]
        edge.remove() // 临时边：领域 CreateCellsCommand 建立后由 renderPage 重绘
        this.events.onCreateEdgeRequest?.({ source, target })
      } else {
        // 重连：还原 X6 端点（文档为真源，命令成功后 renderPage 重绘）
        this.rollbackEdge(edge, false, type, args.previousCell, args.previousPort)
        this.events.onReconnectRequest?.({ edgeId: edge.id, end: type, endpoint })
      }
    })

    // 拐点手势合并：edge:mousedown 记录快照，edge:mouseup 对比后一次回调
    this.graph.on('edge:mousedown', ({ edge }) => {
      this.verticesGestureBefore = {
        id: edge.id,
        vertices: edge.getVertices().map((v) => ({ x: v.x, y: v.y })),
      }
    })
    this.graph.on('edge:mouseup', ({ edge }) => {
      const before = this.verticesGestureBefore
      this.verticesGestureBefore = null
      if (!before || before.id !== edge.id) {
        return
      }
      const after = edge.getVertices().map((v) => ({ x: v.x, y: v.y }))
      if (JSON.stringify(after) !== JSON.stringify(before.vertices)) {
        this.events.onVerticesChanged?.({ edgeId: edge.id, vertices: after })
      }
    })
  }

  /** 变换手势合并：node:resize/node:rotate 记录 before，node:resized/node:rotated 各回调一次。 */
  private bindTransformGestures(): void {
    this.graph.on('node:resize', ({ node }) => {
      this.resizeGestureBefore = { id: node.id, ...node.position(), ...node.size() }
    })
    this.graph.on('node:resized', ({ node }) => {
      const before = this.resizeGestureBefore
      this.resizeGestureBefore = null
      if (!before || before.id !== node.id) {
        return
      }
      const after = { ...node.position(), ...node.size() }
      if (
        after.x !== before.x ||
        after.y !== before.y ||
        after.width !== before.width ||
        after.height !== before.height
      ) {
        this.events.onResizeGesture?.({
          nodeId: node.id,
          before: { x: before.x, y: before.y, width: before.width, height: before.height },
          after,
        })
      }
    })
    this.graph.on('node:rotate', ({ node }) => {
      this.rotateGestureBefore = { id: node.id, angle: node.getAngle() }
    })
    this.graph.on('node:rotated', ({ node }) => {
      const before = this.rotateGestureBefore
      this.rotateGestureBefore = null
      if (!before || before.id !== node.id) {
        return
      }
      const after = node.getAngle()
      if (after !== before.angle) {
        this.events.onRotateGesture?.({ nodeId: node.id, before: before.angle, after })
      }
    })
  }

  /** 边选中时挂编辑工具：拐点/分段/两端箭头手柄（重连与拐点编辑入口）。 */
  private bindEdgeTools(): void {
    this.graph.on('edge:selected', ({ edge }) => {
      edge.addTools([
        { name: 'vertices' },
        { name: 'segments' },
        { name: 'source-arrowhead' },
        { name: 'target-arrowhead' },
      ])
    })
    this.graph.on('edge:unselected', ({ edge }) => {
      edge.removeTools()
    })
  }

  /** Dnd 放置：仅处理预览节点（data.pendingCreateShape），移除临时节点并回流放置点。 */
  private bindShapeDrop(): void {
    this.graph.on('node:added', ({ node }) => {
      const shapeType = (node.getData() as { pendingCreateShape?: string } | undefined)
        ?.pendingCreateShape
      if (!shapeType) {
        return
      }
      const topLeftPt = node.position()
      node.remove() // 预览节点：领域 CreateCellsCommand 建立后由 renderPage 重绘
      this.events.onShapeDropped?.({ shapeType, topLeftPt })
    })
  }

  /** 双击回流：节点/边双击进入文本编辑（命令化由调用方经覆盖层完成）。 */
  private bindDblClickReflow(): void {
    this.graph.on('node:dblclick', ({ node }) => {
      this.events.onNodeDblClick?.(node.id)
    })
    this.graph.on('edge:dblclick', ({ edge }) => {
      this.events.onEdgeDblClick?.(edge.id)
    })
  }

  /** 单击回流：节点/边/空白单击（携带修饰键；格式刷与链接打开由调用方判定）。 */
  private bindClickReflow(): void {
    this.graph.on('node:click', ({ node, e }) => {
      this.events.onNodeClick?.(node.id, { ctrlKey: e.ctrlKey, metaKey: e.metaKey })
    })
    this.graph.on('edge:click', ({ edge, e }) => {
      this.events.onEdgeClick?.(edge.id, { ctrlKey: e.ctrlKey, metaKey: e.metaKey })
    })
    this.graph.on('blank:click', () => {
      this.events.onBlankClick?.()
    })
  }

  private bindContextMenuReflow(): void {
    this.graph.on('node:contextmenu', ({ node, e }) => {
      e.preventDefault()
      this.events.onContextMenu?.({ kind: 'node', cellId: node.id, x: e.clientX, y: e.clientY })
    })
    this.graph.on('edge:contextmenu', ({ edge, e }) => {
      e.preventDefault()
      this.events.onContextMenu?.({ kind: 'edge', cellId: edge.id, x: e.clientX, y: e.clientY })
    })
    this.graph.on('blank:contextmenu', ({ e }) => {
      e.preventDefault()
      this.events.onContextMenu?.({ kind: 'blank', x: e.clientX, y: e.clientY })
    })
  }

  /** 撤销 X6 侧的连线改动：新边移除；重连还原到 previous 端点。 */
  private rollbackEdge(
    edge: Edge,
    isNew: boolean,
    type: 'source' | 'target',
    previousCell?: Cell | null,
    previousPort?: string | null,
  ): void {
    if (isNew) {
      edge.remove()
      return
    }
    if (previousCell) {
      const terminal = { cell: previousCell.id, ...(previousPort ? { port: previousPort } : {}) }
      if (type === 'target') {
        edge.setTarget(terminal)
      } else {
        edge.setSource(terminal)
      }
    }
  }

  /** 对端端点（节点 id + 端口）。 */
  private otherEndpointOf(edge: Edge, type: 'source' | 'target'): EdgeEndpointRef {
    return {
      nodeId: type === 'target' ? edge.getSourceCellId() : edge.getTargetCellId(),
      port: (type === 'target' ? edge.getSourcePortId() : edge.getTargetPortId()) ?? undefined,
    }
  }

  /** 对端节点中心（落主体时无 currentPoint 的参考点）。 */
  private oppositeTerminalCenter(edge: Edge, type: 'source' | 'target'): { x: number; y: number } {
    const ref = this.otherEndpointOf(edge, type)
    const cell = this.graph.getCellById(ref.nodeId)
    if (cell && cell.isNode()) {
      const bbox = cell.getBBox()
      return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 }
    }
    return { x: 0, y: 0 }
  }
}

/**
 * 领域连接类型 → X6 router/connector：直角用 orth 路由；smooth/jumpover 为连接器
 * （connectorName 由 cell-mapper 经 edge-connector-map 算出；跳线仅视觉跨越，不改拓扑）。
 */
function connectorOptionsOf(meta: CellMetadata): Record<string, unknown> {
  const options: Record<string, unknown> = {}
  if (meta.connector === 'orthogonal') {
    options.router = { name: 'orth' }
  }
  if (meta.connectorName && meta.connectorName !== 'normal' && meta.connectorName !== 'orth') {
    options.connector = { name: meta.connectorName }
  }
  return options
}
