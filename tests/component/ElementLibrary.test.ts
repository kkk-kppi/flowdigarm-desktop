// tests/component/ElementLibrary.test.ts
// 左侧图元库：常用区（Top 20，新用户按内置顺序补足）+ 分类手风琴 12 格（基本 6 + 流程图 6）、
// 搜索过滤、双击创建、更多形状。
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementLibrary from '@/ui/shapes/ElementLibrary.vue'
import { useDocumentStore } from '@/stores/document-store'
import { shapeDragStartKey } from '@/ui/shapes/shape-drag-key'
import '@/application/shapes/common-shapes'

function 挂载() {
  setActivePinia(createPinia())
  return mount(ElementLibrary)
}

describe('ElementLibrary', () => {
  it('渲染标题「图元」、搜索框与 12 个图元格（基本形状 6 + 流程图 6）', () => {
    const wrapper = 挂载()
    expect(wrapper.attributes('data-testid')).toBe('element-library')
    expect(wrapper.text()).toContain('图元')
    expect(wrapper.find('input[placeholder="搜索图元..."]').exists()).toBe(true)
    expect(wrapper.find('[data-icon="search"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="more-shapes"] [data-icon="add"]').exists()).toBe(true)

    const cells = wrapper.findAll('[data-testid="shape-cell"]')
    expect(cells).toHaveLength(12)
    // 每个格子：role=button、tabindex、中文 aria-label
    for (const cell of cells) {
      expect(cell.attributes('role')).toBe('button')
      expect(cell.attributes('tabindex')).toBe('0')
      expect(cell.attributes('aria-label')).toBeTruthy()
    }
    expect(wrapper.find('[data-testid="shape-cell"][aria-label="矩形"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="shape-cell"][aria-label="判定"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="shape-cell"] .shape-thumb')).toHaveLength(12)
    // 文本框/图片不进入图元库两个分类
    expect(wrapper.find('[data-testid="shape-cell"][aria-label="文本框"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shape-cell"][aria-label="图片"]').exists()).toBe(false)
  })

  it('两个分类手风琴默认展开，点击分类标题折叠', async () => {
    const wrapper = 挂载()
    expect(wrapper.text()).toContain('基本形状')
    expect(wrapper.text()).toContain('流程图')
    expect(wrapper.findAll('[data-testid="shape-cell"]')).toHaveLength(12)
    expect(wrapper.find('[data-testid="category-basic-header"] [data-icon="chevronDown"]').exists()).toBe(true)

    await wrapper.find('[data-testid="category-basic-header"]').trigger('click')
    expect(wrapper.findAll('[data-testid="shape-cell"]')).toHaveLength(6)
    expect(wrapper.find('[data-testid="shape-cell"][aria-label="流程"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="category-basic-header"] [data-icon="chevronRight"]').exists()).toBe(true)
  })

  it('搜索按 label 过滤（大小写不敏感），无匹配时显示空态', async () => {
    const wrapper = 挂载()
    const input = wrapper.find('input[placeholder="搜索图元..."]')
    await input.setValue('矩')
    const cells = wrapper.findAll('[data-testid="shape-cell"]')
    expect(cells).toHaveLength(2)
    expect(cells[0].attributes('aria-label')).toBe('矩形')
    expect(cells[1].attributes('aria-label')).toBe('圆角矩形')

    await input.setValue('不存在的形状')
    expect(wrapper.findAll('[data-testid="shape-cell"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('无匹配图元')

    await input.setValue('')
    expect(wrapper.findAll('[data-testid="shape-cell"]')).toHaveLength(12)
  })

  it('双击格子 emit create-request(shapeType)', async () => {
    const wrapper = 挂载()
    await wrapper.find('[data-testid="shape-cell"][aria-label="菱形"]').trigger('dblclick')
    expect(wrapper.emitted('create-request')).toEqual([['diamond']])
  })

  it('mousedown 超过 3px 才启动 Dnd，避免吞掉双击创建', async () => {
    setActivePinia(createPinia())
    const startDrag = vi.fn()
    const wrapper = mount(ElementLibrary, {
      global: { provide: { [shapeDragStartKey as symbol]: startDrag } },
    })
    const cell = wrapper.find('[data-testid="shape-cell"][aria-label="矩形"]')

    await cell.trigger('mousedown', { button: 0, clientX: 10, clientY: 10 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 12, clientY: 12 }))
    expect(startDrag).not.toHaveBeenCalled()
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 14, clientY: 10 }))
    expect(startDrag).toHaveBeenCalledOnce()

    await cell.trigger('dblclick')
    expect(wrapper.emitted('create-request')).toEqual([['rect']])
    wrapper.unmount()
  })

  it('回车格子 emit create-request(shapeType)', async () => {
    const wrapper = 挂载()
    await wrapper.find('[data-testid="shape-cell"][aria-label="流程"]').trigger('keydown.enter')
    expect(wrapper.emitted('create-request')).toEqual([['process']])
  })

  it('点击「+ 更多形状...」emit more-shapes', async () => {
    const wrapper = 挂载()
    await wrapper.find('[data-testid="more-shapes"]').trigger('click')
    expect(wrapper.emitted('more-shapes')).toHaveLength(1)
  })

  it('折叠按钮折叠整栏', async () => {
    const wrapper = 挂载()
    expect(wrapper.find('.collapse-toggle [data-icon="chevronLeft"]').exists()).toBe(true)
    await wrapper.find('[data-testid="collapse-toggle"]').trigger('click')
    expect(wrapper.find('input[placeholder="搜索图元..."]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="shape-cell"]')).toHaveLength(0)
    expect(wrapper.find('.collapse-toggle [data-icon="chevronRight"]').exists()).toBe(true)
  })
})

describe('ElementLibrary 常用区', () => {
  it('常用区在顶部分类之前，手风琴默认展开；新用户按内置顺序补足 12 格', async () => {
    const wrapper = 挂载()
    await flushPromises()
    const topHeader = wrapper.find('[data-testid="category-top-header"]')
    expect(topHeader.exists()).toBe(true)
    expect(topHeader.text()).toContain('常用')
    expect(topHeader.attributes('aria-expanded')).toBe('true')
    expect(topHeader.find('[data-icon="chevronDown"]').exists()).toBe(true)
    // 常用区位于基本形状之前
    const headers = wrapper.findAll('.category-header')
    expect(headers[0].text()).toContain('常用')
    expect(headers[1].text()).toContain('基本形状')

    const topCells = wrapper.findAll('[data-testid="top-shape-cell"]')
    expect(topCells).toHaveLength(12)
    // 内置顺序：基本 6 + 流程图 6
    expect(topCells.map((cell) => cell.attributes('aria-label'))).toEqual([
      '矩形',
      '圆角矩形',
      '圆形',
      '椭圆',
      '三角形',
      '菱形',
      '流程',
      '判定',
      '终止',
      '子流程',
      '文档',
      '数据流',
    ])

    await topHeader.trigger('click')
    expect(topHeader.attributes('aria-expanded')).toBe('false')
    expect(topHeader.find('[data-icon="chevronRight"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="top-shape-cell"]')).toHaveLength(0)
  })

  it('使用记录驱动排序（次数降序）；与分类格子同一创建交互', async () => {
    const wrapper = 挂载()
    const store = useDocumentStore()
    await flushPromises()
    await store.recordShapeUsage('decision')
    await store.recordShapeUsage('decision')
    await store.recordShapeUsage('rect')
    await flushPromises()

    const labels = wrapper
      .findAll('[data-testid="top-shape-cell"]')
      .map((cell) => cell.attributes('aria-label'))
    expect(labels[0]).toBe('判定')
    expect(labels[1]).toBe('矩形')
    expect(labels).toHaveLength(12)

    // 双击常用区格子与分类格子一样 emit create-request
    const decision = wrapper.find('[data-testid="top-shape-cell"][aria-label="判定"]')
    await decision.trigger('dblclick')
    expect(wrapper.emitted('create-request')).toEqual([['decision']])
  })

  it('搜索时隐藏常用区（分类过滤保持原行为）', async () => {
    const wrapper = 挂载()
    await flushPromises()
    expect(wrapper.find('[data-testid="category-top-header"]').exists()).toBe(true)
    const input = wrapper.find('input[placeholder="搜索图元..."]')
    await input.setValue('矩')
    expect(wrapper.find('[data-testid="category-top-header"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="shape-cell"]')).toHaveLength(2)
  })
})
