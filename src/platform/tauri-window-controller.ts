import { getCurrentWindow } from '@tauri-apps/api/window'
import type { WindowController } from './window-controller'

interface CloseRequestEvent {
  preventDefault(): void
}

export interface NativeWindowPort {
  minimize(): Promise<void>
  toggleMaximize(): Promise<void>
  isMaximized(): Promise<boolean>
  onResized(handler: () => void): Promise<() => void>
  destroy(): Promise<void>
  onCloseRequested(handler: (event: CloseRequestEvent) => void | Promise<void>): Promise<() => void>
}

export class TauriWindowController implements WindowController {
  private closePending = false

  constructor(
    private readonly window: NativeWindowPort,
    private readonly canClose: () => Promise<boolean>,
  ) {}

  minimize(): Promise<void> {
    return this.window.minimize()
  }

  toggleMaximize(): Promise<void> {
    return this.window.toggleMaximize()
  }

  async watchMaximized(handler: (maximized: boolean) => void): Promise<() => void> {
    let disposed = false
    let generation = 0
    let last: boolean | undefined
    const refresh = async () => {
      const current = ++generation
      try {
        const maximized = await this.window.isMaximized()
        if (disposed || current !== generation || maximized === last) return
        last = maximized
        handler(maximized)
      } catch {
        // A resize can trigger another confirmed query; keep the last state.
      }
    }
    const unlisten = await this.window.onResized(() => { void refresh() })
    void refresh()
    return () => {
      if (disposed) return
      disposed = true
      generation += 1
      unlisten()
    }
  }

  async requestClose(): Promise<void> {
    if (this.closePending) return
    this.closePending = true
    try {
      if (await this.canClose()) await this.window.destroy()
    } finally {
      this.closePending = false
    }
  }

  onCloseRequested(): Promise<() => void> {
    return this.window.onCloseRequested(async (event) => {
      event.preventDefault()
      await this.requestClose()
    })
  }
}

export function registerCloseRequestListener(
  controller: Pick<WindowController, 'onCloseRequested'>,
): () => void {
  let disposed = false
  let unlisten: (() => void) | undefined
  void controller.onCloseRequested().then((remove) => {
    if (disposed) remove()
    else unlisten = remove
  }).catch(() => {
    // A missing native listener must not produce an unhandled startup rejection.
  })
  return () => {
    if (disposed) return
    disposed = true
    unlisten?.()
    unlisten = undefined
  }
}

export function createTauriWindowController(canClose: () => Promise<boolean>): WindowController {
  return new TauriWindowController(getCurrentWindow(), canClose)
}
