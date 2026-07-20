// tests/component/PropertyTab.test.ts
// 属性面板：单节点显示与编辑（几何按页单位、样式/文本经命令）；
// 多选聚合 mixed 显示「多个值」、写入统一为一条命令；边属性编辑；无选择提示。
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PropertyTab from '@/ui/inspector/PropertyTab.vue'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'
import {
  createDefaultNodeStyle,
  createDefaultTextContent,
  type DiagramDocument,
} from '@/domain/diagram'
import { createTestDocument } from '../helpers/test-document'

function mountTab(document: DiagramDocument = createTestDocument()) {
  setActivePinia(createPinia())
  const store = useDocumentStore()
  store.loadDocument(document)
  const selection = useSelectionStore()
  const wrapper = mount(PropertyTab)
  return { wrapper, store, selection }
}

/** 设置选择并等待重渲染。 */
async function select(
  wrapper: VueWrapper,
  selection: ReturnType<typeof useSelectionStore>,
  ids: string[],
): Promise<void> {
  selection.setSelection(ids)
  await wrapper.vm.$nextTick()
}

describe('PropertyTab 无选择', () => {
  it('显示「未选择图元」提示', () => {
    const { wrapper } = mountTab()
    expect(wrapper.text()).toContain('未选择图元')
  })
})

describe('PropertyTab 单节点', () => {
  it('节点信息：类型只读、名称=文本值、ID 小字只读', async () => {
    const { wrapper, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    expect(wrapper.find('[data-testid="node-type"]').text()).toBe('矩形')
    expect(
      (wrapper.find('[data-testid="node-name"]').element as HTMLInputElement).value,
    ).toBe('开始')
    expect(wrapper.find('[data-testid="node-id"]').text()).toBe('node-1')
  })

  it('几何按页单位显示（mm）：X=3.5、宽=28.2', async () => {
    const { wrapper, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    expect((wrapper.find('[data-testid="geo-x"]').element as HTMLInputElement).value).toBe('3.5')
    expect((wrapper.find('[data-testid="geo-width"]').element as HTMLInputElement).value).toBe(
      '28.2',
    )
  })

  it('编辑 X（按 mm 输入）→ 一条「移动图元」记录，pt 写回', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    const input = wrapper.find('[data-testid="geo-x"]')
    await input.setValue('10')
    await input.trigger('change')
    const node = store.document.pages[0].nodes[0]
    expect(node.x).toBeCloseTo(28.3465, 3)
    expect(node.y).toBe(20) // 未编辑字段不变
    expect(store.undoLabel).toBe('移动图元')
    store.undo()
    expect(store.document.pages[0].nodes[0].x).toBe(10)
    expect(store.canUndo).toBe(false)
  })

  it('编辑宽度小于形状最小尺寸时按 minSize 钳制', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    const input = wrapper.find('[data-testid="geo-width"]')
    await input.setValue('5') // 5mm ≈ 14.2pt < 36pt minSize
    await input.trigger('change')
    expect(store.document.pages[0].nodes[0].width).toBe(36)
    expect(store.undoLabel).toBe('缩放图元')
  })

  it('编辑角度 370 → 规范化 10', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    const input = wrapper.find('[data-testid="geo-angle"]')
    await input.setValue('370')
    await input.trigger('change')
    expect(store.document.pages[0].nodes[0].angle).toBe(10)
    expect(store.undoLabel).toBe('旋转图元')
  })

  it('填充色写入一条「应用样式」记录；撤销恢复原值', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    await wrapper.find('[data-testid="style-fill"]').setValue('#FF0000')
    // 原生 color 控件值规范化为小写十六进制
    expect(store.document.pages[0].nodes[0].style.fill).toBe('#ff0000')
    expect(store.undoLabel).toBe('应用样式')
    store.undo()
    expect(store.document.pages[0].nodes[0].style.fill).toBe('#FFFFFF')
    expect(store.canUndo).toBe(false)
  })

  it('名称失焦提交一条「编辑文本」记录', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    const input = wrapper.find('[data-testid="node-name"]')
    await input.setValue('开始节点')
    await input.trigger('blur')
    expect(store.document.pages[0].nodes[0].text?.value).toBe('开始节点')
    expect(store.undoLabel).toBe('编辑文本')
  })

  it('文本区字号下拉写入一条「文本样式」记录', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    await wrapper.find('[data-testid="font-size"]').setValue('20')
    expect(store.document.pages[0].nodes[0].text?.style.fontSize).toBe(20)
    expect(store.undoLabel).toBe('文本样式')
  })

  it('B/I/U/S 按钮切换写入文本样式；当前态高亮', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    const bold = wrapper.find('[data-testid="btn-bold"]')
    expect(bold.attributes('aria-pressed')).toBe('false')
    await bold.trigger('click')
    expect(store.document.pages[0].nodes[0].text?.style.bold).toBe(true)
    expect(store.undoLabel).toBe('文本样式')
  })
})

describe('PropertyTab 多选聚合', () => {
  function twoNodeDocument(fillA: string, fillB: string): DiagramDocument {
    const base = createTestDocument()
    return {
      ...base,
      pages: [
        {
          ...base.pages[0],
          nodes: base.pages[0].nodes.map((node, index) =>
            index < 2
              ? {
                  ...node,
                  style: { ...createDefaultNodeStyle(), fill: index === 0 ? fillA : fillB },
                }
              : node,
          ),
        },
      ],
    }
  }

  it('填充不一致显示混合标记「多个值」；写入后全部统一为一条记录', async () => {
    const { wrapper, store, selection } = mountTab(twoNodeDocument('#FF0000', '#00FF00'))
    await select(wrapper, selection, ['node-1', 'node-2'])
    expect(wrapper.find('[data-testid="style-fill-mixed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="style-fill-mixed"]').text()).toContain('多个值')

    await wrapper.find('[data-testid="style-fill"]').setValue('#0000FF')
    const [a, b] = store.document.pages[0].nodes
    expect(a.style.fill).toBe('#0000ff')
    expect(b.style.fill).toBe('#0000ff')
    expect(store.undoLabel).toBe('应用样式')
    // 一条记录：undo 一次两节点各自恢复原值
    store.undo()
    expect(store.document.pages[0].nodes[0].style.fill).toBe('#FF0000')
    expect(store.document.pages[0].nodes[1].style.fill).toBe('#00FF00')
    expect(store.canUndo).toBe(false)
  })

  it('填充一致时无混合标记，显示共同值', async () => {
    const { wrapper, selection } = mountTab(twoNodeDocument('#FF0000', '#FF0000'))
    await select(wrapper, selection, ['node-1', 'node-2'])
    expect(wrapper.find('[data-testid="style-fill-mixed"]').exists()).toBe(false)
    expect(
      (wrapper.find('[data-testid="style-fill"]').element as HTMLInputElement).value.toLowerCase(),
    ).toBe('#ff0000')
  })

  it('bold 一真一假显示不定态；点击后全部统一为 true 一条「文本样式」记录', async () => {
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
    const { wrapper, store, selection } = mountTab(document)
    await select(wrapper, selection, ['node-1', 'node-2'])
    const bold = wrapper.find('[data-testid="btn-bold"]')
    expect(bold.attributes('aria-pressed')).toBe('mixed')

    await bold.trigger('click')
    expect(store.document.pages[0].nodes[0].text?.style.bold).toBe(true)
    expect(store.document.pages[0].nodes[1].text?.style.bold).toBe(true)
    expect(store.undoLabel).toBe('文本样式')
    store.undo()
    expect(store.document.pages[0].nodes[0].text?.style.bold).toBe(true)
    expect(store.document.pages[0].nodes[1].text?.style.bold).toBe(false)
  })

  it('多选时隐藏节点信息与几何区', async () => {
    const { wrapper, selection } = mountTab()
    await select(wrapper, selection, ['node-1', 'node-2'])
    expect(wrapper.find('[data-testid="node-name"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="geo-x"]').exists()).toBe(false)
  })
})

describe('PropertyTab 边选中', () => {
  it('显示边属性区；线条颜色写入一条「应用样式」记录', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['edge-1'])
    expect(wrapper.find('[data-testid="section-edge"]').exists()).toBe(true)
    await wrapper.find('[data-testid="edge-stroke"]').setValue('#FF0000')
    expect(store.document.pages[0].edges[0].style.stroke).toBe('#ff0000')
    expect(store.undoLabel).toBe('应用样式')
  })

  it('连接类型下拉写入一条「连线类型」记录', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['edge-1'])
    await wrapper.find('[data-testid="edge-connector"]').setValue('curved')
    expect(store.document.pages[0].edges[0].connector).toBe('curved')
    expect(store.undoLabel).toBe('连线类型')
  })

  it('标签文本失焦提交一条「编辑文本」记录（无标签时追加）', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['edge-1'])
    const input = wrapper.find('[data-testid="edge-label-text"]')
    await input.setValue('是')
    await input.trigger('blur')
    expect(store.document.pages[0].edges[0].labels[0]?.text.value).toBe('是')
    expect(store.undoLabel).toBe('编辑文本')
  })
})

describe('PropertyTab 混合选择', () => {
  it('节点+边：显示样式/文本/边属性区，隐藏节点信息与几何；文本写入同批覆盖边标签', async () => {
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
    const { wrapper, store, selection } = mountTab(document)
    await select(wrapper, selection, ['node-1', 'edge-1'])
    expect(wrapper.find('[data-testid="section-style"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="section-text"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="section-edge"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="node-name"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="geo-x"]').exists()).toBe(false)

    // 字号写入：节点文本与边标签同批一条记录
    await wrapper.find('[data-testid="font-size"]').setValue('18')
    expect(store.document.pages[0].nodes[0].text?.style.fontSize).toBe(18)
    expect(store.document.pages[0].edges[0].labels[0].text.style.fontSize).toBe(18)
    expect(store.undoLabel).toBe('文本样式')
  })
})
