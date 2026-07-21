export interface ApplicationResources {
  listeners: number
  timers: number
  controllers: number
}

export interface ApplicationResourceTracker {
  resources(): ApplicationResources
  diagnostics(): { listeners: Array<{ type: string; stack: string }>; timers: string[] }
  trackController(controller: { dispose(): void }): void
  restore(): ApplicationResources
}

interface ListenerRecord {
  target: EventTarget
  type: string
  listener: EventListenerOrEventListenerObject
  capture: boolean
  wrapped: EventListener
  signal?: AbortSignal
  abortListener?: EventListener
  stack: string
}

export function installApplicationResourceTracker(
  target: Window,
  shouldTrack: (stack: string) => boolean = applicationSourceStack,
): ApplicationResourceTracker {
  const eventPrototype = (target as Window & { EventTarget: typeof EventTarget }).EventTarget.prototype
  const nativeAdd = eventPrototype.addEventListener
  const nativeRemove = eventPrototype.removeEventListener
  const nativeSetTimeout = target.setTimeout.bind(target)
  const nativeClearTimeout = target.clearTimeout.bind(target)
  const nativeSetInterval = target.setInterval.bind(target)
  const nativeClearInterval = target.clearInterval.bind(target)
  const listeners = new Set<ListenerRecord>()
  const timers = new Map<number, string>()
  const controllers = new Set<object>()

  const removeRecord = (record: ListenerRecord) => {
    listeners.delete(record)
    if (record.signal && record.abortListener) {
      nativeRemove.call(record.signal, 'abort', record.abortListener)
    }
  }

  eventPrototype.addEventListener = function trackedAdd(
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (!listener) {
      nativeAdd.call(this, type, listener, options)
      return
    }
    const stack = new Error().stack ?? ''
    if (!shouldTrack(stack)) {
      nativeAdd.call(this, type, listener, options)
      return
    }
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture)
    const duplicate = [...listeners].find((record) =>
      record.target === this && record.type === type && record.listener === listener && record.capture === capture)
    if (duplicate || typeof options === 'object' && options.signal?.aborted) return

    const record = { target: this, type, listener, capture, stack } as ListenerRecord
    record.wrapped = function wrapped(this: EventTarget, event: Event) {
      if (typeof options === 'object' && options.once) removeRecord(record)
      if (typeof listener === 'function') listener.call(this, event)
      else listener.handleEvent(event)
    }
    if (typeof options === 'object' && options.signal) {
      record.signal = options.signal
      record.abortListener = () => removeRecord(record)
      nativeAdd.call(record.signal, 'abort', record.abortListener, { once: true })
    }
    listeners.add(record)
    nativeAdd.call(this, type, record.wrapped, options)
  } as typeof EventTarget.prototype.addEventListener

  eventPrototype.removeEventListener = function trackedRemove(
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (!listener) {
      nativeRemove.call(this, type, listener, options)
      return
    }
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture)
    const record = [...listeners].find((candidate) =>
      candidate.target === this && candidate.type === type && candidate.listener === listener && candidate.capture === capture)
    if (!record) {
      nativeRemove.call(this, type, listener, options)
      return
    }
    nativeRemove.call(this, type, record.wrapped, options)
    removeRecord(record)
  } as typeof EventTarget.prototype.removeEventListener

  target.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const stack = new Error().stack ?? ''
    if (!shouldTrack(stack) || shouldTrack === applicationSourceStack && !directApplicationSourceStack(stack)) {
      return nativeSetTimeout(handler, timeout, ...args)
    }
    let handle = 0
    const trackedHandler = typeof handler === 'function'
      ? (...callbackArgs: unknown[]) => {
          timers.delete(handle)
          handler(...callbackArgs)
        }
      : handler
    handle = nativeSetTimeout(trackedHandler, timeout, ...args)
    timers.set(handle, stack)
    return handle
  }) as typeof window.setTimeout
  target.clearTimeout = ((handle?: number) => {
    if (handle !== undefined) timers.delete(handle)
    nativeClearTimeout(handle)
  }) as typeof window.clearTimeout
  target.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const stack = new Error().stack ?? ''
    if (!shouldTrack(stack) || shouldTrack === applicationSourceStack && !directApplicationSourceStack(stack)) {
      return nativeSetInterval(handler, timeout, ...args)
    }
    const handle = nativeSetInterval(handler, timeout, ...args)
    timers.set(handle, stack)
    return handle
  }) as typeof window.setInterval
  target.clearInterval = ((handle?: number) => {
    if (handle !== undefined) timers.delete(handle)
    nativeClearInterval(handle)
  }) as typeof window.clearInterval

  const resources = (): ApplicationResources => ({
    listeners: listeners.size,
    timers: timers.size,
    controllers: controllers.size,
  })

  return {
    resources,
    diagnostics: () => ({
      listeners: [...listeners].map(({ type, stack }) => ({ type, stack })),
      timers: [...timers.values()],
    }),
    trackController(controller) {
      if (controllers.has(controller)) return
      controllers.add(controller)
      const dispose = controller.dispose.bind(controller)
      let disposed = false
      controller.dispose = () => {
        if (!disposed) {
          disposed = true
          controllers.delete(controller)
        }
        dispose()
      }
    },
    restore() {
      eventPrototype.addEventListener = nativeAdd
      eventPrototype.removeEventListener = nativeRemove
      target.setTimeout = nativeSetTimeout as typeof window.setTimeout
      target.clearTimeout = nativeClearTimeout as typeof window.clearTimeout
      target.setInterval = nativeSetInterval as typeof window.setInterval
      target.clearInterval = nativeClearInterval as typeof window.clearInterval
      return resources()
    },
  }
}

function applicationSourceStack(stack: string): boolean {
  return stack.split('\n').some((line) =>
    /[\\/]src[\\/]/.test(line) && !/[\\/]src[\\/]e2e[\\/]resource-tracker/.test(line))
}

function directApplicationSourceStack(stack: string): boolean {
  const caller = stack.split('\n').find((line) =>
    line.includes(' at ') && !/[\\/]src[\\/]e2e[\\/]resource-tracker/.test(line))
  return caller ? /[\\/]src[\\/]/.test(caller) : false
}
