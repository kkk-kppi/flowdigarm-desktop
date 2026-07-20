// tests/component/ElementLibrary.test.ts
// 左侧图元库：分类手风琴 12 格（基本 6 + 流程图 6）、搜索过滤、双击创建、更多形状。
import { mount } from '@vue/test-utils'
import ElementLibrary from '@/ui/shapes/ElementLibrary.vue'
import '@/application/shapes/common-shapes'

function 挂载() {
  return mount(ElementLibrary)
}

describe('ElementLibrary', () => {
  it('渲染标题「图元」、搜索框与 12 个图元格（基本形状 6 + 流程图 6）', () => {
    const wrapper = 挂载()
    expect(wrapper.attributes('data-testid')).toBe('element-library')
    expect(wrapper.text()).toContain('图元')
    expect(wrapper.find('input[placeholder="搜索图元..."]').exists()).toBe(true)

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
    // 文本框/图片不进入图元库两个分类
    expect(wrapper.find('[data-testid="shape-cell"][aria-label="文本框"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shape-cell"][aria-label="图片"]').exists()).toBe(false)
  })

  it('两个分类手风琴默认展开，点击分类标题折叠', async () => {
    const wrapper = 挂载()
    expect(wrapper.text()).toContain('基本形状')
    expect(wrapper.text()).toContain('流程图')
    expect(wrapper.findAll('[data-testid="shape-cell"]')).toHaveLength(12)

    await wrapper.find('[data-testid="category-basic-header"]').trigger('click')
    expect(wrapper.findAll('[data-testid="shape-cell"]')).toHaveLength(6)
    expect(wrapper.find('[data-testid="shape-cell"][aria-label="流程"]').exists()).toBe(true)
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
    await wrapper.find('[data-testid="collapse-toggle"]').trigger('click')
    expect(wrapper.find('input[placeholder="搜索图元..."]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="shape-cell"]')).toHaveLength(0)
  })
})
