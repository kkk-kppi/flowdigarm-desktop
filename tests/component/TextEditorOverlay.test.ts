// tests/component/TextEditorOverlay.test.ts
// 覆盖式文本编辑器：位置尺寸经 ViewportTransform 一次换算；Esc 取消不产生命令；
// 失焦/Ctrl+Enter 提交一条「编辑文本」；IME 组合中失焦不提交，compositionend 后提交。
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TextEditorOverlay from '@/ui/text/TextEditorOverlay.vue'
import { useDocumentStore } from '@/stores/document-store'
import { createDefaultTextContent, type TextContent } from '@/domain/diagram'
import { createTestDocument } from '../helpers/test-document'

const VIEWPORT = { zoom: 1, panX: 100, panY: 50 }
const AREA_PT = { x: 15, y: 30, width: 120, height: 45 }

interface OverlayProps {
  pageId: string
  target: { kind: 'node'; nodeId: string } | { kind: 'edgeLabel'; edgeId: string; labelIndex: number }
  areaPt: typeof AREA_PT
  content: TextContent
  viewport: typeof VIEWPORT
  angle?: number
  rotationCenterPt?: { x: number; y: number }
}

function baseProps(partial: Partial<OverlayProps> = {}): OverlayProps {
  return {
    pageId: 'page-1',
    target: { kind: 'node', nodeId: 'node-1' },
    areaPt: AREA_PT,
    content: createDefaultTextContent('开始'),
    viewport: VIEWPORT,
    ...partial,
  }
}

const mountedWrappers: { unmount: () => void }[] = []

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount()
  }
})

function mountOverlay(props: OverlayProps = baseProps()) {
  setActivePinia(createPinia())
  const store = useDocumentStore()
  store.loadDocument(createTestDocument())
  // attachTo body：聚焦断言需要真实挂载到文档
  const wrapper = mount(TextEditorOverlay, { props, attachTo: document.body })
  mountedWrappers.push(wrapper)
  return { wrapper, store }
}

describe('TextEditorOverlay 位置与镜像', () => {
  it('位置尺寸经视口一次换算为 px（pan + pt × 96/72 × zoom）', () => {
    const { wrapper } = mountOverlay()
    const el = wrapper.find('[data-testid="text-editor-overlay"]').element as HTMLElement
    // x = 100 + 15×96/72 = 120；y = 50 + 30×96/72 = 90
    expect(el.style.left).toBe('120px')
    expect(el.style.top).toBe('90px')
    // width = 120×96/72 = 160；height = 45×96/72 = 60
    expect(el.style.width).toBe('160px')
    expect(el.style.height).toBe('60px')
  })

  it('字体样式镜像 TextContent（字号换算 px、粗斜体、颜色、对齐）', () => {
    const content = createDefaultTextContent('开始')
    const styled: TextContent = {
      ...content,
      style: {
        ...content.style,
        fontFamily: '宋体',
        fontSize: 18,
        bold: true,
        italic: true,
        underline: true,
        color: '#FF0000',
        background: '#FFFF00',
      },
      block: { ...content.block, horizontalAlign: 'left' },
    }
    const { wrapper } = mountOverlay(baseProps({ content: styled }))
    const textarea = wrapper.find('textarea').element as HTMLTextAreaElement
    expect(textarea.style.fontFamily).toContain('宋体')
    // 18pt × 96/72 × 1 = 24px
    expect(textarea.style.fontSize).toBe('24px')
    expect(textarea.style.fontWeight).toBe('700')
    expect(textarea.style.fontStyle).toBe('italic')
    expect(textarea.style.textDecoration).toContain('underline')
    expect(textarea.style.color).toBe('rgb(255, 0, 0)')
    expect(textarea.style.background).toContain('rgb(255, 255, 0)')
    expect(textarea.style.textAlign).toBe('left')
  })

  it('初始值为当前文本并挂载即聚焦', async () => {
    const { wrapper } = mountOverlay()
    await wrapper.vm.$nextTick() // 聚焦在 onMounted 的 nextTick 后发生
    const textarea = wrapper.find('textarea').element as HTMLTextAreaElement
    expect(textarea.value).toBe('开始')
    expect(document.activeElement).toBe(textarea)
  })

  it('未设置文字背景时以面板色遮住 X6 原标签', () => {
    const { wrapper } = mountOverlay()
    const overlay = wrapper.find<HTMLElement>('[data-testid="text-editor-overlay"]')
    expect(overlay.element.style.background).toBe('var(--color-panel)')
  })

  it('编辑内容允许超过固定锚区高度且不被外层裁剪', () => {
    const content = createDefaultTextContent('第一行\n第二行\n第三行\n第四行\n第五行')
    const { wrapper } = mountOverlay(baseProps({
      content,
      areaPt: { ...AREA_PT, height: 20 },
    }))
    const overlay = wrapper.find<HTMLElement>('[data-testid="text-editor-overlay"]').element
    const editorContent = wrapper.find<HTMLElement>('.text-editor-content').element
    expect(overlay.style.overflow).toBe('visible')
    expect(editorContent.style.maxHeight).toBe('none')
    expect(editorContent.style.overflow).toBe('visible')
  })

  it.each([
    ['top', 'flex-start'],
    ['middle', 'center'],
    ['bottom', 'flex-end'],
  ] as const)('将垂直对齐 %s 映射为编辑文本块的 %s', (verticalAlign, alignItems) => {
    const content = createDefaultTextContent('开始')
    content.block.verticalAlign = verticalAlign
    const { wrapper } = mountOverlay(baseProps({ content }))
    const overlay = wrapper.find<HTMLElement>('[data-testid="text-editor-overlay"]')
    expect(overlay.element.style.alignItems).toBe(alignItems)
  })

  it('围绕节点中心旋转编辑区域，与 X6 节点旋转一致', () => {
    const { wrapper } = mountOverlay(baseProps({
      angle: 90,
      rotationCenterPt: { x: 75, y: 60 },
    }))
    const overlay = wrapper.find<HTMLElement>('[data-testid="text-editor-overlay"]').element
    expect(overlay.style.transform).toBe('rotate(90deg)')
    // 节点中心相对 area 左上角：(75-15, 60-30)pt → (80, 40)px。
    expect(overlay.style.transformOrigin).toBe('80px 40px')
  })

  it('竖排文本逐字分行，源换行显示为空行槽位', async () => {
    const content = createDefaultTextContent('开始')
    content.block.direction = 'vertical'
    const { wrapper, store } = mountOverlay(baseProps({ content }))
    const textarea = wrapper.find('textarea').element as HTMLTextAreaElement
    expect(textarea.value).toBe('开\n始')

    await wrapper.find('textarea').setValue('开\n\n始')
    await wrapper.vm.$nextTick()
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('开\n\u200B\n始')
    await wrapper.find('textarea').trigger('blur')
    expect(store.document.pages[0].nodes[0].text?.value).toBe('开\n始')
  })

  it('竖排粘贴多字符后立即恢复逐字分行，清空仍提交空字符串', async () => {
    const content = createDefaultTextContent('开始')
    content.block.direction = 'vertical'
    const { wrapper, store } = mountOverlay(baseProps({ content }))
    const textarea = wrapper.find('textarea')
    await textarea.setValue('流程')
    await wrapper.vm.$nextTick()
    expect((textarea.element as HTMLTextAreaElement).value).toBe('流\n程')

    await textarea.setValue('')
    await textarea.trigger('blur')
    expect(store.document.pages[0].nodes[0].text?.value).toBe('')
  })

  it('竖排值中的真实零宽空格使用转义表示，不会变成源换行', async () => {
    const content = createDefaultTextContent('开\u200B始')
    content.block.direction = 'vertical'
    const { wrapper } = mountOverlay(baseProps({ content }))
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value)
      .toBe('开\n\u200B\u200B\n始')
    await wrapper.find('textarea').trigger('blur')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

describe('TextEditorOverlay 提交与取消', () => {
  it('Esc 取消：关闭且不产生命令、文档不变', async () => {
    const { wrapper, store } = mountOverlay()
    const textarea = wrapper.find('textarea')
    await textarea.setValue('被改动')
    await textarea.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(store.canUndo).toBe(false)
    expect(store.document.pages[0].nodes[0].text?.value).toBe('开始')
  })

  it('失焦提交：执行一条 EditTextCommand（node 目标）', async () => {
    const { wrapper, store } = mountOverlay()
    const textarea = wrapper.find('textarea')
    await textarea.setValue('开始处理')
    await textarea.trigger('blur')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(store.document.pages[0].nodes[0].text?.value).toBe('开始处理')
    expect(store.undoLabel).toBe('编辑文本')
    // 撤销一条即回原文
    store.undo()
    expect(store.document.pages[0].nodes[0].text?.value).toBe('开始')
    expect(store.canUndo).toBe(false)
  })

  it('未变更失焦：关闭但不产生命令', async () => {
    const { wrapper, store } = mountOverlay()
    await wrapper.find('textarea').trigger('blur')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(store.canUndo).toBe(false)
  })

  it('edgeLabel 目标提交：写入边首标签', async () => {
    const { wrapper, store } = mountOverlay(
      baseProps({ target: { kind: 'edgeLabel', edgeId: 'edge-1', labelIndex: 0 }, content: createDefaultTextContent('') }),
    )
    const textarea = wrapper.find('textarea')
    await textarea.setValue('是')
    await textarea.trigger('blur')
    expect(store.document.pages[0].edges[0].labels[0]?.text.value).toBe('是')
    expect(store.undoLabel).toBe('编辑文本')
  })

  it('Ctrl+Enter 提交；Cmd(Meta)+Enter 同样提交', async () => {
    const { wrapper, store } = mountOverlay()
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Ctrl提交')
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(store.document.pages[0].nodes[0].text?.value).toBe('Ctrl提交')
  })

  it('提交失败时保留编辑器与草稿，允许用户修正后重试', async () => {
    const { wrapper, store } = mountOverlay()
    const textarea = wrapper.find('textarea')
    const overlong = '字'.repeat(10_001)
    await textarea.setValue(overlong)
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted('close')).toBeUndefined()
    expect((textarea.element as HTMLTextAreaElement).value).toBe(overlong)
    expect(store.lastNotice).toBe('文本长度超出限制。')
    expect(store.document.pages[0].nodes[0].text?.value).toBe('开始')

    await textarea.setValue('修正后文本')
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(store.document.pages[0].nodes[0].text?.value).toBe('修正后文本')
  })

  it('Enter（无 Ctrl）不提交：保持编辑中', async () => {
    const { wrapper } = mountOverlay()
    const textarea = wrapper.find('textarea')
    await textarea.setValue('第一行')
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})

describe('TextEditorOverlay IME 组合', () => {
  it('composition 中失焦不提交；compositionend 后提交上屏文本', async () => {
    const { wrapper, store } = mountOverlay()
    const textarea = wrapper.find('textarea')
    await textarea.trigger('compositionstart')
    await textarea.setValue('ni')
    await textarea.trigger('blur')
    // 组合中失焦：不提交、不关闭
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(store.canUndo).toBe(false)

    // IME 上屏后 compositionend：提交最终中文
    await textarea.setValue('你')
    await textarea.trigger('compositionend')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(store.document.pages[0].nodes[0].text?.value).toBe('你')
    expect(store.undoLabel).toBe('编辑文本')
  })

  it('composition 中 Ctrl+Enter 不提交（组合未结束）', async () => {
    const { wrapper, store } = mountOverlay()
    const textarea = wrapper.find('textarea')
    await textarea.trigger('compositionstart')
    await textarea.setValue('ni')
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(store.canUndo).toBe(false)
  })

  it('composition 中 Escape 只交给输入法，不取消编辑会话', async () => {
    const { wrapper, store } = mountOverlay()
    const textarea = wrapper.find('textarea')
    await textarea.trigger('compositionstart')
    await textarea.setValue('ni')
    await textarea.trigger('keydown', { key: 'Escape', isComposing: true })
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(store.canUndo).toBe(false)
  })
})

describe('TextEditorOverlay 可访问性', () => {
  it.each([
    [{ kind: 'node', nodeId: 'node-1' }, '编辑节点文本'],
    [{ kind: 'edgeLabel', edgeId: 'edge-1', labelIndex: 0 }, '编辑连线标签'],
  ] as const)('按目标类型提供编辑控件名称', (target, label) => {
    const { wrapper } = mountOverlay(baseProps({ target }))
    expect(wrapper.find('textarea').attributes('aria-label')).toBe(label)
  })
})
