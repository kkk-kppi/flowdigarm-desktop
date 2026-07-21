import { describe, expect, it, vi } from 'vitest'
import { installApplicationResourceTracker } from '@/e2e/resource-tracker'

describe('application E2E resource tracker', () => {
  it('tracks real timer handles, listener callback pairs, and controller disposal', () => {
    const tracker = installApplicationResourceTracker(window, () => true)
    const listener = vi.fn()
    const dispose = vi.fn()
    const controller = { dispose }
    tracker.trackController(controller)

    document.body.addEventListener('flow-resource-test', listener)
    const timeout = window.setTimeout(() => {}, 60_000)
    const interval = window.setInterval(() => {}, 60_000)
    expect(tracker.resources()).toEqual({ listeners: 1, timers: 2, controllers: 1 })

    document.body.removeEventListener('flow-resource-test', listener)
    window.clearTimeout(timeout)
    window.clearInterval(interval)
    controller.dispose()
    expect(dispose).toHaveBeenCalledOnce()
    expect(tracker.resources()).toEqual({ listeners: 0, timers: 0, controllers: 0 })
    tracker.restore()
  })

  it('removes once listeners and completed timeouts from the real resource set', async () => {
    const tracker = installApplicationResourceTracker(window, () => true)
    const listener = vi.fn()
    document.body.addEventListener('flow-resource-once', listener, { once: true })
    document.body.dispatchEvent(new window.Event('flow-resource-once'))
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    expect(listener).toHaveBeenCalledOnce()
    expect(tracker.resources()).toEqual({ listeners: 0, timers: 0, controllers: 0 })
    tracker.restore()
  })
})
