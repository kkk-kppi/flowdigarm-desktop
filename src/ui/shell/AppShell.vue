<template>
  <div class="editor-shell" data-testid="editor-shell">
    <TitleBar
      :file-name="fileName"
      :dirty="documentStore.dirty"
      @minimize="onWindowCommand('minimize')"
      @maximize="onWindowCommand('maximize')"
      @close="onWindowCommand('close')"
    />
    <MenuBar :menus="menus" @execute="menuController.execute($event)" />
    <CompactToolbar />
    <PageTabs />
    <div class="shell-main" data-testid="shell-main">
      <ElementLibrary @create-request="onCreateRequest" @more-shapes="onMoreShapes" />
      <CanvasArea ref="canvasAreaRef" class="shell-canvas" :menu-controller="menuController" @viewport-change="onViewportChange" />
      <RightPanel>
        <template #find>
          <FindReplaceTab
            :controller="findController"
            :current-page-id="documentStore.activePageId"
            @back="appStore.showProperties()"
            @help="appStore.openHelp($event)"
          />
        </template>
      </RightPanel>
      <div v-if="appStore.layerManagerOpen" class="layer-wrap">
        <button type="button" class="layer-close" aria-label="关闭图层管理" title="关闭图层管理。返回完整画布空间。" @click="appStore.closeLayerManager()">×</button>
        <LayerManager />
      </div>
    </div>
    <StatusBar
      :selected-count="selectionStore.count"
      :anchor-x="anchorPosition?.x"
      :anchor-y="anchorPosition?.y"
      :page-index="pageIndex"
      :page-count="documentStore.document.pages.length"
      :zoom="viewport.zoom"
      :dirty="documentStore.dirty"
      @set-zoom="onSetZoom"
    />
    <FeatureHelp v-if="appStore.helpId" :help-id="appStore.helpId" @close="appStore.closeHelp()" />
  </div>
</template>

<script setup lang="ts">
import { computed, provide, reactive, ref } from 'vue'
import CanvasArea from '@/ui/canvas/CanvasArea.vue'
import CompactToolbar from '@/ui/toolbar/CompactToolbar.vue'
import ElementLibrary from '@/ui/shapes/ElementLibrary.vue'
import PageTabs from '@/ui/pages/PageTabs.vue'
import RightPanel from '@/ui/inspector/RightPanel.vue'
import FindReplaceTab from '@/ui/search/FindReplaceTab.vue'
import MenuBar from './MenuBar.vue'
import TitleBar from './TitleBar.vue'
import StatusBar from './StatusBar.vue'
import LayerManager from '@/ui/layers/LayerManager.vue'
import FeatureHelp from '@/ui/help/FeatureHelp.vue'
import { shapeDragStartKey } from '@/ui/shapes/shape-drag-key'
import { createMainMenus } from '@/application/menus/menu-model'
import { MenuCommandController, type MenuCallbacks } from '@/application/menus/menu-command-controller'
import { FindController } from '@/application/search/find-controller'
import { formatMeasure } from '@/domain/measurement'
import type { ViewportState } from '@/application/viewport/viewport-transform'
import { useAppStore } from '@/stores/app-store'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'

const emit = defineEmits<{
  fileCommand: [command: 'new' | 'open' | 'save' | 'saveAs' | 'recent' | 'export']
  windowCommand: [command: 'minimize' | 'maximize' | 'close']
}>()

const appStore = useAppStore()
const documentStore = useDocumentStore()
const selectionStore = useSelectionStore()

const canvasAreaRef = ref<InstanceType<typeof CanvasArea> | null>(null)
const viewport = reactive<ViewportState>({ zoom: 1, panX: 0, panY: 0 })

const fileName = computed(() => {
  if (!documentStore.filePath) return documentStore.document.name
  return documentStore.filePath.split(/[\\/]/).at(-1) || documentStore.document.name
})
const pageIndex = computed(() => Math.max(1, documentStore.document.pages.findIndex((page) => page.id === documentStore.activePageId) + 1))
const anchorPosition = computed(() => {
  const page = documentStore.activePage
  const anchor = page?.nodes.find((node) => node.id === selectionStore.anchorId)
  if (!page || !anchor) return null
  return { x: `${formatMeasure(anchor.x, page.unit)} ${page.unit}`, y: `${formatMeasure(anchor.y, page.unit)} ${page.unit}` }
})
const menus = computed(() => createMainMenus({
  canUndo: documentStore.canUndo,
  canRedo: documentStore.canRedo,
  hasSelection: selectionStore.hasSelection,
  canPaste: documentStore.clipboard !== null,
  showRulers: appStore.showRulers,
  showGrid: appStore.showGrid,
  showGuides: appStore.showGuides,
  showPageBreaks: appStore.showPageBreaks,
}))

function pendingFileCommand(command: 'new' | 'open' | 'save' | 'saveAs' | 'recent' | 'export'): void {
  emit('fileCommand', command)
  documentStore.setNotice('文件操作将在下一步桌面接线中打开对话框。')
}

const menuCallbacks: MenuCallbacks = {
  newDocument: () => pendingFileCommand('new'),
  open: () => pendingFileCommand('open'),
  save: () => pendingFileCommand('save'),
  saveAs: () => pendingFileCommand('saveAs'),
  recent: () => pendingFileCommand('recent'),
  export: () => pendingFileCommand('export'),
  pageSetup: () => { appStore.showProperties(); documentStore.setNotice('请在右侧“页面设置”标签中调整页面。') },
  zoomIn: () => canvasAreaRef.value?.zoomIn(),
  zoomOut: () => canvasAreaRef.value?.zoomOut(),
  fitScreen: () => canvasAreaRef.value?.fitPage(),
  fitPage: () => canvasAreaRef.value?.fitPage(),
  fitContent: () => canvasAreaRef.value?.fitContent(),
  fitSelection: () => canvasAreaRef.value?.fitSelection(),
  insertEdge: () => documentStore.setNotice('请从节点端口拖动以创建连接线。'),
  insertImage: () => documentStore.setNotice('外部图片文件选择将在下一步桌面接线中提供。'),
  font: () => documentStore.setNotice('请在右侧属性面板设置字体。'),
  alignment: () => documentStore.setNotice('请从“工具 → 对齐”选择具体方向。'),
  autoAlign: () => documentStore.setNotice('请从“工具 → 对齐”选择具体方向。'),
  find: () => appStore.openFindPanel(),
  layers: () => appStore.openLayerManager(),
  preferences: () => appStore.openHelp('preferences'),
  helpCenter: () => appStore.openHelp('menus'),
  shortcuts: () => appStore.openHelp('shortcuts'),
  about: () => appStore.openHelp('about'),
  editText: () => documentStore.setNotice('按 F2 或双击节点编辑文本。'),
  editLabel: () => documentStore.setNotice('双击连线编辑标签。'),
  link: () => documentStore.setNotice('请在右侧属性面板设置链接。'),
  lineStyle: () => documentStore.setNotice('请在右侧属性面板设置线条样式。'),
  formatPaint: () => documentStore.setNotice('请使用工具栏格式刷。'),
  addContainer: () => documentStore.setNotice('请先同时选择成员与目标容器。'),
  addMembers: () => documentStore.setNotice('请先同时选择容器和要添加的成员。'),
}

const menuController = new MenuCommandController({
  document: documentStore,
  selection: selectionStore,
  app: appStore,
  callbacks: menuCallbacks,
})

const findController = new FindController({
  getDocument: () => documentStore.document,
  executeCommand: (command) => documentStore.executeCommand(command),
  activateMatch: (match) => {
    if (match.pageId !== documentStore.activePageId) documentStore.switchPage(match.pageId)
    selectionStore.setSelection([match.cellId])
  },
})

provide(shapeDragStartKey, (shapeType, e) => {
  canvasAreaRef.value?.startShapeDrag(shapeType, e)
})

function onCreateRequest(shapeType: string): void {
  canvasAreaRef.value?.createShapeAtViewportCenter(shapeType)
}

function onMoreShapes(): void {
  documentStore.setNotice('更多形状将在后续版本提供。')
}

function onWindowCommand(command: 'minimize' | 'maximize' | 'close'): void {
  emit('windowCommand', command)
  documentStore.setNotice('窗口控制将在下一步桌面接线中启用。')
}

function onSetZoom(value: number | 'fit'): void {
  if (value === 'fit') canvasAreaRef.value?.fitPage()
  else canvasAreaRef.value?.setZoom(value)
}

function onViewportChange(state: ViewportState): void {
  Object.assign(viewport, state)
}
</script>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

.shell-main {
  display: flex;
  flex: 1;
  min-height: 0;
}

.shell-canvas {
  flex: 1;
  min-width: 0;
}

.layer-wrap { position: relative; display: flex; height: 100%; }
.layer-close { position: absolute; top: 4px; right: 6px; z-index: 2; width: 24px; height: 24px; border: 0; background: transparent; cursor: pointer; }
.layer-close:focus-visible { outline: 2px solid var(--color-primary); }
</style>
