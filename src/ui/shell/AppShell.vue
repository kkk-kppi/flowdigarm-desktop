<template>
  <div class="editor-shell" data-testid="editor-shell">
    <div
      class="shell-background"
      data-testid="shell-background"
      :inert="modalOpen ? true : undefined"
      :aria-hidden="modalOpen ? 'true' : undefined"
    >
      <template v-if="editorReady">
        <TitleBar
          :file-name="fileName"
          :dirty="documentStore.dirty"
          :maximized="maximized"
          @minimize="onWindowCommand('minimize')"
          @maximize="onWindowCommand('maximize')"
          @close="onWindowCommand('close')"
        />
        <MenuBar :menus="menus" @execute="onMenuExecute" @open-change="menuOpen = $event" />
        <CompactToolbar />
        <PageTabs />
        <div class="shell-main" data-testid="shell-main">
          <ElementLibrary @create-request="onCreateRequest" @more-shapes="onMoreShapes" />
          <CanvasArea ref="canvasAreaRef" class="shell-canvas" :menu-controller="menuController" @viewport-change="onViewportChange" />
          <RightPanel ref="rightPanelRef">
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
            <LayerManager :controller="layerController" />
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
        <FeatureHelp v-if="appStore.helpId" :help-id="appStore.helpId" :return-focus="helpReturnFocus" @close="closeHelp" />
      </template>
      <div v-else class="startup-gate" data-testid="startup-gate" role="status">正在检查恢复数据…</div>
    </div>
    <ContainerMembershipPicker
      v-if="editorReady && containerPickerRequest"
      :request="containerPickerRequest"
      :error="containerPickerError"
      @confirm="confirmContainerMembership"
      @cancel="cancelContainerMembership"
    />
    <UnsavedChangesDialog
      v-if="editorReady && unsavedRequest"
      :action="unsavedRequest.action"
      :return-focus="unsavedReturnFocus"
      @choose="onUnsavedChoice"
    />
    <RecoveryDialog
      v-if="recoverySnapshot"
      :snapshot="recoverySnapshot"
      @restore="restoreRecovery"
      @discard="discardRecovery"
    />
    <PreferencesDialog
      v-if="editorReady && preferencesOpen"
      :model-value="currentPreferences"
      :return-focus="preferencesReturnFocus"
      @apply="applyPreferences"
      @close="closePreferences"
    />
    <ExportDialog
      v-if="editorReady && exportOpen && services"
      :controller="services.export"
      :file-name="documentStore.document.name"
      :png-dpi="appStore.pngDpi"
      :return-focus="exportReturnFocus"
      @close="closeExport"
      @help="openExportHelp"
      @success="documentStore.setNotice(`已导出到 ${$event}`)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
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
import ContainerMembershipPicker from '@/ui/components/ContainerMembershipPicker.vue'
import UnsavedChangesDialog from '@/ui/dialogs/UnsavedChangesDialog.vue'
import RecoveryDialog from '@/ui/dialogs/RecoveryDialog.vue'
import PreferencesDialog from '@/ui/dialogs/PreferencesDialog.vue'
import ExportDialog from '@/ui/dialogs/ExportDialog.vue'
import { shapeDragStartKey } from '@/ui/shapes/shape-drag-key'
import { createMainMenus } from '@/application/menus/menu-model'
import { isContainerNode } from '@/application/shapes/container-node'
import {
  MenuCommandController,
  type ContainerMembershipSelection,
  type ContainerPickerRequest,
  type MenuCallbacks,
  type MenuInvocation,
} from '@/application/menus/menu-command-controller'
import type { CanvasController } from '@/application/canvas/canvas-controller'
import { LayerManagerController } from '@/application/layers/layer-manager-controller'
import { FindController } from '@/application/search/find-controller'
import { isAutoConnectEligibleNode } from '@/application/arrangement/auto-connect'
import { geometryDisplayValue } from '@/application/inspector/property-view-model'
import type { ViewportState } from '@/application/viewport/viewport-transform'
import { useAppStore } from '@/stores/app-store'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useFormatPaintStore } from '@/stores/format-paint-store'
import { editorServicesKey } from '@/ui/services/editor-services'
import type { EditorPreferences } from '@/application/settings/settings-controller'
import type { RecoverySnapshot } from '@/application/persistence/persistence-ports'

const emit = defineEmits<{
  fileCommand: [command: 'new' | 'open' | 'save' | 'saveAs' | 'recent' | 'export']
  windowCommand: [command: 'minimize' | 'maximize' | 'close']
}>()

const appStore = useAppStore()
const documentStore = useDocumentStore()
const selectionStore = useSelectionStore()
const formatPaintStore = useFormatPaintStore()
const services = inject(editorServicesKey, null)

const canvasAreaRef = ref<CanvasController | null>(null)
const rightPanelRef = ref<{ focusSection(section: 'link' | 'text' | 'line'): Promise<void> } | null>(null)
const helpReturnFocus = ref<HTMLElement | null>(null)
const containerPickerRequest = ref<ContainerPickerRequest | null>(null)
const containerPickerReturnFocus = ref<HTMLElement | null>(null)
const containerPickerError = ref<string | undefined>()
const fileBusy = ref(false)
const recentDocuments = ref(services?.file.recentDocuments ?? [])
const recoverySnapshot = ref<RecoverySnapshot | null>(null)
const startupComplete = ref(!services)
const preferencesOpen = ref(false)
const preferencesReturnFocus = ref<HTMLElement | null>(null)
const exportOpen = ref(false)
const exportReturnFocus = ref<HTMLElement | null>(null)
const menuOpen = ref(false)
const unsavedReturnFocus = ref<HTMLElement | null>(null)
const maximized = ref(false)
const viewport = reactive<ViewportState>({ zoom: 1, panX: 0, panY: 0 })

let windowStateDisposed = false
let stopWatchingMaximized: (() => void) | undefined

const unsavedRequest = computed(() => services?.unsaved.request.value ?? null)
const editorReady = computed(() => startupComplete.value && recoverySnapshot.value === null)
const modalOpen = computed(() => Boolean(
  containerPickerRequest.value || unsavedRequest.value || recoverySnapshot.value || preferencesOpen.value || exportOpen.value,
))
const interactionBlocked = computed(() => modalOpen.value || menuOpen.value || appStore.helpId !== null)
const currentPreferences = computed<EditorPreferences>(() => ({
  theme: appStore.theme,
  showRulers: appStore.showRulers,
  showGrid: appStore.showGrid,
  showGuides: appStore.showGuides,
  showPageBreaks: appStore.showPageBreaks,
  snapToGrid: appStore.snapToGrid,
  defaultZoom: appStore.defaultZoom,
  defaultPageUnit: appStore.defaultPageUnit,
  defaultConnector: appStore.defaultConnector,
  recentLimit: appStore.recentLimit,
  pngDpi: appStore.pngDpi,
}))

const fileName = computed(() => {
  if (!documentStore.filePath) {
    return documentStore.document.name.toLowerCase().endsWith('.flowdiagram')
      ? documentStore.document.name
      : `${documentStore.document.name}.flowdiagram`
  }
  return documentStore.filePath.split(/[\\/]/).at(-1) || documentStore.document.name
})
const pageIndex = computed(() => Math.max(1, documentStore.document.pages.findIndex((page) => page.id === documentStore.activePageId) + 1))
const anchorPosition = computed(() => {
  const page = documentStore.activePage
  const anchor = page?.nodes.find((node) => node.id === selectionStore.anchorId)
  if (!page || !anchor) return null
  return { x: `${geometryDisplayValue(anchor.x, page.unit)} ${page.unit}`, y: `${geometryDisplayValue(anchor.y, page.unit)} ${page.unit}` }
})
const selectionSummary = computed(() => {
  const page = documentStore.activePage
  const selectedNodes = page?.nodes.filter((node) => selectionStore.selectedIds.includes(node.id)) ?? []
  const selectedEdges = page?.edges.filter((edge) => selectionStore.selectedIds.includes(edge.id)) ?? []
  return {
    selectedNodeCount: selectedNodes.length,
    eligibleNodeCount: selectedNodes.filter(isAutoConnectEligibleNode).length,
    selectedGroupCount: selectedNodes.filter((node) => node.shape === 'group').length,
    selectedContainerCount: selectedNodes.filter(isContainerNode).length,
    hasTextSelection: selectedNodes.some((node) => node.text !== undefined) || selectedEdges.some((edge) => edge.labels.length > 0),
  }
})
const menus = computed(() => createMainMenus({
  canUndo: documentStore.canUndo,
  canRedo: documentStore.canRedo,
  hasSelection: selectionStore.hasSelection,
  canPaste: documentStore.canPaste,
  ...selectionSummary.value,
  showRulers: appStore.showRulers,
  showGrid: appStore.showGrid,
  showGuides: appStore.showGuides,
  showPageBreaks: appStore.showPageBreaks,
  recentDocuments: recentDocuments.value,
  fileBusy: fileBusy.value,
}))

async function pendingFileCommand(
  command: 'new' | 'open' | 'save' | 'saveAs' | 'recent' | 'export',
): Promise<void> {
  emit('fileCommand', command)
  if (!services) {
    documentStore.setNotice('桌面服务不可用。')
    return
  }
  fileBusy.value = true
  try {
    if (command === 'new') await services.file.newDocument()
    else if (command === 'open') await services.file.openDocument()
    else if (command === 'save') await services.file.save()
    else if (command === 'saveAs') await services.file.saveAs()
    else if (command === 'recent') {
      recentDocuments.value = await services.file.loadRecent(appStore.recentLimit)
      if (recentDocuments.value.length === 0) documentStore.setNotice('没有最近文件。')
      return
    } else {
      documentStore.setNotice('请使用导出面板选择格式。')
      return
    }
    recentDocuments.value = await services.file.loadRecent(appStore.recentLimit)
  } finally {
    fileBusy.value = false
  }
}

const menuCallbacks: MenuCallbacks = {
  newDocument: () => { void pendingFileCommand('new') },
  open: () => { void pendingFileCommand('open') },
  save: () => { void pendingFileCommand('save') },
  saveAs: () => { void pendingFileCommand('saveAs') },
  recent: () => { void pendingFileCommand('recent') },
  export: openExport,
  pageSetup: () => { appStore.showProperties(); documentStore.setNotice('请在右侧“页面设置”标签中调整页面。') },
  zoomIn: () => canvasAreaRef.value?.zoomIn(),
  zoomOut: () => canvasAreaRef.value?.zoomOut(),
  fitScreen: () => canvasAreaRef.value?.fitPage(),
  fitPage: () => canvasAreaRef.value?.fitPage(),
  fitContent: () => canvasAreaRef.value?.fitContent(),
  fitSelection: () => canvasAreaRef.value?.fitSelection(),
  insertEdge: () => documentStore.setNotice('请从节点端口拖动以创建连接线。'),
  insertImage: () => { void runImageImport() },
  alignment: () => documentStore.setNotice('请从“工具 → 对齐”选择具体方向。'),
  autoAlign: () => documentStore.setNotice('请从“工具 → 对齐”选择具体方向。'),
  find: () => appStore.openFindPanel(),
  layers: () => appStore.openLayerManager(),
  preferences: openPreferences,
  helpCenter: (request) => openHelp('menus', request),
  shortcuts: (request) => openHelp('shortcuts', request),
  about: (request) => openHelp('about', request),
  editText: ({ cellId }) => canvasAreaRef.value?.editNodeText(cellId),
  editLabel: ({ cellId }) => canvasAreaRef.value?.editEdgeLabel(cellId),
  focusInspector: ({ section }) => { void rightPanelRef.value?.focusSection(section) },
  openContainerPicker: openContainerPicker,
}

const menuController = new MenuCommandController({
  document: documentStore,
  selection: selectionStore,
  app: appStore,
  formatPaint: formatPaintStore,
  callbacks: menuCallbacks,
})

const layerController = new LayerManagerController({
  getDocument: () => documentStore.document,
  getActivePageId: () => documentStore.activePageId,
  switchPage: (pageId) => documentStore.switchPage(pageId),
  getSelectedIds: () => selectionStore.selectedIds,
  setSelection: (ids) => selectionStore.setSelection(ids),
  executeCommand: (command) => documentStore.executeCommand(command),
  setNotice: (notice) => documentStore.setNotice(notice),
  canvas: { locateCell: (cellId) => canvasAreaRef.value?.locateCell(cellId) },
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
  if (!services) {
    documentStore.setNotice('桌面服务不可用。')
    return
  }
  if (command === 'minimize') void services.window.minimize()
  else if (command === 'maximize') void services.window.toggleMaximize()
  else void services.window.requestClose()
}

function watchWindowState(): void {
  if (!services) return
  void services.window.watchMaximized((value) => { maximized.value = value })
    .then((stop) => {
      if (windowStateDisposed) stop()
      else stopWatchingMaximized = stop
    })
    .catch(() => documentStore.setNotice('窗口状态同步失败，窗口控制仍可使用。'))
}

function onMenuExecute(id: string, trigger: HTMLButtonElement | null): void {
  if (!editorReady.value) return
  const recentMatch = /^file-recent-(\d+)$/.exec(id)
  if (recentMatch) {
    const recent = recentDocuments.value[Number(recentMatch[1])]
    if (recent) void openRecent(recent.path)
    return
  }
  menuController.execute(id, { trigger })
}

async function openRecent(path: string): Promise<void> {
  if (!services || fileBusy.value) return
  fileBusy.value = true
  try {
    await services.file.openRecent(path)
    recentDocuments.value = await services.file.loadRecent(appStore.recentLimit)
  } finally {
    fileBusy.value = false
  }
}

async function runImageImport(): Promise<void> {
  if (!services || fileBusy.value) {
    if (!services) documentStore.setNotice('桌面服务不可用。')
    return
  }
  fileBusy.value = true
  try {
    await services.imageImport()
  } finally {
    fileBusy.value = false
  }
}

function openPreferences(request: MenuInvocation): void {
  if (!editorReady.value) return
  if (!services) {
    documentStore.setNotice('桌面服务不可用。')
    return
  }
  preferencesReturnFocus.value = request.trigger?.isConnected ? request.trigger : null
  preferencesOpen.value = true
}

function closePreferences(): void {
  preferencesOpen.value = false
  void nextTick(() => { preferencesReturnFocus.value = null })
}

function openExport(request: MenuInvocation): void {
  emit('fileCommand', 'export')
  if (!services) {
    documentStore.setNotice('桌面服务不可用。')
    return
  }
  exportReturnFocus.value = request.trigger?.isConnected ? request.trigger : null
  exportOpen.value = true
}

function closeExport(): void {
  exportOpen.value = false
  void nextTick(() => { exportReturnFocus.value = null })
}

function openExportHelp(): void {
  helpReturnFocus.value = exportReturnFocus.value?.isConnected ? exportReturnFocus.value : null
  exportOpen.value = false
  appStore.openHelp('export')
}

async function applyPreferences(settings: EditorPreferences): Promise<void> {
  if (!services) return
  fileBusy.value = true
  try {
    await services.settings.apply(settings)
    documentStore.configureDefaults(settings)
    recentDocuments.value = await services.file.loadRecent(settings.recentLimit)
    closePreferences()
  } finally {
    fileBusy.value = false
  }
}

function onUnsavedChoice(choice: 'save' | 'discard' | 'cancel'): void {
  services?.unsaved.choose(choice)
}

function restoreRecovery(): void {
  if (services?.recovery.restore()) recoverySnapshot.value = null
}

async function discardRecovery(): Promise<void> {
  if (!services) return
  await services.recovery.discard()
  recoverySnapshot.value = services.recovery.pending
}

watch(unsavedRequest, (request, previous) => {
  if (request && !previous) {
    unsavedReturnFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
  } else if (!request && previous) {
    void nextTick(() => { unsavedReturnFocus.value = null })
  }
})

watch(interactionBlocked, (blocked) => {
  if (blocked) appStore.beginInteractionBlock('shell-overlay')
  else appStore.endInteractionBlock('shell-overlay')
}, { immediate: true })

onBeforeUnmount(() => {
  windowStateDisposed = true
  stopWatchingMaximized?.()
  stopWatchingMaximized = undefined
  appStore.endInteractionBlock('shell-overlay')
})

function openHelp(helpId: string, request: MenuInvocation): void {
  helpReturnFocus.value = request.trigger?.isConnected ? request.trigger : null
  appStore.openHelp(helpId)
}

function closeHelp(): void {
  const closedExportHelp = appStore.helpId === 'export'
  appStore.closeHelp()
  helpReturnFocus.value = null
  if (closedExportHelp) exportReturnFocus.value = null
}

function openContainerPicker(request: ContainerPickerRequest): void {
  containerPickerReturnFocus.value = request.trigger?.isConnected ? request.trigger : null
  containerPickerError.value = undefined
  containerPickerRequest.value = request
}

async function closeContainerPicker(): Promise<void> {
  containerPickerRequest.value = null
  await nextTick()
  if (containerPickerReturnFocus.value?.isConnected) containerPickerReturnFocus.value.focus()
  containerPickerReturnFocus.value = null
  containerPickerError.value = undefined
}

function cancelContainerMembership(): void {
  menuController.cancelContainerMembership()
  void closeContainerPicker()
}

function confirmContainerMembership(selection: ContainerMembershipSelection): void {
  if (menuController.confirmContainerMembership(selection)) {
    void closeContainerPicker()
  } else {
    containerPickerError.value = documentStore.lastNotice ?? '命令执行失败。'
  }
}

function onSetZoom(value: number | 'fit'): void {
  if (value === 'fit') canvasAreaRef.value?.fitPage()
  else canvasAreaRef.value?.setZoom(value)
}

function onViewportChange(state: ViewportState): void {
  Object.assign(viewport, state)
}

onMounted(async () => {
  watchWindowState()
  if (!services) return
  let startupDependencyFailed = false
  try {
    const settings = await services.settings.load()
    appStore.applyPreferences(settings)
    documentStore.configureDefaults(settings)
  } catch {
    startupDependencyFailed = true
  }
  try {
    recentDocuments.value = await services.file.loadRecent(appStore.recentLimit)
  } catch {
    startupDependencyFailed = true
  }
  if (startupDependencyFailed) {
    documentStore.setNotice('启动设置或最近文件加载失败，已使用安全默认设置。')
  }
  try {
    recoverySnapshot.value = await services.recovery.checkStartup()
  } catch {
    documentStore.setNotice('恢复数据检查失败，已打开编辑器。')
  } finally {
    startupComplete.value = true
  }
})
</script>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
  position: relative;
}

.shell-background {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.startup-gate { display: grid; flex: 1; place-items: center; color: var(--color-text-secondary); }

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
