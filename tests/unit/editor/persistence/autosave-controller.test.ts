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
})
