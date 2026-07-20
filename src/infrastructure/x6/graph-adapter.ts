// src/infrastructure/x6/graph-adapter.ts
// X6 Graph 适配层：文档页渲染、视口同步与 X6 手势事件回流。
// 严禁注册 X6 History 插件驱动用户撤销（用户历史只由 application 命令栈负责）。
//
// 视口说明：X6 Scroller 的平移基于滚动位置（缩放时 graph.translate 会被 Scroller
// 重置为原点），因此 pan 的读写通过 Scroller 完成——写入用 positionPoint 将文档原点
// 定位到视口 (panX, panY)（自动扩展 padding，与 screenPx = pan + pt×96/72×zoom 一致），
// 读取取 SVG 相对容器的偏移。jsdom 无法完整渲染 X6，本文件保持薄胶合，逻辑下沉到
// viewport-transform / ruler-scale / cell-mapper 等纯函数。
import { Graph, type Edge, type Node } from '@antv/x6'
import { Keyboard } from '@antv/x6-plugin-keyboard'
import { Scroller } from '@antv/x6-plugin-scroller'
import { Selection } from '@antv/x6-plugin-selection'
import { Snapline } from '@antv/x6-plugin-snapline'
import { Transform } from '@antv/x6-plugin-transform'
import type { DiagramPage } from '@/domain/diagram'
import { MAX_ZOOM, MIN_ZOOM } from '@/application/viewport/viewport-controller'
import { pageToCells, type CellMetadata } from './cell-mapper'
import { SelectionBridge } from './selection-bridge'
import { PT_TO_CSS_PX, type ViewportState } from '@/application/viewport/viewport-transform'

export interface GraphAdapterEvents {
  onSelectionChanged?: (ids: string[]) => void
  /** 节点移动手势（mousedown→up）结束合并为一次回调，坐标为手势前后的 pt 位置。 */
  onNodeMoved?: (id: string, before: { x: number; y: number }, after: { x: number; y: number }) => void
  /** X6 手势（Ctrl+滚轮缩放、平移）回流：读取到的最新视口状态。 */
  onViewportChanged?: (state: ViewportState) => void
}

type Unsubscribe = () => void

/** 背景页 cells 的 zIndex 整体偏移量（压到前景之下；领域 zIndex 为非负小值）。 */
const BACKGROUND_Z_OFFSET = 1000

/** 背景页 cells 的 data 标记：interacting 与 Selection filter 据此禁止交互/选择。 */
const BACKGROUND_DATA = { background: true } as const

/** 判断 cell 是否为背景页图元（不可选、不可交互）。 */
function isBackgroundCell(cell: { getData(): unknown }): boolean {
  const data = cell.getData() as { background?: boolean } | undefined
  return data?.background === true
}

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

export class GraphAdapter {
  private readonly graph: Graph
  private readonly scroller: Scroller
  private readonly container: HTMLElement
  private readonly events: GraphAdapterEvents
  private readonly unsubscribes: Unsubscribe[] = []
  /** 抑制 syncViewport 引发的回流事件，避免视口状态回声。 */
  private applyingViewport = false
  private moveGestureBefore: { id: string; x: number; y: number } | null = null

  constructor(container: HTMLElement, events: GraphAdapterEvents = {}) {
    this.container = container
    this.events = events

    this.graph = new Graph({
      container,
      autoResize: true,
      grid: { visible: false, type: 'dot', size: 10 },
      // 背景页图元禁止一切交互（移动/连接/选择框等）
      interacting: (cellView) => !isBackgroundCell(cellView.cell),
      mousewheel: {
        enabled: true,
        modifiers: ['ctrl', 'meta'],
        zoomAtMousePosition: true,
        // X6 缩放值 = 96/72 × zoom；与用户缩放钳制 0.1–4 对齐，避免越界后回弹
        minScale: MIN_ZOOM * PT_TO_CSS_PX,
        maxScale: MAX_ZOOM * PT_TO_CSS_PX,
      },
    })

    // 选择：框选、多选、节点选择框（X6 选择仅作视觉与交互，领域真源由后续 store 持有）
    // filter 排除背景页图元：背景内容在前景页不可选
    this.graph.use(
      new Selection({
        enabled: true,
        multiple: true,
        rubberband: true,
        movable: true,
        showNodeSelectionBox: true,
        filter: (cell) => !isBackgroundCell(cell),
      }),
    )
    this.graph.use(new Snapline({ enabled: true }))
    this.graph.use(new Keyboard({ enabled: true }))
    // 变换手势：本任务仅启用手势，命令接线在后续任务完成
    this.graph.use(new Transform({ resizing: true, rotating: true }))
    // X6 v2 的 ModifierKey 仅支持 alt/ctrl/meta/shift（无 space），Scroller 自带 panning
    // 无法表达"Space+左键"，故关闭；Space+左键与中键平移由下方自定义手势驱动同一 Scroller。
    this.scroller = new Scroller({ pannable: false })
    this.graph.use(this.scroller)

    this.bindViewportReflow()
    this.bindCustomPanGestures()
    this.bindNodeMoveGesture()
    this.bindSelectionReflow()
  }

  /**
   * 清空并按 cell-mapper 元数据重建整页。
   * 传入 backgroundPage 时先渲染背景页 cells（zIndex 整体偏移到前景之下、
   * data 标记 background → 不可交互、不可选），再渲染前景页 cells；
   * 单参调用 = 无背景页（既有行为）。
   */
  renderPage(page: DiagramPage, backgroundPage?: DiagramPage): void {
    this.graph.clearCells()
    if (backgroundPage) {
      for (const meta of pageToCells(backgroundPage)) {
        this.addCell({ ...meta, zIndex: meta.zIndex - BACKGROUND_Z_OFFSET }, true)
      }
    }
    for (const meta of pageToCells(page)) {
      this.addCell(meta, false)
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
    this.graph.dispose()
  }

  private addCell(meta: CellMetadata, background: boolean): void {
    if (meta.kind === 'node') {
      this.addNode(meta, background)
    } else {
      this.addEdge(meta, background)
    }
  }

  private addNode(meta: CellMetadata, background: boolean): void {
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
      data: background ? { ...BACKGROUND_DATA } : undefined,
    })
  }

  private addEdge(meta: CellMetadata, background: boolean): void {
    this.graph.addEdge({
      id: meta.id,
      shape: meta.shape,
      source: meta.source,
      target: meta.target,
      vertices: meta.vertices,
      zIndex: meta.zIndex,
      label: meta.label,
      ...connectorOptionsOf(meta),
      attrs: expandStyle(meta.style) as Edge.Metadata['attrs'],
      data: background ? { ...BACKGROUND_DATA } : undefined,
    })
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
      if (event.code === 'Space' && !isEditableTarget(event.target)) {
        spaceHeld = true
        event.preventDefault() // 阻止空格触发页面滚动
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spaceHeld = false
        panning = false
      }
    }
    // 窗口失焦时 keyup 可能丢失，重置 Space 按下标记避免卡滞
    const onWindowBlur = () => {
      spaceHeld = false
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

  /** 节点移动手势合并：mousedown 记录起点，mouseup 对比终点，一次回调。 */
  private bindNodeMoveGesture(): void {
    this.graph.on('node:mousedown', ({ node }) => {
      const position = node.position()
      this.moveGestureBefore = { id: node.id, x: position.x, y: position.y }
    })
    this.graph.on('node:mouseup', ({ node }) => {
      const before = this.moveGestureBefore
      this.moveGestureBefore = null
      if (!before || before.id !== node.id) {
        return
      }
      const after = node.position()
      if (after.x !== before.x || after.y !== before.y) {
        this.events.onNodeMoved?.(node.id, { x: before.x, y: before.y }, after)
      }
    })
    // graph.dispose 会解绑全部 graph.on 监听，无需逐个退订
  }

  /** 选择变化回流（经 SelectionBridge，领域选择真源由后续 store 持有）。 */
  private bindSelectionReflow(): void {
    const bridge = new SelectionBridge(this.graph)
    this.unsubscribes.push(
      bridge.subscribe((ids) => {
        this.events.onSelectionChanged?.(ids)
      }),
    )
  }
}

/** 领域连接类型 → X6 router/connector：直线默认；直角用 orth 路由；曲线用 smooth 连接器。 */
function connectorOptionsOf(meta: CellMetadata): Record<string, unknown> {
  switch (meta.connector) {
    case 'orthogonal':
      return { router: { name: 'orth' } }
    case 'curved':
      return { connector: { name: 'smooth' } }
    default:
      return {}
  }
}
