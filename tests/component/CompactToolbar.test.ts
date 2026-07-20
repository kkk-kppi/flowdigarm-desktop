// tests/component/CompactToolbar.test.ts
// 紧凑工具栏（48px）：撤销/重做 disabled 联动与 tooltip；剪贴板三钮禁用态；格式刷禁用占位；
// 字体 B/I/U/S 聚合态（value/mixed/none）；点击 bold 执行一条「文本样式」记录；段落对齐六钮。
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CompactToolbar from '@/ui/toolbar/CompactToolbar.vue'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import { createDefaultTextContent, type DiagramDocument } from '@/domain/diagram'
import { createTestDocument } from '../helpers/test-document'

function mountToolbar(document: DiagramDocument = createTestDocument()) {
  setActivePinia(createPinia())
  const store = useDocumentStore()
  store.loadDocument(document)
  const selection = useSelectionStore()
  const wrapper = mount(CompactToolbar)
  return { wrapper, store, selection }
}

async function select(
  wrapper: VueWrapper,
  selection: ReturnType<typeof useSelectionStore>,
  ids: string[],
): Promise<void> {
  selection.setSelection(ids)
  await wrapper.vm.$nextTick()
}

describe('CompactToolbar 操作组', () => {
  it('初始撤销/重做禁用；执行命令后撤销可用且 tooltip 含命令标签', async () => {
    const { wrapper, store, selection } = mountToolbar()
    const undo = wrapper.find('[data-testid="tb-undo"]')
    const redo = wrapper.find('[data-testid="tb-redo"]')
    expect(undo.attributes('disabled')).toBeDefined()
    expect(redo.attributes('disabled')).toBeDefined()

    await select(wrapper, selection, ['node-1'])
    await wrapper.find('[data-testid="tb-bold"]').trigger('click')
    expect(store.undoLabel).toBe('文本样式')
    expect(wrapper.find('[data-testid="tb-undo"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="tb-undo"]').attributes('title')).toContain('文本样式')

    store.undo()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="tb-redo"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="tb-redo"]').attributes('title')).toContain('文本样式')
  })

  it('撤销/重做按钮点击调用 store', async () => {
    const { wrapper, store, selection } = mountToolbar()
    await select(wrapper, selection, ['node-1'])
    await wrapper.find('[data-testid="tb-bold"]').trigger('click')
    await wrapper.find('[data-testid="tb-undo"]').trigger('click')
    expect(store.document.pages[0].nodes[0].text?.style.bold).toBe(false)
    await wrapper.find('[data-testid="tb-redo"]').trigger('click')
    expect(store.document.pages[0].nodes[0].text?.style.bold).toBe(true)
  })
})

describe('CompactToolbar 粘贴板组', () => {
  it('空选择时复制/剪切禁用；空剪贴板时粘贴禁用；格式刷禁用占位', () => {
    const { wrapper } = mountToolbar()
    expect(wrapper.find('[data-testid="tb-copy"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="tb-cut"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="tb-paste"]').attributes('disabled')).toBeDefined()
    const painter = wrapper.find('[data-testid="tb-format-painter"]')
    expect(painter.attributes('disabled')).toBeDefined()
    expect(painter.attributes('title')).toContain('格式刷（Task 7 提供）')
  })

  it('复制后粘贴可用；粘贴产生一条记录', async () => {
    const { wrapper, store, selection } = mountToolbar()
    await select(wrapper, selection, ['node-1'])
    expect(wrapper.find('[data-testid="tb-copy"]').attributes('disabled')).toBeUndefined()

    await wrapper.find('[data-testid="tb-copy"]').trigger('click')
    expect(store.clipboard).not.toBeNull()
    expect(wrapper.find('[data-testid="tb-paste"]').attributes('disabled')).toBeUndefined()

    await wrapper.find('[data-testid="tb-paste"]').trigger('click')
    expect(store.document.pages[0].nodes).toHaveLength(4)
    expect(store.undoLabel).toBe('粘贴图元')
  })
})

describe('CompactToolbar 字体组聚合态', () => {
  it('无选择时 B/I/U/S 禁用（none）', () => {
    const { wrapper } = mountToolbar()
    for (const key of ['bold', 'italic', 'underline', 'strikethrough']) {
      expect(wrapper.find(`[data-testid="tb-${key}"]`).attributes('disabled')).toBeDefined()
    }
  })

  it('单节点 bold=false → 未按态；点击执行一条「文本样式」记录', async () => {
    const { wrapper, store, selection } = mountToolbar()
    await select(wrapper, selection, ['node-1'])
    const bold = wrapper.find('[data-testid="tb-bold"]')
    expect(bold.attributes('aria-pressed')).toBe('false')

    await bold.trigger('click')
    expect(store.document.pages[0].nodes[0].text?.style.bold).toBe(true)
    expect(store.undoLabel).toBe('文本样式')
    // 一条记录：undo 后栈空
    store.undo()
    expect(store.canUndo).toBe(false)
  })

  it('多选 bold 一真一假 → mixed 不定态；点击统一为 true', async () => {
    const base = createTestDocument()
    const document: DiagramDocument = {
      ...base,
      pages: [
        {
          ...base.pages[0],
          nodes: base.pages[0].nodes.map((node) =>
            node.id === 'node-1'
              ? { ...node, text: { ...node.text!, style: { ...node.text!.style, bold: true } } }
              : node,
          ),
        },
      ],
    }
    const { wrapper, store, selection } = mountToolbar(document)
    await select(wrapper, selection, ['node-1', 'node-2'])
    const bold = wrapper.find('[data-testid="tb-bold"]')
    expect(bold.attributes('aria-pressed')).toBe('mixed')

    await bold.trigger('click')
    expect(store.document.pages[0].nodes[0].text?.style.bold).toBe(true)
    expect(store.document.pages[0].nodes[1].text?.style.bold).toBe(true)
    expect(store.undoLabel).toBe('文本样式')
  })

  it('含边选择时边标签同批写入', async () => {
    const base = createTestDocument()
    const document: DiagramDocument = {
      ...base,
      pages: [
        {
          ...base.pages[0],
          edges: base.pages[0].edges.map((edge) =>
            edge.id === 'edge-1'
              ? { ...edge, labels: [{ text: createDefaultTextContent('是'), position: 0.5 }] }
              : edge,
          ),
        },
      ],
    }
    const { wrapper, store, selection } = mountToolbar(document)
    await select(wrapper, selection, ['node-1', 'edge-1'])
    await wrapper.find('[data-testid="tb-bold"]').trigger('click')
    expect(store.document.pages[0].nodes[0].text?.style.bold).toBe(true)
    expect(store.document.pages[0].edges[0].labels[0].text.style.bold).toBe(true)
    expect(store.undoLabel).toBe('文本样式')
  })

  it('字号输入写入一条记录；字体下拉写入一条记录', async () => {
    const { wrapper, store, selection } = mountToolbar()
    await select(wrapper, selection, ['node-1'])
    const sizeInput = wrapper.find('[data-testid="tb-font-size"]')
    await sizeInput.setValue('24')
    await sizeInput.trigger('change')
    expect(store.document.pages[0].nodes[0].text?.style.fontSize).toBe(24)
    expect(store.undoLabel).toBe('文本样式')

    await wrapper.find('[data-testid="tb-font-family"]').setValue('宋体')
    expect(store.document.pages[0].nodes[0].text?.style.fontFamily).toBe('宋体')
    expect(store.undoLabel).toBe('文本样式')
  })

  it('文字颜色拖动（多次 input）不产生命令；change 一次提交一条记录', async () => {
    const { wrapper, store, selection } = mountToolbar()
    await select(wrapper, selection, ['node-1'])
    const input = wrapper.find('[data-testid="tb-text-color"]')
    // 拖动序列：多次 input 事件均不写入
    for (const color of ['#ff0000', '#00ff00', '#0000ff']) {
      ;(input.element as HTMLInputElement).value = color
      await input.trigger('input')
    }
    expect(store.document.pages[0].nodes[0].text?.style.color).toBe('#000000')
    expect(store.canUndo).toBe(false)
    // 取色器确认：一次 change 提交一条记录
    ;(input.element as HTMLInputElement).value = '#0000ff'
    await input.trigger('change')
    expect(store.document.pages[0].nodes[0].text?.style.color).toBe('#0000ff')
    expect(store.undoLabel).toBe('文本样式')
    store.undo()
    expect(store.canUndo).toBe(false)
  })
})

describe('CompactToolbar 段落对齐组', () => {
  it('默认居中/垂直居中按态；点击左对齐写入一条记录', async () => {
    const { wrapper, store, selection } = mountToolbar()
    await select(wrapper, selection, ['node-1'])
    expect(wrapper.find('[data-testid="tb-align-center"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="tb-valign-middle"]').attributes('aria-pressed')).toBe('true')

    await wrapper.find('[data-testid="tb-align-left"]').trigger('click')
    expect(store.document.pages[0].nodes[0].text?.block.horizontalAlign).toBe('left')
    expect(store.undoLabel).toBe('文本样式')
  })

  it('无选择时对齐按钮禁用', () => {
    const { wrapper } = mountToolbar()
    expect(wrapper.find('[data-testid="tb-align-left"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="tb-valign-top"]').attributes('disabled')).toBeDefined()
  })
})
