// tests/component/PropertyTab.test.ts
// 属性面板：单节点显示与编辑（几何按页单位、样式/文本经命令）；
// 多选聚合 mixed 显示「多个值」、写入统一为一条命令；边属性编辑；无选择提示。
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PropertyTab from '@/ui/inspector/PropertyTab.vue'
import { ApplyStyleCommand } from '@/application/commands/apply-style'
import { MoveCellsCommand } from '@/application/commands/move-cells'
import { SetBusinessDataCommand } from '@/application/commands/set-business-data'
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
  it('格式化显示业务数据，应用后可撤销且只产生一条记录', async () => {
    const document = createTestDocument()
    document.pages[0].nodes[0].data = { 负责人: '张三', 审批: { 通过: false } }
    const { wrapper, store, selection } = mountTab(document)
    await select(wrapper, selection, ['node-1'])
    const textarea = wrapper.find('[data-testid="business-data-json"]')

    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      JSON.stringify({ 负责人: '张三', 审批: { 通过: false } }, null, 2),
    )
    await textarea.setValue('{"负责人":"李四","审批":{"通过":true}}')
    await wrapper.find('[data-testid="business-data-apply"]').trigger('click')

    expect(store.document.pages[0].nodes[0].data).toEqual({
      负责人: '李四',
      审批: { 通过: true },
    })
    expect(store.undoLabel).toBe('业务数据')
    store.undo()
    expect(store.document.pages[0].nodes[0].data).toEqual({
      负责人: '张三',
      审批: { 通过: false },
    })
    expect(store.canUndo).toBe(false)
  })

  it('无效业务数据显示行内错误且不执行命令', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    await wrapper.find('[data-testid="business-data-json"]').setValue('[]')
    await wrapper.find('[data-testid="business-data-apply"]').trigger('click')

    expect(wrapper.find('[data-testid="business-data-error"]').text()).toBe(
      '业务数据必须是 JSON 对象。',
    )
    expect(store.document.pages[0].nodes[0].data).toBeUndefined()
    expect(store.canUndo).toBe(false)
  })

  it('业务数据没有变化时不执行命令', async () => {
    const document = createTestDocument()
    document.pages[0].nodes[0].data = { 编号: 7 }
    const { wrapper, store, selection } = mountTab(document)
    await select(wrapper, selection, ['node-1'])

    await wrapper.find('[data-testid="business-data-json"]').setValue('{"编号":7}')
    await wrapper.find('[data-testid="business-data-apply"]').trigger('click')

    expect(store.canUndo).toBe(false)
  })

  it('重置业务数据草稿并清除错误', async () => {
    const document = createTestDocument()
    document.pages[0].nodes[0].data = { 状态: '草稿' }
    const { wrapper, store, selection } = mountTab(document)
    await select(wrapper, selection, ['node-1'])
    const textarea = wrapper.find('[data-testid="business-data-json"]')
    await textarea.setValue('{')
    await wrapper.find('[data-testid="business-data-apply"]').trigger('click')
    expect(wrapper.find('[data-testid="business-data-error"]').exists()).toBe(true)

    await wrapper.find('[data-testid="business-data-reset"]').trigger('click')

    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      JSON.stringify({ 状态: '草稿' }, null, 2),
    )
    expect(wrapper.find('[data-testid="business-data-error"]').exists()).toBe(false)
    expect(store.canUndo).toBe(false)
  })

  it('仅在持久业务数据或所选节点变化时重置业务数据草稿', async () => {
    const document = createTestDocument()
    document.pages[0].nodes[0].data = { 状态: '已保存' }
    document.pages[0].nodes[1].data = { 状态: '另一节点' }
    const { wrapper, store, selection } = mountTab(document)
    await select(wrapper, selection, ['node-1'])
    const textarea = wrapper.find('[data-testid="business-data-json"]')
    const unsavedDraft = '{"状态":"未保存"}'
    await textarea.setValue(unsavedDraft)

    store.executeCommand(
      new ApplyStyleCommand([
        {
          kind: 'node',
          pageId: 'page-1',
          cellId: 'node-1',
          before: { fill: '#FFFFFF' },
          after: { fill: '#ff0000' },
        },
      ]),
    )
    await wrapper.vm.$nextTick()
    expect((textarea.element as HTMLTextAreaElement).value).toBe(unsavedDraft)

    store.executeCommand(
      new MoveCellsCommand([
        {
          pageId: 'page-1',
          nodeId: 'node-1',
          before: { x: 10, y: 20 },
          after: { x: 30, y: 40 },
        },
      ]),
    )
    await wrapper.vm.$nextTick()
    expect((textarea.element as HTMLTextAreaElement).value).toBe(unsavedDraft)

    store.executeCommand(
      new SetBusinessDataCommand({
        pageId: 'page-1',
        nodeId: 'node-1',
        before: { 状态: '已保存' },
        after: { 状态: '外部更新' },
      }),
    )
    await wrapper.vm.$nextTick()
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      JSON.stringify({ 状态: '外部更新' }, null, 2),
    )

    await textarea.setValue('{"状态":"第二份未保存草稿"}')
    await select(wrapper, selection, ['node-2'])
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      JSON.stringify({ 状态: '另一节点' }, null, 2),
    )
  })

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
    const input = wrapper.find('[data-testid="style-fill"]')
    // 一次取色手势 = 一次 change（VTU setValue 会同时派发 input+change，这里显式单次 change）
    ;(input.element as HTMLInputElement).value = '#FF0000'
    await input.trigger('change')
    // 原生 color 控件值规范化为小写十六进制
    expect(store.document.pages[0].nodes[0].style.fill).toBe('#ff0000')
    expect(store.undoLabel).toBe('应用样式')
    store.undo()
    expect(store.document.pages[0].nodes[0].style.fill).toBe('#FFFFFF')
    expect(store.canUndo).toBe(false)
  })

  it('颜色拖动（多次 input）不产生命令；change 一次提交一条记录', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    const input = wrapper.find('[data-testid="style-fill"]')
    // 拖动序列：多次 input 事件均不写入
    for (const color of ['#ff0000', '#00ff00', '#0000ff']) {
      ;(input.element as HTMLInputElement).value = color
      await input.trigger('input')
    }
    expect(store.document.pages[0].nodes[0].style.fill).toBe('#FFFFFF')
    expect(store.canUndo).toBe(false)
    // 取色器确认：一次 change 提交一条记录
    ;(input.element as HTMLInputElement).value = '#0000ff'
    await input.trigger('change')
    expect(store.document.pages[0].nodes[0].style.fill).toBe('#0000ff')
    expect(store.undoLabel).toBe('应用样式')
    store.undo()
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

  it('为文本格式与对齐控件显示语义图标和中文无障碍名称', async () => {
    const { wrapper, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])

    const iconButtons = [
      ['btn-bold', 'bold', '加粗'],
      ['btn-italic', 'italic', '斜体'],
      ['btn-underline', 'underline', '下划线'],
      ['btn-strikethrough', 'strikethrough', '删除线'],
      ['align-left', 'alignLeft', '左对齐'],
      ['align-center', 'alignCenter', '居中对齐'],
      ['align-right', 'alignRight', '右对齐'],
      ['valign-top', 'alignTop', '顶端对齐'],
      ['valign-middle', 'alignMiddle', '垂直居中'],
      ['valign-bottom', 'alignBottom', '底端对齐'],
    ] as const

    for (const [testId, icon, ariaLabel] of iconButtons) {
      const button = wrapper.get(`[data-testid="${testId}"]`)
      expect(button.find(`[data-icon="${icon}"]`).exists()).toBe(true)
      expect(button.attributes('aria-label')).toBe(ariaLabel)
    }

    const controlIcons = [
      ['font-family', 'font'],
      ['font-size', 'fontSize'],
      ['text-color', 'textColor'],
      ['text-background', 'fillColor'],
    ] as const
    for (const [testId, icon] of controlIcons) {
      const control = wrapper.get(`[data-testid="${testId}"]`).element
      expect(control.parentElement?.querySelector(`[data-icon="${icon}"]`)).not.toBeNull()
    }
  })

  it('为每个展开与折叠的区段标题显示对应箭头', async () => {
    const { wrapper, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])

    for (const header of wrapper.findAll('.section-header')) {
      expect(header.find('[data-icon="chevronDown"]').exists()).toBe(true)
      await header.trigger('click')
      expect(header.find('[data-icon="chevronRight"]').exists()).toBe(true)
    }

    await select(wrapper, selection, ['edge-1'])
    const edgeHeader = wrapper.get('[data-testid="section-edge"] .section-header')
    expect(edgeHeader.find('[data-icon="chevronDown"]').exists()).toBe(true)
    await edgeHeader.trigger('click')
    expect(edgeHeader.find('[data-icon="chevronRight"]').exists()).toBe(true)
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

    const fillInput = wrapper.find('[data-testid="style-fill"]')
    ;(fillInput.element as HTMLInputElement).value = '#0000FF'
    await fillInput.trigger('change')
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

  it('多选时禁用业务数据编辑并说明原因', async () => {
    const { wrapper, selection } = mountTab()
    await select(wrapper, selection, ['node-1', 'node-2'])

    expect(wrapper.find('[data-testid="business-data-json"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="business-data-apply"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="business-data-disabled"]').text()).toBe(
      '仅支持单个节点编辑业务数据。',
    )
  })
})

describe('PropertyTab 边选中', () => {
  it('边选中时禁用业务数据编辑并说明原因', async () => {
    const { wrapper, selection } = mountTab()
    await select(wrapper, selection, ['edge-1'])

    expect(wrapper.find('[data-testid="business-data-json"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="business-data-reset"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="business-data-disabled"]').text()).toBe(
      '仅支持单个节点编辑业务数据。',
    )
  })

  it('显示边属性区；线条颜色写入一条「应用样式」记录', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['edge-1'])
    expect(wrapper.find('[data-testid="section-edge"]').exists()).toBe(true)
    const strokeInput = wrapper.find('[data-testid="edge-stroke"]')
    ;(strokeInput.element as HTMLInputElement).value = '#FF0000'
    await strokeInput.trigger('change')
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

describe('PropertyTab 链接', () => {
  it('单节点显示当前链接；失焦提交一条「设置链接」记录', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    const input = wrapper.find('[data-testid="node-link"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('')

    await input.setValue('https://example.com')
    await input.trigger('blur')
    expect(store.document.pages[0].nodes.find((n) => n.id === 'node-1')?.link).toBe(
      'https://example.com',
    )
    expect(store.undoLabel).toBe('设置链接')
    store.undo()
    expect(store.document.pages[0].nodes.find((n) => n.id === 'node-1')?.link).toBeUndefined()
  })

  it('非法协议显示中文错误且不执行命令；改回合法后错误消失', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    const input = wrapper.find('[data-testid="node-link"]')
    await input.setValue('javascript:alert(1)')
    await input.trigger('blur')
    expect(wrapper.find('[data-testid="link-error"]').text()).toBe(
      '仅支持 http、https、mailto 链接。',
    )
    expect(store.document.pages[0].nodes.find((n) => n.id === 'node-1')?.link).toBeUndefined()
    expect(store.canUndo).toBe(false)

    await input.setValue('mailto:a@b.c')
    await input.trigger('blur')
    expect(wrapper.find('[data-testid="link-error"]').exists()).toBe(false)
    expect(store.document.pages[0].nodes.find((n) => n.id === 'node-1')?.link).toBe('mailto:a@b.c')
  })

  it('清除链接：置空串失焦后 link 为 undefined', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['node-1'])
    const input = wrapper.find('[data-testid="node-link"]')
    await input.setValue('https://example.com')
    await input.trigger('blur')
    expect(store.document.pages[0].nodes.find((n) => n.id === 'node-1')?.link).toBe(
      'https://example.com',
    )

    await input.setValue('')
    await input.trigger('blur')
    expect(store.document.pages[0].nodes.find((n) => n.id === 'node-1')?.link).toBeUndefined()
  })

  it('单条边显示与设置链接', async () => {
    const { wrapper, store, selection } = mountTab()
    await select(wrapper, selection, ['edge-1'])
    const input = wrapper.find('[data-testid="edge-link"]')
    expect(input.exists()).toBe(true)
    await input.setValue('http://example.com')
    await input.trigger('blur')
    expect(store.document.pages[0].edges.find((e) => e.id === 'edge-1')?.link).toBe(
      'http://example.com',
    )
    expect(store.undoLabel).toBe('设置链接')
  })
})
