import { mount } from '@vue/test-utils'
import FindReplaceTab from '@/ui/search/FindReplaceTab.vue'

function setup() {
  const calls: string[] = []
  const matches = Array.from({ length: 22 }, (_, index) => ({
    pageId: 'page-1', cellId: `n${index}`, field: 'nodeText' as const,
    start: 0, end: 2, value: `目标 ${index}`,
  }))
  const controller = {
    search: (request: { query: string; caseSensitive: boolean; wholeWord: boolean; scope: string }) => {
      calls.push(`search:${request.query}:${request.caseSensitive}:${request.wholeWord}:${request.scope}`)
      return request.query ? matches : []
    },
    next: () => { calls.push('next'); return matches[0] },
    replaceCurrent: (value: string) => { calls.push(`replace:${value}`); return true },
    replaceAll: (value: string) => { calls.push(`preview:${value}`); return { count: matches.length, matches } },
    confirmReplaceAll: () => { calls.push('confirm'); return matches.length },
  }
  return { controller, calls }
}

describe('FindReplaceTab', () => {
  it('searches with options, navigates, and reports count', async () => {
    const { controller, calls } = setup()
    const wrapper = mount(FindReplaceTab, { props: { controller } })
    await wrapper.find('[data-testid="find-query"]').setValue('目标')
    await wrapper.find('[data-testid="find-case"]').trigger('click')
    await wrapper.find('[data-testid="find-word"]').trigger('click')
    await wrapper.find('[data-testid="find-scope"]').setValue('allPages')
    await wrapper.find('[data-testid="find-next"]').trigger('click')
    expect(wrapper.text()).toContain('找到 22 个匹配')
    expect(calls).toContain('search:目标:true:true:allPages')
    expect(calls).toContain('next')
  })

  it('previews only twenty matches and confirms replace-all separately', async () => {
    const { controller, calls } = setup()
    const wrapper = mount(FindReplaceTab, { props: { controller } })
    await wrapper.find('[data-testid="find-query"]').setValue('目标')
    await wrapper.find('[data-testid="find-replacement"]').setValue('结果')
    await wrapper.find('[data-testid="replace-all"]').trigger('click')
    expect(wrapper.findAll('[data-testid="replace-preview-item"]')).toHaveLength(20)
    expect(calls).not.toContain('confirm')
    await wrapper.find('[data-testid="confirm-replace-all"]').trigger('click')
    expect(calls).toContain('confirm')
  })

  it('returns to properties with link or Escape and opens find help', async () => {
    const { controller } = setup()
    const wrapper = mount(FindReplaceTab, { props: { controller }, attachTo: document.body })
    await wrapper.find('[data-testid="find-back"]').trigger('click')
    expect(wrapper.emitted('back')).toBeTruthy()
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('back')).toHaveLength(2)
    expect(wrapper.find('[data-testid="find-help"] [data-icon="help"]').exists()).toBe(true)
    await wrapper.find('[data-testid="find-help"]').trigger('click')
    expect(wrapper.emitted('help')?.[0]).toEqual(['find-replace'])
    wrapper.unmount()
  })
})
