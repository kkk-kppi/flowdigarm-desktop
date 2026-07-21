import { createBenchmarkDocument } from './benchmark-document'
import type { FlowE2EHook } from './e2e-types'
import type { BrowserE2EPlatform } from '@/platform/browser-e2e-platform'
import type { useDocumentStore } from '@/stores/document-store'
import type { useSelectionStore } from '@/stores/selection-store'
import { serializeDiagramDocument } from '@/domain/document-schema'

interface HookTarget {
  __FLOW_E2E__?: FlowE2EHook
}

export function installE2EHook(target: HookTarget, dependencies: {
  documentStore: ReturnType<typeof useDocumentStore>
  selectionStore: ReturnType<typeof useSelectionStore>
  runtime: BrowserE2EPlatform
}): () => void {
  const { documentStore, selectionStore, runtime } = dependencies
  const unmountResource = runtime.control.mountHook()
  const hook: FlowE2EHook = {
    injectBenchmark() {
      documentStore.loadDocument(createBenchmarkDocument())
      selectionStore.clear()
    },
    injectDocument(document, path) {
      documentStore.loadDocument(structuredClone(document), path)
      selectionStore.clear()
    },
    async injectRecovery(document = documentStore.document) {
      await runtime.recovery.write({
        documentId: document.id,
        versionToken: `${documentStore.documentEpoch}:${documentStore.currentRevision}`,
        name: document.name,
        json: serializeDiagramDocument(document),
        sourcePath: documentStore.filePath ?? undefined,
      })
    },
    snapshot: () => ({
      document: structuredClone(documentStore.document),
      selectedIds: [...selectionStore.selectedIds],
      revision: documentStore.currentRevision,
      canUndo: documentStore.canUndo,
      canRedo: documentStore.canRedo,
      dirty: documentStore.dirty,
      filePath: documentStore.filePath,
    }),
    selectionIds: () => [...selectionStore.selectedIds],
    nodePosition(id) {
      const node = documentStore.activePage?.nodes.find((candidate) => candidate.id === id)
      return node ? { x: node.x, y: node.y } : null
    },
    isDirty: () => documentStore.dirty,
    fail: (operation, enabled) => runtime.control.fail(operation, enabled),
    seedFile: (path, json) => runtime.control.seedFile(path, json),
    artifacts: () => runtime.control.artifacts(),
    resources: () => runtime.control.resources(),
    reset() {
      runtime.control.reset()
      documentStore.newDocument()
      selectionStore.clear()
    },
  }
  target.__FLOW_E2E__ = hook
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    if (target.__FLOW_E2E__ === hook) delete target.__FLOW_E2E__
    unmountResource()
  }
}
