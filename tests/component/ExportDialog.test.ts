import { flushPromises, mount } from '@vue/test-utils'
import ExportDialog from '@/ui/dialogs/ExportDialog.vue'
import type { ExportOptions, ExportFormat } from '@/application/export/export-ports'

function setup() {
  const controller = {
    chooseDestination: vi.fn(async ({ format }: { format: ExportFormat; fileName: string }) => `C:/exports/chart.${format}`),
    export: vi.fn(async (_options: ExportOptions) => ['C:/exports/chart.svg']),
  }
  const wrapper = mount(ExportDialog, {
    attachTo: document.body,
    props: { controller, fileName: '流程图.flowdiagram', pngDpi: 150 },
  })
  return { wrapper, controller }
}

describe('ExportDialog', () => {
  it('offers all formats/scopes, shows DPI only for PNG, and browses through the controller', async () => {
    const { wrapper, controller } = setup()
    expect(wrapper.find('[role="dialog"]').attributes('aria-labelledby')).toBe('export-title')
    expect(wrapper.find('[data-testid="export-help"]').attributes('title')).toContain('导出帮助')
    expect(wrapper.find('[aria-label="关闭导出"]').attributes('title')).toContain('关闭导出')
    expect(wrapper.findAll('[data-testid^="export-format-"]')).toHaveLength(4)
    expect(wrapper.find('[data-testid="export-scope-currentPage"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="export-scope-allPages"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="export-dpi"]').exists()).toBe(false)

    await wrapper.find('[data-testid="export-format-png"]').setValue(true)
    expect(wrapper.find('[data-testid="export-dpi"]').exists()).toBe(true)
    expect(wrapper.find<HTMLSelectElement>('[data-testid="export-dpi"]').element.value).toBe('150')
    await wrapper.find('[data-testid="export-browse"]').trigger('click')
    await flushPromises()
    expect(controller.chooseDestination).toHaveBeenCalledWith({ format: 'png', fileName: '流程图' })
    expect(wrapper.find<HTMLInputElement>('[data-testid="export-destination"]').element.value).toBe('C:/exports/chart.png')
  })

  it('submits controller options, disables every control while busy, and announces success', async () => {
    let finish!: (paths: string[]) => void
    const { wrapper, controller } = setup()
    vi.mocked(controller.export).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    await wrapper.find('[data-testid="export-browse"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="export-submit"]').trigger('click')

    expect(wrapper.text()).toContain('正在导出…')
    expect(wrapper.findAll('button, input, select').every((control) => control.attributes('disabled') !== undefined)).toBe(true)
    expect(controller.export).toHaveBeenCalledWith({
      format: 'svg', scope: 'currentPage', fileName: '流程图', destination: 'C:/exports/chart.svg', dpi: undefined,
    })
    finish(['C:/exports/chart.svg'])
    await flushPromises()
    expect(wrapper.find('[role="status"]').text()).toContain('已导出到 C:/exports/chart.svg')
  })

  it('shows a failure reason and actionable suggestion without closing', async () => {
    const { wrapper, controller } = setup()
    vi.mocked(controller.export).mockRejectedValueOnce(new Error('导出失败，当前文档未受影响：磁盘已满。'))
    await wrapper.find('[data-testid="export-browse"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="export-submit"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('磁盘已满')
    expect(wrapper.find('[role="alert"]').text()).toContain('请检查保存位置、可用空间或文件权限')
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('traps focus, emits help, closes on Escape, and restores focus after unmount', async () => {
    const origin = document.createElement('button')
    document.body.append(origin)
    origin.focus()
    const { wrapper } = setup()
    await flushPromises()
    const dialog = wrapper.find('[role="dialog"]')
    const controls = wrapper.findAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')
    controls.at(-1)?.element.focus()
    await dialog.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(controls[0].element)
    await wrapper.find('[data-testid="export-help"]').trigger('click')
    expect(wrapper.emitted('help')).toHaveLength(1)
    await dialog.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
    expect(document.activeElement).toBe(origin)
    origin.remove()
  })
})
