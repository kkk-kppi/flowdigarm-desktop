<template>
  <div class="canvas-area" :class="{ 'with-rulers': appStore.showRulers }">
    <template v-if="appStore.showRulers">
      <RulerCorner class="canvas-corner" />
      <RulerOverlay
        class="canvas-ruler-h"
        orientation="horizontal"
        :unit="pageUnit"
        :viewport="viewport"
        :length-px="canvasSize.width"
      />
      <RulerOverlay
        class="canvas-ruler-v"
        orientation="vertical"
        :unit="pageUnit"
        :viewport="viewport"
        :length-px="canvasSize.height"
      />
    </template>
    <div class="graph-viewport">
      <PageFrame v-if="activePage" :page="activePage" :viewport="viewport" />
      <div
        ref="containerRef"
        class="graph-container"
        :class="{ 'format-painting': formatPaintStore.mode !== 'off' }"
        data-testid="x6-canvas"
        tabindex="0"
        aria-label="流程图画布"
        @pointerdown="focusCanvas"
      />
      <PageBreakOverlay
        v-if="activePage"
        :page="activePage"
        :viewport="viewport"
        :visible="appStore.showPageBreaks"
      />
      <TextEditorOverlay
        v-if="editingSession && activePage"
        :key="editingSessionKey"
        :page-id="activePage.id"
        :target="editingSession.target"
        :area-pt="editingSession.areaPt"
        :content="editingSession.content"
        :viewport="viewport"
        :angle="editingSession.angle"
        :rotation-center-pt="editingSession.rotationCenterPt"
        @close="closeTextEditor"
      />
    </div>
    <CanvasContextMenu
      v-if="contextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      :return-focus="containerRef"
      @execute="executeContextCommand"
      @close="closeContextMenu"
    />
  </div>
</template>

<script setup lang="ts">
// 画布区：左上标尺角、顶部/左侧标尺、页面边界（PageFrame）、X6 画布、分页符叠层。
// 文档真源为 document-store（activePage + 背景页）；选择真源为 selection-store；
// 视口控制器按页取自 PageManager，切换页时重渲染并应用该页视口状态（每页首次显示时 fitToPage 居中）。
// 本文件不写 pt↔px 换算公式（一律经 ViewportController/ViewportTransform）。
// X6 手势回流一律转为命令经 document-store.executeCommand 执行（一次手势一条记录）。
import { computed, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  createDefaultTextContent,
  type DiagramDocument,
  type DiagramEdge,
  type PageUnit,
  type TextContent,
} from '@/domain/diagram'
import type { ViewportController } from '@/application/viewport/viewport-controller'
import { ViewportTransform, type ViewportState } from '@/application/viewport/viewport-transform'
import { resolvePageBackgroundChain } from '@/application/pages/page-background-chain'
import { computeRestoredSelection } from '@/application/selection/restore-selection'
import { GraphAdapter, type EdgeEndpointRef } from '@/infrastructure/x6/graph-adapter'
import { estimateTextSizePt, textAreaForNode } from '@/infrastructure/x6/text-layout'
import type { TextTarget } from '@/application/text/text-target'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes' // 模块副作用：注册内置形状
import { isAutoConnectEligibleNode } from '@/application/arrangement/auto-connect'
import { hasApplicableFormatPaintTarget } from '@/application/format-paint/format-paint-target'
import { contextMenuItems, type ContextKind } from '@/application/menus/context-menu-model'
import { validContainerMembers, validContainerTargets } from '@/application/menus/container-picker-options'
import { isContainerNode } from '@/application/shapes/container-node'
import { useAppStore } from '@/stores/app-store'
import { useDocumentStore } from '@/stores/document-store'
import { useFormatPaintStore } from '@/stores/format-paint-store'
import { useSelectionStore } from '@/stores/selection-store'
import PageBreakOverlay from './PageBreakOverlay.vue'
import PageFrame from './PageFrame.vue'
import RulerCorner from './RulerCorner.vue'
import RulerOverlay from './RulerOverlay.vue'
import TextEditorOverlay from '@/ui/text/TextEditorOverlay.vue'
import CanvasContextMenu from '@/ui/components/CanvasContextMenu.vue'
import { editorServicesKey } from '@/ui/services/editor-services'

interface MenuControllerPort { execute(id: string, invocation?: { trigger?: HTMLElement | null }): void }
const props = defineProps<{ menuController?: MenuControllerPort }>()
const emit = defineEmits<{ viewportChange: [state: ViewportState] }>()

const appStore = useAppStore()
const documentStore = useDocumentStore()
const selectionStore = useSelectionStore()
const formatPaintStore = useFormatPaintStore()
const services = inject(editorServicesKey, null)
const interactionController = services?.canvas

/** Ctrl/Cmd 实时状态（链接打开的 Ctrl/Cmd+点击判定与选择抑制）。 */
const ctrlMetaHeld = ref(false)

const activePage = computed(() => documentStore.activePage)
const pageLayers = computed(() =>
  resolvePageBackgroundChain(documentStore.document, documentStore.activePageId),
)
const pageUnit = computed<PageUnit>(() => activePage.value?.unit ?? 'mm')

const viewport = ref<ViewportState>({ zoom: 1, panX: 0, panY: 0 })
const canvasSize = reactive({ width: 0, height: 0 })

const containerRef = ref<HTMLElement | null>(null)
const contextMenu = ref<{ x: number; y: number; items: ReturnType<typeof contextMenuItems> } | null>(null)
let adapter: GraphAdapter | null = null
let skipDocumentRenderFor: DiagramDocument | null = null
let unsubscribeViewport: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null
/** 已完成首次 fit 的页（每页首次显示时 fitToPage 一次，之后保持用户视口）。 */
const fittedPageIds = new Set<string>()

function activeController(): ViewportController {
  return documentStore.pageManager.controllerFor(documentStore.activePageId)
}

function renderActivePage(): void {
  const page = activePage.value
  if (!adapter || !page) {
    return
  }
  // 渲染前快照领域选择：renderPage 的 clearCells 经 X6 事件链同步清空 store，
  // 渲染后再读 store 已为空（恢复变死代码）；已删除图元由快照过滤丢弃
  const restored = computeRestoredSelection([...selectionStore.selectedIds], page)
  adapter.renderPage(pageLayers.value)
  // 重建后恢复选择：store 与 X6 双侧一致（store 在渲染事件链中已被清空，须自快照恢复）
  selectionStore.setSelection(restored)
  adapter.syncSelection(restored)
}

/** 绑定当前页视口控制器：应用其持久状态并重订阅后续变更。 */
function bindViewport(): void {
  unsubscribeViewport?.()
  const controller = activeController()
  viewport.value = controller.state
  emit('viewportChange', controller.state)
  adapter?.syncViewport(controller.state)
  unsubscribeViewport = controller.subscribe((state) => {
    viewport.value = state
    emit('viewportChange', state)
    adapter?.syncViewport(state)
  })
}

/** 每页首次显示时按视口大小适应页面并居中（初始 zoom=1 pan 由本次 fit 决定）。 */
function fitPageIfFirst(): void {
  const page = activePage.value
  const container = containerRef.value
  const pageId = documentStore.activePageId
  if (!page || !container || fittedPageIds.has(pageId)) {
    return
  }
  const rect = container.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) {
    // 确认容器有尺寸后再标记：零尺寸时不得把首显页永久标记为已 fit
    fittedPageIds.add(pageId)
    activeController().fitToPage(page.pageSize, { width: rect.width, height: rect.height })
  }
}

/** 当前页中的边（命令 before 值从文档读取，响应式代理在此展开为纯值）。 */
function findEdge(edgeId: string): DiagramEdge | undefined {
  return activePage.value?.edges.find((edge) => edge.id === edgeId)
}

// ---------- 文本编辑会话（覆盖层；一次会话一条 EditTextCommand，由覆盖层提交） ----------

/** 打开中的文本编辑会话（null = 未编辑）；编辑期间画布键盘快捷键挂起。 */
let textEditGeneration = 0
const editingSession = ref<{
  key: number
  target: TextTarget
  areaPt: { x: number; y: number; width: number; height: number }
  content: TextContent
  angle?: number
  rotationCenterPt?: { x: number; y: number }
} | null>(null)

const editingSessionKey = computed(() => {
  return editingSession.value?.key ?? 0
})

async function closeTextEditor(restoreCanvasFocus = false): Promise<void> {
  editingSession.value = null
  if (restoreCanvasFocus) {
    await nextTick()
    focusCanvas()
  }
}

/** 打开节点文本编辑：文本区 = bbox − 形状 textAreaInset（pt，文档坐标）。 */
function openNodeTextEditor(nodeId: string): void {
  const page = activePage.value
  const node = page?.nodes.find((n) => n.id === nodeId)
  if (!page || !node) {
    return
  }
  const definition = shapeRegistry.get(node.shape)
  const content = node.text ?? createDefaultTextContent()
  editingSession.value = {
    key: ++textEditGeneration,
    target: { kind: 'node', nodeId },
    areaPt: textAreaForNode(node, definition.textAreaInset, content),
    content,
    angle: node.angle,
    rotationCenterPt: { x: node.x + node.width / 2, y: node.y + node.height / 2 },
  }
}

/** 打开边标签文本编辑（首标签；无标签时提交会追加）。 */
function openEdgeTextEditor(edgeId: string): void {
  const edge = findEdge(edgeId)
  if (!edge) {
    return
  }
  editingSession.value = {
    key: ++textEditGeneration,
    target: { kind: 'edgeLabel', edgeId, labelIndex: 0 },
    areaPt: edgeLabelAreaPt(edge),
    content: edge.labels[0]?.text ?? createDefaultTextContent(),
  }
}

/** 边标签编辑锚区：标签沿线位置处 120×28pt 小矩形（X6 view 取点，退化为两端节点中心中点）。 */
function edgeLabelAreaPt(edge: DiagramEdge): { x: number; y: number; width: number; height: number } {
  const position = edge.labels[0]?.position ?? 0.5
  let point: { x: number; y: number } | null = null
  if (adapter) {
    const view = adapter.getGraph().findViewByCell(edge.id)
    const textElement = (view as unknown as { container?: Element } | null)?.container?.querySelector('text')
    const graphContainer = containerRef.value
    if (textElement && graphContainer) {
      const textRect = textElement.getBoundingClientRect()
      const containerRect = graphContainer.getBoundingClientRect()
      if (textRect.width > 0 && textRect.height > 0) {
        const transform = new ViewportTransform(viewport.value)
        const topLeft = transform.pointToDocument({
          x: textRect.left - containerRect.left,
          y: textRect.top - containerRect.top,
        })
        const bottomRight = transform.pointToDocument({
          x: textRect.right - containerRect.left,
          y: textRect.bottom - containerRect.top,
        })
        const padding = 4
        return {
          x: topLeft.x - padding,
          y: topLeft.y - padding,
          width: bottomRight.x - topLeft.x + padding * 2,
          height: bottomRight.y - topLeft.y + padding * 2,
        }
      }
    }
    if (view && 'getPointAtRatio' in view) {
      point = (view as { getPointAtRatio: (ratio: number) => { x: number; y: number } })
        .getPointAtRatio(position)
    }
  }
  if (!point) {
    const page = activePage.value
    const source = page?.nodes.find((n) => n.id === edge.source.nodeId)
    const target = page?.nodes.find((n) => n.id === edge.target.nodeId)
    point =
      source && target
        ? {
            x: (source.x + source.width / 2 + target.x + target.width / 2) / 2,
            y: (source.y + source.height / 2 + target.y + target.height / 2) / 2,
          }
        : { x: 0, y: 0 }
  }
  const estimated = estimateTextSizePt(edge.labels[0]?.text ?? createDefaultTextContent())
  const width = Math.max(40, estimated.width + 8)
  const height = Math.max(28, estimated.height + 8)
  return { x: point.x - width / 2, y: point.y - height / 2, width, height }
}

/** 双击创建入口（App 转发）：以视口中心为放置点（px→pt 经 ViewportTransform）。 */
function createShapeAtViewportCenter(shapeType: string): void {
  const container = containerRef.value
  if (!container) {
    return
  }
  const rect = container.getBoundingClientRect()
  const centerPt = new ViewportTransform(viewport.value).pointToDocument({
    x: rect.width / 2,
    y: rect.height / 2,
  })
  interactionController?.createShapeAtCenter(shapeType, centerPt)
}

/** 图元库拖拽起点（App 经 shapeDragStartKey 转发）：X6 Dnd 拖拽预览。 */
function startShapeDrag(shapeType: string, e: MouseEvent): void {
  adapter?.startShapeDrag(shapeType, e)
}
function viewportSize(): { width: number; height: number } | null {
  const rect = containerRef.value?.getBoundingClientRect()
  return rect && rect.width > 0 && rect.height > 0 ? { width: rect.width, height: rect.height } : null
}
function zoomIn(): void { activeController().zoomIn() }
function zoomOut(): void { activeController().zoomOut() }
function setZoom(value: number): void { activeController().setZoom(value) }
function fitPage(): void {
  const size = viewportSize()
  if (size && activePage.value) activeController().fitToPage(activePage.value.pageSize, size)
}
function bboxFor(ids: string[]): { x: number; y: number; width: number; height: number } | null {
  const page = activePage.value
  const edgeNodeIds = new Set(page?.edges
    .filter((edge) => ids.includes(edge.id))
    .flatMap((edge) => [edge.source.nodeId, edge.target.nodeId]) ?? [])
  const nodes = page?.nodes.filter((node) => ids.includes(node.id) || edgeNodeIds.has(node.id)) ?? []
  if (nodes.length === 0) return null
  const minX = Math.min(...nodes.map((node) => node.x)); const minY = Math.min(...nodes.map((node) => node.y))
  const maxX = Math.max(...nodes.map((node) => node.x + node.width)); const maxY = Math.max(...nodes.map((node) => node.y + node.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
function fitContent(): void {
  const size = viewportSize(); const page = activePage.value
  if (!size || !page) return
  const bbox = bboxFor(page.nodes.map((node) => node.id))
  if (bbox) activeController().fitToContent(bbox, size); else fitPage()
}
function fitSelection(): void {
  const size = viewportSize(); const bbox = bboxFor(selectionStore.selectedIds)
  if (size && bbox) activeController().fitToSelection(bbox, size)
  else documentStore.setNotice('请先选择节点。')
}
function editNodeText(nodeId: string): void { openNodeTextEditor(nodeId) }
function editEdgeLabel(edgeId: string): void { openEdgeTextEditor(edgeId) }
function locateCell(cellId: string): void {
  const page = activePage.value
  if (!page?.nodes.some(({ id }) => id === cellId) && !page?.edges.some(({ id }) => id === cellId)) return
  selectionStore.setSelection([cellId])
  fitSelection()
}
defineExpose({
  createShapeAtViewportCenter, startShapeDrag, zoomIn, zoomOut, setZoom,
  fitPage, fitContent, fitSelection, editNodeText, editEdgeLabel, locateCell,
})

function openContextMenu(args: { kind: 'blank' | 'node' | 'edge'; cellId?: string; x: number; y: number }): void {
  appStore.beginInteractionBlock('canvas-context-menu')
  let kind: ContextKind = args.kind
  if (args.cellId && selectionStore.selectedIds.includes(args.cellId) && selectionStore.count > 1) {
    kind = 'multi'
  } else if (args.kind === 'node' && args.cellId) {
    const node = activePage.value?.nodes.find((item) => item.id === args.cellId)
    kind = node && isContainerNode(node) ? 'container' : 'node'
    selectionStore.setSelection([args.cellId])
  } else if (args.kind === 'edge' && args.cellId) {
    selectionStore.setSelection([args.cellId])
  }
  const selectedNodes = activePage.value?.nodes.filter((node) => selectionStore.selectedIds.includes(node.id)) ?? []
  const selectedEdges = activePage.value?.edges.filter((edge) => selectionStore.selectedIds.includes(edge.id)) ?? []
  const selectedContainers = selectedNodes.filter(isContainerNode)
  const page = activePage.value
  const availableContainers = page ? validContainerTargets(page, selectedNodes.map(({ id }) => id)) : []
  const canAddMembers = page !== undefined && selectedContainers.length === 1 && validContainerMembers(page, selectedContainers[0].id).length > 0
  const hasFormatPaintSource = formatPaintStore.mode !== 'off' && formatPaintStore.sourceCellId !== null
  const hasCompatibleFormatPaintTarget = page && hasFormatPaintSource
    ? hasApplicableFormatPaintTarget(page, formatPaintStore.sourceCellId!, selectionStore.selectedIds)
    : false
  contextMenu.value = {
    x: args.x,
    y: args.y,
    items: contextMenuItems(kind, {
      canPaste: documentStore.clipboard !== null,
      selectedTargetCount: selectedNodes.length + selectedEdges.length,
      selectedNodeCount: selectedNodes.length,
      selectedGroupCount: selectedNodes.filter((node) => node.shape === 'group').length,
      selectedContainerCount: selectedContainers.length,
      selectedParentedNodeCount: selectedNodes.filter((node) => node.parentId !== undefined).length,
      eligibleNodeCount: selectedNodes.filter(isAutoConnectEligibleNode).length,
      hasTextSelection: selectedNodes.some((node) => node.text !== undefined) || selectedEdges.some((edge) => edge.labels.length > 0),
      hasFormatPaintSource,
      compatibleFormatPaintTargetCount: hasCompatibleFormatPaintTarget ? 1 : 0,
      canAddToContainer: selectedNodes.length > 0 && availableContainers.length > 0,
      canAddMembers,
    }),
  }
}
function executeContextCommand(id: string): void {
  if (props.menuController) props.menuController.execute(id, { trigger: containerRef.value })
  else documentStore.setNotice('右键命令控制器不可用。')
}
function focusCanvas(): void {
  containerRef.value?.focus()
}
function closeContextMenu(): void {
  contextMenu.value = null
  appStore.endInteractionBlock('canvas-context-menu')
  focusCanvas()
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  )
}

/** 画布键盘：Delete/Backspace 删除选择（一条记录）；Ctrl+C/X/V 应用内剪贴板；
 *  F2/Enter（选中单节点）进入文本编辑；Esc 退出格式刷；文本编辑期间画布快捷键整体挂起。 */
function onWindowKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Control' || event.key === 'Meta') {
    ctrlMetaHeld.value = true
  }
  if (isEditableTarget(event.target)) {
    return
  }
  if (appStore.interactionBlocked || document.activeElement !== containerRef.value) return
  if (editingSession.value) {
    return // 编辑期间挂起画布快捷键（避免 Delete 删节点等）
  }
  if (event.key === 'Escape' && formatPaintStore.mode !== 'off') {
    formatPaintStore.cancel()
    event.preventDefault()
    return
  }
  if (event.key === 'F2' || event.key === 'Enter') {
    const ids = selectionStore.selectedIds
    if (ids.length === 1 && activePage.value?.nodes.some((n) => n.id === ids[0])) {
      openNodeTextEditor(ids[0])
      event.preventDefault()
    }
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectionStore.hasSelection) {
      documentStore.deleteSelection()
      event.preventDefault()
    }
    return
  }
  if (!(event.ctrlKey || event.metaKey)) {
    return
  }
  const key = event.key.toLowerCase()
  if (key === 'c') {
    documentStore.copySelection()
    event.preventDefault()
  } else if (key === 'x') {
    documentStore.cutSelection()
    event.preventDefault()
  } else if (key === 'v') {
    event.preventDefault()
    void documentStore.pasteClipboard()
  }
}

function onWindowKeyUp(event: KeyboardEvent): void {
  if (event.key === 'Control' || event.key === 'Meta') {
    ctrlMetaHeld.value = false
  }
}

function onWindowBlur(): void {
  ctrlMetaHeld.value = false
}

onMounted(() => {
  const container = containerRef.value
  if (!container) {
    return
  }
  adapter = new GraphAdapter(container, {
    // X6 手势回流：整体写回当前页控制器，单次通知（同步会再经订阅回到 adapter.syncViewport，值相同自然收敛）
    onViewportChanged: (state) => {
      activeController().setViewport(state)
    },
    // 选择回流：X6 选择顺序即领域选择顺序（首元素为锚点）
    onSelectionChanged: (ids) => {
      selectionStore.setSelection(ids)
    },
    onNodeMoved: (id, before, after) => {
      try {
        interactionController?.moveNode(id, before, after)
        skipDocumentRenderFor = documentStore.document
      } catch (error) {
        skipDocumentRenderFor = null
        throw error
      }
    },
    onNodeClick: (nodeId, modifiers) => {
      // 格式刷模式：点击图元 = 应用格式（不进入选择逻辑，选择已由 suppressSelection 抑制）
      if (formatPaintStore.mode !== 'off') {
        formatPaintStore.applyTo(nodeId)
        return
      }
      // Ctrl/Cmd+点击带链接节点 = 打开链接（普通点击走选择，X6 已处理）
      void interactionController?.openHyperlink(nodeId, modifiers)
    },
    onEdgeClick: (edgeId, modifiers) => {
      if (formatPaintStore.mode !== 'off') {
        formatPaintStore.applyTo(edgeId)
        return
      }
      void interactionController?.openHyperlink(edgeId, modifiers)
    },
    onBlankClick: () => {
      if (formatPaintStore.mode !== 'off') {
        formatPaintStore.cancel()
      }
    },
    onContextMenu: openContextMenu,
    suppressSelection: (cellId) => {
      // 格式刷模式：全部图元不可选（点击=应用格式）
      if (formatPaintStore.mode !== 'off') {
        return true
      }
      // Ctrl/Cmd+点击带链接节点 = 打开链接，不改变选择
      if (ctrlMetaHeld.value) {
        return interactionController?.hasHyperlink(cellId) === true
      }
      return false
    },
    onCreateEdgeRequest: ({ source, target }) => {
      interactionController?.createEdge(source, target)
    },
    onReconnectRequest: ({ edgeId, end, endpoint }: { edgeId: string; end: 'source' | 'target'; endpoint: EdgeEndpointRef }) => {
      interactionController?.reconnectEdge(edgeId, end, endpoint)
    },
    onVerticesChanged: ({ edgeId, vertices }) => {
      interactionController?.updateVertices(edgeId, vertices)
    },
    onResizeGesture: ({ nodeId, before, after }) => {
      interactionController?.resizeNode(nodeId, before, after)
    },
    onRotateGesture: ({ nodeId, before, after }) => {
      interactionController?.rotateNode(nodeId, before, after)
    },
    onShapeDropped: ({ shapeType, topLeftPt }) => {
      // 放置点为节点左上角；createNodeFromShape 以中心定位，按默认尺寸换算
      interactionController?.createShapeAtTopLeft(shapeType, topLeftPt)
    },
    onNodeDblClick: (nodeId) => {
      openNodeTextEditor(nodeId)
    },
    onEdgeDblClick: (edgeId) => {
      openEdgeTextEditor(edgeId)
    },
  })
  renderActivePage()
  adapter.setGridVisible(appStore.showGrid)
  adapter.setGuidesVisible(appStore.showGuides)
  adapter.setSnapToGrid(appStore.snapToGrid, activePage.value?.canvas.gridSize ?? 1)
  bindViewport()
  fitPageIfFirst()

  // 跟踪画布尺寸供标尺长度使用（jsdom 无 ResizeObserver，判空保护）
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        canvasSize.width = rect.width
        canvasSize.height = rect.height
      }
    })
    resizeObserver.observe(container)
  }

  container.addEventListener('keydown', onWindowKeyDown)
  container.addEventListener('keyup', onWindowKeyUp)
  window.addEventListener('blur', onWindowBlur)
})

onBeforeUnmount(() => {
  containerRef.value?.removeEventListener('keydown', onWindowKeyDown)
  containerRef.value?.removeEventListener('keyup', onWindowKeyUp)
  window.removeEventListener('blur', onWindowBlur)
  resizeObserver?.disconnect()
  resizeObserver = null
  unsubscribeViewport?.()
  unsubscribeViewport = null
  adapter?.dispose()
  adapter = null
  appStore.endInteractionBlock('canvas-context-menu')
})

// 切换页：重渲染（含背景页）并应用该页视口状态；进行中的文本编辑随页切换关闭
watch(
  () => documentStore.activePageId,
  () => {
    editingSession.value = null
    bindViewport()
    renderActivePage()
    fitPageIfFirst()
  },
)

watch(
  () => appStore.showGuides,
  (visible) => adapter?.setGuidesVisible(visible),
)

watch(
  [() => appStore.snapToGrid, () => activePage.value?.canvas.gridSize],
  ([enabled, gridSize]) => adapter?.setSnapToGrid(Boolean(enabled), gridSize ?? 1),
)

// 文档内容/设置变化：重渲染当前页（含页面尺寸、背景页引用变化）
watch(
  () => documentStore.document,
  (document) => {
    if (skipDocumentRenderFor === document) {
      skipDocumentRenderFor = null
      return
    }
    skipDocumentRenderFor = null
    renderActivePage()
  },
)

// 领域选择变化 → 同步到 X6（X6 → 领域的回声由 adapter.syncSelection 相等抑制）
watch(
  () => selectionStore.selectedIds,
  (ids) => {
    adapter?.syncSelection(ids)
  },
)

watch(
  () => appStore.showGrid,
  (visible) => {
    adapter?.setGridVisible(visible)
  },
)
</script>

<style scoped>
.canvas-area {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

/* 画布工作区：页面边界（PageFrame）外的底色 */
.graph-viewport {
  position: absolute;
  inset: 0;
  background: #f5f5f5;
}

.with-rulers .graph-viewport {
  left: var(--ruler-size);
  top: var(--ruler-size);
}

.graph-container {
  position: absolute;
  inset: 0;
}

/* 格式刷模式游标反馈（mode≠off 时容器加 format-painting 类） */
.graph-container.format-painting {
  cursor: crosshair;
}

.canvas-corner {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 3;
}

.canvas-ruler-h {
  position: absolute;
  left: var(--ruler-size);
  right: 0;
  top: 0;
  z-index: 2;
}

.canvas-ruler-v {
  position: absolute;
  left: var(--ruler-size);
  top: var(--ruler-size);
  bottom: 0;
  z-index: 2;
}
</style>

<!-- 端口圆点默认隐藏（X6 attrs 内联 style），悬停节点时显示；连线吸附高亮由 X6 highlighter 绘制 -->
<style>
.x6-node:hover .x6-port circle {
  visibility: visible !important;
}
</style>
