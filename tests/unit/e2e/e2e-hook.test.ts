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

    const dispose = installE2EHook(target, { documentStore, selectionStore, runtime })
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
    expect(target.__FLOW_E2E__!.resources()).toEqual({ hooks: 1, listeners: 1, timers: 0, controllers: 1 })

    dispose()
    expect(target.__FLOW_E2E__).toBeUndefined()
    expect(runtime.control.resources()).toEqual({ hooks: 0, listeners: 0, timers: 0, controllers: 1 })
  })
})
