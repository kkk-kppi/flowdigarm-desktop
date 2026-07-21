import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createBrowserE2EPlatform } from '@/platform/browser-e2e-platform'
import { installE2EHook } from '@/e2e/e2e-hook'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'

describe('E2E assertion hook', () => {
  it('injects deterministic fixtures, reads cloned state, controls failures, and cleans up', () => {
    setActivePinia(createPinia())
    const documentStore = useDocumentStore()
    const selectionStore = useSelectionStore()
    const runtime = createBrowserE2EPlatform(localStorage)
    const target = {} as Window

    const disposeApplication = vi.fn(() => ({ listeners: 0, timers: 0, controllers: 0 }))
    const resourceDiagnostics = vi.fn(() => ({ listeners: [], timers: [] }))
    const dispose = installE2EHook(target, { documentStore, selectionStore, runtime, disposeApplication, resourceDiagnostics })
    expect(target.__FLOW_E2E__).toBeDefined()
    target.__FLOW_E2E__!.injectBenchmark()
    const snapshot = target.__FLOW_E2E__!.snapshot()
    expect(snapshot.document.pages[0].nodes).toHaveLength(500)
    expect(snapshot.document.pages[0].edges).toHaveLength(800)
    expect(target.__FLOW_E2E__!.selectionIds()).toEqual([])
    expect(target.__FLOW_E2E__!.nodePosition(snapshot.document.pages[0].nodes[0].id)).toMatchObject({ x: 30, y: 30 })
    expect(target.__FLOW_E2E__!.isDirty()).toBe(false)
    snapshot.document.pages[0].nodes.length = 0
    expect(documentStore.activePage?.nodes).toHaveLength(500)

    target.__FLOW_E2E__!.fail('save', true)
    expect(runtime.control.failures()).toContain('save')
    expect(target.__FLOW_E2E__!.artifactBytes('/missing')).toBeNull()
    expect(target.__FLOW_E2E__!.disposeApplication()).toEqual({ listeners: 0, timers: 0, controllers: 0 })
    expect(disposeApplication).toHaveBeenCalledOnce()
    expect(target.__FLOW_E2E__!.resourceDiagnostics()).toEqual({ listeners: [], timers: [] })

    dispose()
    expect(target.__FLOW_E2E__).toBeUndefined()
  })
})
