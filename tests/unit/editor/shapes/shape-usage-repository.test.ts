// tests/unit/editor/shapes/shape-usage-repository.test.ts
// 常用形状统计：recordUsage 计数、topUsed 降序；computeTopShapes 按次数降序、
// 次数相同按内置顺序、不足 limit 用内置顺序补足（默认 20）；纯本地统计。
import { describe, expect, it } from 'vitest'
import {
  computeTopShapes,
  InMemoryShapeUsageRepository,
} from '@/application/shapes/shape-usage-repository'
import { TauriShapeUsageRepository } from '@/infrastructure/persistence/tauri-shape-usage-repository'

const LIBRARY_TYPES = [
  'rect',
  'rounded-rect',
  'circle',
  'ellipse',
  'triangle',
  'diamond',
  'process',
  'decision',
  'terminator',
  'subprocess',
  'document',
  'data',
]

describe('InMemoryShapeUsageRepository', () => {
  it('recordUsage 累计次数；topUsed 按次数降序返回', async () => {
    const repo = new InMemoryShapeUsageRepository()
    await repo.recordUsage('rect')
    await repo.recordUsage('rect')
    await repo.recordUsage('diamond')
    const rows = await repo.topUsed(20)
    expect(rows).toEqual([
      { shapeType: 'rect', count: 2 },
      { shapeType: 'diamond', count: 1 },
    ])
  })

  it('topUsed 遵守 limit', async () => {
    const repo = new InMemoryShapeUsageRepository()
    await repo.recordUsage('rect')
    await repo.recordUsage('diamond')
    await repo.recordUsage('circle')
    const rows = await repo.topUsed(2)
    expect(rows).toHaveLength(2)
  })

  it('空仓库 topUsed 返回空数组', async () => {
    const repo = new InMemoryShapeUsageRepository()
    expect(await repo.topUsed(20)).toEqual([])
  })
})

describe('computeTopShapes', () => {
  it('新用户（无使用记录）按内置顺序补足 20（库内 12 个全部按内置序）', () => {
    expect(computeTopShapes([], LIBRARY_TYPES)).toEqual(LIBRARY_TYPES)
  })

  it('默认 limit 为 20：超出内置数量时截断', () => {
    const many = Array.from({ length: 30 }, (_, i) => `shape-${i}`)
    expect(computeTopShapes([], many)).toHaveLength(20)
    expect(computeTopShapes([], many)[0]).toBe('shape-0')
  })

  it('按使用次数降序；次数相同按内置顺序', () => {
    const rows = [
      { shapeType: 'diamond', count: 3 },
      { shapeType: 'rect', count: 3 },
      { shapeType: 'circle', count: 5 },
    ]
    // circle(5) 第一；rect/diamond 同 3 次 → 内置序 rect 先于 diamond
    expect(computeTopShapes(rows, LIBRARY_TYPES, 3)).toEqual(['circle', 'rect', 'diamond'])
  })

  it('已用类型置顶后，剩余位置按内置顺序补足且不去重', () => {
    const rows = [{ shapeType: 'diamond', count: 2 }]
    const result = computeTopShapes(rows, LIBRARY_TYPES)
    expect(result[0]).toBe('diamond')
    expect(result).toHaveLength(12)
    // diamond 不在补足部分重复出现
    expect(result.filter((t) => t === 'diamond')).toHaveLength(1)
    expect(result.slice(1)).toEqual(LIBRARY_TYPES.filter((t) => t !== 'diamond'))
  })

  it('显式 limit 截断结果', () => {
    const result = computeTopShapes([], LIBRARY_TYPES, 5)
    expect(result).toEqual(LIBRARY_TYPES.slice(0, 5))
  })
})

describe('TauriShapeUsageRepository', () => {
  it('只通过注入的 invoke adapter 调用 Rust command', async () => {
    const calls: { command: string; args?: Record<string, unknown> }[] = []
    const repository = new TauriShapeUsageRepository(async (command, args) => {
      calls.push({ command, args })
      if (command === 'top_shape_usage') return [{ shapeType: 'rect', useCount: 3, lastUsedAt: 1 }]
    })
    await repository.recordUsage('rect')
    await expect(repository.topUsed(20)).resolves.toEqual([{ shapeType: 'rect', count: 3 }])
    expect(calls).toEqual([
      { command: 'record_shape_usage', args: { shapeType: 'rect' } },
      { command: 'top_shape_usage', args: { limit: 20 } },
    ])
  })

  it('数据库调用失败后降级 InMemory，形状记录仍成功', async () => {
    const repository = new TauriShapeUsageRepository(async () => { throw new Error('db') })
    await expect(repository.recordUsage('diamond')).resolves.toBeUndefined()
    await expect(repository.recordUsage('diamond')).resolves.toBeUndefined()
    await expect(repository.topUsed(20)).resolves.toEqual([{ shapeType: 'diamond', count: 2 }])
  })
})
