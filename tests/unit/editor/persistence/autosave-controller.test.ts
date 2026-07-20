import { AutosaveController } from '@/application/persistence/autosave-controller'
import type { RecoveryRepository, RecoverySnapshotWrite } from '@/application/persistence/persistence-ports'
import { createEmptyDocument } from '@/domain/diagram'

function repository(writes: RecoverySnapshotWrite[], reject = false): RecoveryRepository {
  return {
    latest: async () => null,
    write: async (input) => {
      if (reject) throw new Error('db unavailable')
      writes.push(input)
    },
    remove: async () => {},
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('AutosaveController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('1999ms 不写，2000ms 只写最后一次 schedule 的快照', async () => {
    const writes: RecoverySnapshotWrite[] = []
    const controller = new AutosaveController(repository(writes))
    const first = createEmptyDocument('第一版')
    const last = { ...first, name: '最后一版' }
    controller.schedule(first)
    controller.schedule(last, 'C:/docs/a.flowdiagram')
    await vi.advanceTimersByTimeAsync(1999)
    expect(writes).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ documentId: last.id, name: '最后一版', sourcePath: 'C:/docs/a.flowdiagram' })
    expect(JSON.parse(writes[0].json).name).toBe('最后一版')
  })

  it('flush 立即写待处理快照且不重复写', async () => {
    const writes: RecoverySnapshotWrite[] = []
    const controller = new AutosaveController(repository(writes))
    controller.schedule(createEmptyDocument())
    await controller.flush()
    await vi.runAllTimersAsync()
    expect(writes).toHaveLength(1)
  })

  it('cancel 与 dispose 清除 timer，dispose 后 schedule 不再工作', async () => {
    const writes: RecoverySnapshotWrite[] = []
    const controller = new AutosaveController(repository(writes))
    controller.schedule(createEmptyDocument())
    expect(vi.getTimerCount()).toBe(1)
    controller.cancel()
    expect(vi.getTimerCount()).toBe(0)
    controller.schedule(createEmptyDocument())
    controller.dispose()
    expect(vi.getTimerCount()).toBe(0)
    controller.schedule(createEmptyDocument())
    await vi.runAllTimersAsync()
    expect(writes).toEqual([])
  })

  it('repository reject 由 onError 捕获且不产生未处理 rejection', async () => {
    const errors: string[] = []
    const controller = new AutosaveController(repository([], true), 2000, (message) => errors.push(message))
    controller.schedule(createEmptyDocument())
    await vi.advanceTimersByTimeAsync(2000)
    expect(errors).toEqual(['自动恢复快照保存失败，图文件不受影响。'])
  })

  it('flush 等待进行中的 timer 写入，并继续写入更新的待处理快照', async () => {
    const firstWrite = deferred()
    const writes: string[] = []
    const recovery = repository([], false)
    const write = vi.spyOn(recovery, 'write')
      .mockImplementationOnce(async (input) => {
        writes.push(input.name)
        await firstWrite.promise
      })
      .mockImplementationOnce(async (input) => {
        writes.push(input.name)
      })
    const controller = new AutosaveController(recovery, 2000)

    const first = createEmptyDocument('旧快照')
    controller.schedule(first)
    await vi.advanceTimersByTimeAsync(2000)
    controller.schedule({ ...first, name: '新快照' })

    let flushed = false
    const flushing = controller.flush().then(() => {
      flushed = true
    })
    await Promise.resolve()
    expect(flushed).toBe(false)
    expect(writes).toEqual(['旧快照'])

    firstWrite.resolve()
    await flushing
    expect(writes).toEqual(['旧快照', '新快照'])
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('旧写入未完成时不并发写新快照，最终存储的一定是新快照', async () => {
    const firstWrite = deferred()
    let stored = ''
    let calls = 0
    const controller = new AutosaveController({
      latest: async () => null,
      write: async (input) => {
        calls += 1
        if (calls === 1) await firstWrite.promise
        stored = input.name
      },
      remove: async () => {},
    })
    const first = createEmptyDocument('旧快照')

    controller.schedule(first)
    await vi.advanceTimersByTimeAsync(2000)
    controller.schedule({ ...first, name: '最终快照' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(calls).toBe(1)

    firstWrite.resolve()
    await controller.flush()
    expect(calls).toBe(2)
    expect(stored).toBe('最终快照')
  })

  it('进行中写入提前完成时，新快照仍等待自己的完整 2 秒防抖', async () => {
    const firstWrite = deferred()
    const writes: string[] = []
    const controller = new AutosaveController({
      latest: async () => null,
      write: async (input) => {
        writes.push(input.name)
        if (writes.length === 1) await firstWrite.promise
      },
      remove: async () => {},
    }, 2000)
    const document = createEmptyDocument('旧快照')

    controller.schedule(document)
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(1000)
    controller.schedule({ ...document, name: '最新快照' })
    await vi.advanceTimersByTimeAsync(500)
    firstWrite.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(writes).toEqual(['旧快照'])

    await vi.advanceTimersByTimeAsync(1499)
    expect(writes).toEqual(['旧快照'])
    await vi.advanceTimersByTimeAsync(1)
    expect(writes).toEqual(['旧快照', '最新快照'])
  })

  it('dispose 丢弃未到期快照，并安全收尾进行中的失败写入', async () => {
    let rejectWrite!: (reason: unknown) => void
    const inFlight = new Promise<void>((_resolve, reject) => {
      rejectWrite = reject
    })
    let calls = 0
    const errors: string[] = []
    const controller = new AutosaveController({
      latest: async () => null,
      write: async () => {
        calls += 1
        await inFlight
      },
      remove: async () => {},
    }, 2000, (message) => errors.push(message))
    const document = createEmptyDocument('进行中')

    controller.schedule(document)
    await vi.advanceTimersByTimeAsync(2000)
    controller.schedule({ ...document, name: '应丢弃' })
    controller.dispose()
    expect(vi.getTimerCount()).toBe(0)

    rejectWrite(new Error('db unavailable'))
    await expect(controller.flush()).resolves.toBeUndefined()
    expect(calls).toBe(1)
    expect(errors).toEqual(['自动恢复快照保存失败，图文件不受影响。'])
  })
})
