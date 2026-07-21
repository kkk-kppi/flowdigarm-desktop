import {
  registerCloseRequestListener,
  TauriWindowController,
  type NativeWindowPort,
} from '@/platform/tauri-window-controller'
import { readFileSync } from 'node:fs'

function nativeWindow() {
  let closeHandler: ((event: { preventDefault(): void }) => void | Promise<void>) | undefined
  const native: NativeWindowPort & {
    calls: string[]
    emitClose(event: { preventDefault(): void }): Promise<void>
  } = {
    calls: [],
    async minimize() { this.calls.push('minimize') },
    async toggleMaximize() { this.calls.push('toggleMaximize') },
    async destroy() { this.calls.push('destroy') },
    async onCloseRequested(handler) {
      closeHandler = handler
      return () => { closeHandler = undefined }
    },
    async emitClose(event) { await closeHandler?.(event) },
  }
  return native
}

describe('TauriWindowController', () => {
  it('configures one frameless desktop window with the required minimum size', () => {
    const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
    expect(config.app.windows[0]).toMatchObject({ decorations: false, minWidth: 960, minHeight: 600 })
    expect(config.app.security.csp).toContain("img-src 'self' data:")
    const capability = JSON.parse(readFileSync('src-tauri/capabilities/default.json', 'utf8'))
    expect(capability.permissions).toEqual(expect.arrayContaining([
      'core:window:allow-minimize',
      'core:window:allow-toggle-maximize',
      'core:window:allow-destroy',
      'core:window:allow-start-dragging',
    ]))
    expect(capability.permissions).not.toContain('opener:allow-open-url')
  })

  it('delegates minimize and maximize controls', async () => {
    const native = nativeWindow()
    const controller = new TauriWindowController(native, async () => true)
    await controller.minimize()
    await controller.toggleMaximize()
    expect(native.calls).toEqual(['minimize', 'toggleMaximize'])
  })

  it('prevents native close and only destroys after the dirty guard approves', async () => {
    const native = nativeWindow()
    const guard = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const preventDefault = vi.fn()
    const controller = new TauriWindowController(native, guard)
    await controller.onCloseRequested()

    await native.emitClose({ preventDefault })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(native.calls).not.toContain('destroy')

    await native.emitClose({ preventDefault })
    expect(native.calls).toContain('destroy')
    expect(guard).toHaveBeenCalledTimes(2)
  })

  it('guards titlebar close and suppresses concurrent close requests', async () => {
    const native = nativeWindow()
    let approve!: (value: boolean) => void
    const guard = vi.fn(() => new Promise<boolean>((resolve) => { approve = resolve }))
    const controller = new TauriWindowController(native, guard)

    const closing = controller.requestClose()
    await controller.requestClose()
    expect(guard).toHaveBeenCalledOnce()
    approve(true)
    await closing
    expect(native.calls).toEqual(['destroy'])
  })

  it('unlistens immediately when registration resolves after app disposal', async () => {
    let resolveRegistration!: (unlisten: () => void) => void
    const unlisten = vi.fn()
    const controller = {
      onCloseRequested: vi.fn(() => new Promise<() => void>((resolve) => { resolveRegistration = resolve })),
    }

    const dispose = registerCloseRequestListener(controller)
    dispose()
    resolveRegistration(unlisten)
    await Promise.resolve()

    expect(unlisten).toHaveBeenCalledOnce()
    dispose()
    expect(unlisten).toHaveBeenCalledOnce()
  })
})
