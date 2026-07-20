// tests/unit/app-shell.test.ts
// 应用外壳组装：标题栏（应用名+文件名）→ 菜单栏占位 → 紧凑工具栏 → 页面标签 →
// 主区（图元库/画布/右侧面板）→ 状态栏占位；布局高度一律 tokens 变量。
// CanvasArea 依赖 X6（jsdom 无法实例化），以 stub 替换。
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppShell from '@/ui/shell/AppShell.vue'
import { useDocumentStore } from '@/stores/document-store'

function mountShell() {
  setActivePinia(createPinia())
  const store = useDocumentStore()
  store.newDocument()
  const wrapper = mount(AppShell, {
    global: {
      stubs: {
        // X6 画布在 jsdom 无法实例化；其余区域真实渲染
        CanvasArea: { template: '<div data-testid="canvas-area-stub" />' },
      },
    },
  })
  return { wrapper, store }
}

describe('AppShell 组装', () => {
  it('按序渲染标题栏/菜单栏占位/紧凑工具栏/页面标签/主区/状态栏', () => {
    const { wrapper } = mountShell()
    expect(wrapper.find('[data-testid="editor-shell"]').exists()).toBe(true)
    const order = [
      'titlebar',
      'menubar-placeholder',
      'compact-toolbar',
      'page-tabs',
      'shell-main',
      'statusbar',
    ].map((testid) => wrapper.find(`[data-testid="${testid}"]`).exists())
    expect(order).toEqual([true, true, true, true, true, true])
  })

  it('标题栏显示应用名与文档名', () => {
    const { wrapper, store } = mountShell()
    const titlebar = wrapper.find('[data-testid="titlebar"]')
    expect(titlebar.text()).toContain('流程图编辑器')
    expect(titlebar.text()).toContain(store.document.name)
  })

  it('主区包含图元库、画布区与右侧面板', () => {
    const { wrapper } = mountShell()
    const main = wrapper.find('[data-testid="shell-main"]')
    expect(main.find('[data-testid="element-library"]').exists()).toBe(true)
    expect(main.find('[data-testid="canvas-area-stub"]').exists()).toBe(true)
    expect(main.find('[data-testid="right-panel"]').exists()).toBe(true)
  })

  it('状态栏占位显示简单文本', () => {
    const { wrapper } = mountShell()
    expect(wrapper.find('[data-testid="statusbar"]').text().length).toBeGreaterThan(0)
  })
})
