import {
  registerCloseRequestListener,
  TauriWindowController,
  type NativeWindowPort,
} from '@/platform/tauri-window-controller'
import { readFileSync } from 'node:fs'

function nativeWindow() {
  let closeHandler: ((event: { preventDefault(): void }) => void | Promise<void>) | undefined
  let resizeHandler: (() => void) | undefined
  const native: NativeWindowPort & {
    calls: string[]
    maximized: boolean
    emitClose(event: { preventDefault(): void }): Promise<void>
    emitResize(): Promise<void>
  } = {
    calls: [],
    maximized: false,
    async minimize() { this.calls.push('minimize') },
    async toggleMaximize() {
      this.calls.push('toggleMaximize')
      this.maximized = !this.maximized
      await this.emitResize()
    },
    async isMaximized() { return this.maximized },
    async onResized(handler) {
      resizeHandler = handler
      return () => { resizeHandler = undefined }
    },
    async destroy() { this.calls.push('destroy') },
    async onCloseRequested(handler) {
      closeHandler = handler
      return () => { closeHandler = undefined }
    },
    async emitClose(event) { await closeHandler?.(event) },
    async emitResize() { await resizeHandler?.() },
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
      'core:window:allow-is-maximized',
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

  it('reports confirmed maximize state, ignores stale queries, and stops after disposal', async () => {
    const native = nativeWindow()
    const values: boolean[] = []
    const controller = new TauriWindowController(native, async () => true)
    const stop = await controller.watchMaximized((value) => values.push(value))
    await vi.waitFor(() => expect(values).toEqual([false]))

    native.maximized = true
    await native.emitResize()
    await vi.waitFor(() => expect(values).toEqual([false, true]))

    stop()
    native.maximized = false
    await native.emitResize()
    expect(values).toEqual([false, true])
  })

  it('ignores an older maximize query that resolves after a newer resize query', async () => {
    const native = nativeWindow()
    const pending: Array<(value: boolean) => void> = []
    native.isMaximized = vi.fn(() => new Promise<boolean>((resolve) => pending.push(resolve)))
    const values: boolean[] = []
    const controller = new TauriWindowController(native, async () => true)
    const stop = await controller.watchMaximized((value) => values.push(value))
    await vi.waitFor(() => expect(pending).toHaveLength(1))

    await native.emitResize()
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1](true)
    await vi.waitFor(() => expect(values).toEqual([true]))
    pending[0](false)
    await Promise.resolve()
    expect(values).toEqual([true])
    stop()
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
