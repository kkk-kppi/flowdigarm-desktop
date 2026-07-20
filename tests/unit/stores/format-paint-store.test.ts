// tests/unit/stores/format-paint-store.test.ts
// 格式刷 store：once 应用后自动 off；continuous 多次应用保持；Esc cancel 清态；
// 无效目标返回 false 不退模式；armOnce 仅在恰好 1 个选中图元时生效。
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultTextContent, createEmptyPage } from '@/domain/diagram'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useFormatPaintStore } from '@/stores/format-paint-store'
import { createTestDocument, createTestNode } from '../../helpers/test-document'

function setup() {
  setActivePinia(createPinia())
  const sourceStyle = {
    fill: '#FF0000',
    fillOpacity: 0.5,
    stroke: '#00FF00',
    strokeWidth: 3,
  }
  const page = createEmptyPage({
    id: 'page-1',
    nodes: [
      createTestNode({
        id: 'source',
        style: { ...sourceStyle },
        text: createDefaultTextContent('源'),
        zIndex: 0,
      }),
      createTestNode({ id: 'target-1', zIndex: 1 }),
      createTestNode({ id: 'target-2', zIndex: 2 }),
    ],
    edges: [],
  })
  const document = { ...createTestDocument(), pages: [page] }
  const documentStore = useDocumentStore()
  documentStore.loadDocument(document)
  const selection = useSelectionStore()
  const paint = useFormatPaintStore()
  return { documentStore, selection, paint }
}

describe('format-paint-store arm 与状态', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始为 off；armOnce 恰好 1 个选中图元时进入 once 并捕获源', () => {
    const { selection, paint } = setup()
    expect(paint.mode).toBe('off')
    expect(paint.sourceCellId).toBeNull()

    selection.setSelection(['source'])
    paint.armOnce()
    expect(paint.mode).toBe('once')
    expect(paint.sourceCellId).toBe('source')
  })

  it('armOnce 在非单选（0 个 / 多个 / 不存在）时不动作', () => {
    const { selection, paint } = setup()
    paint.armOnce()
    expect(paint.mode).toBe('off')

    selection.setSelection(['source', 'target-1'])
    paint.armOnce()
    expect(paint.mode).toBe('off')

    selection.setSelection(['不存在'])
    paint.armOnce()
    expect(paint.mode).toBe('off')
  })

  it('armContinuous 进入 continuous 模式', () => {
    const { selection, paint } = setup()
    selection.setSelection(['source'])
    paint.armContinuous()
    expect(paint.mode).toBe('continuous')
    expect(paint.sourceCellId).toBe('source')
  })
})

describe('format-paint-store applyTo', () => {
  it('once 模式：应用一次后自动 off 并清源；目标样式被改写', () => {
    const { documentStore, selection, paint } = setup()
    selection.setSelection(['source'])
    paint.armOnce()
    const ok = paint.applyTo('target-1')
    expect(ok).toBe(true)
    expect(paint.mode).toBe('off')
    expect(paint.sourceCellId).toBeNull()
    const target = documentStore.activePage!.nodes.find((n) => n.id === 'target-1')!
    expect(target.style).toMatchObject({ fill: '#FF0000', strokeWidth: 3 })
    // 一条「格式刷」撤销记录
    expect(documentStore.undoLabel).toBe('格式刷')
  })

  it('continuous 模式：可连续应用多个目标，模式保持', () => {
    const { documentStore, selection, paint } = setup()
    selection.setSelection(['source'])
    paint.armContinuous()
    expect(paint.applyTo('target-1')).toBe(true)
    expect(paint.mode).toBe('continuous')
    expect(paint.sourceCellId).toBe('source')
    expect(paint.applyTo('target-2')).toBe(true)
    expect(paint.mode).toBe('continuous')
    const page = documentStore.activePage!
    expect(page.nodes.find((n) => n.id === 'target-1')!.style.fill).toBe('#FF0000')
    expect(page.nodes.find((n) => n.id === 'target-2')!.style.fill).toBe('#FF0000')
  })

  it('无效目标（类型不匹配/不存在/无变化）返回 false 且不退模式', () => {
    const { selection, paint } = setup()
    selection.setSelection(['source'])
    paint.armContinuous()
    expect(paint.applyTo('不存在')).toBe(false)
    expect(paint.mode).toBe('continuous')
    expect(paint.sourceCellId).toBe('source')
    // 源刷到自身（无变化）同样无效
    expect(paint.applyTo('source')).toBe(false)
    expect(paint.mode).toBe('continuous')
  })

  it('cancel（Esc）：mode 归 off 并清源', () => {
    const { selection, paint } = setup()
    selection.setSelection(['source'])
    paint.armContinuous()
    paint.cancel()
    expect(paint.mode).toBe('off')
    expect(paint.sourceCellId).toBeNull()
  })

  it('off 模式下 applyTo 返回 false', () => {
    const { paint } = setup()
    expect(paint.applyTo('target-1')).toBe(false)
  })
})
