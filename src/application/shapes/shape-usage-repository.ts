// src/application/shapes/shape-usage-repository.ts
// 常用形状统计：本机使用次数记录与 Top N 查询（纯本地统计，不上传）。
// InMemory 为首期实现；Task 8 换 SQLite 实现（接口不变，经 document-store 注入替换）。
export interface ShapeUsageRepository {
  recordUsage(shapeType: string): Promise<void>
  topUsed(limit: number): Promise<{ shapeType: string; count: number }[]>
}

export class InMemoryShapeUsageRepository implements ShapeUsageRepository {
  private readonly counts = new Map<string, number>()

  async recordUsage(shapeType: string): Promise<void> {
    this.counts.set(shapeType, (this.counts.get(shapeType) ?? 0) + 1)
  }

  async topUsed(limit: number): Promise<{ shapeType: string; count: number }[]> {
    // 次数降序；次数相同按首次记录顺序（Map 插入序），最终展示序由 computeTopShapes 决定
    return [...this.counts.entries()]
      .map(([shapeType, count]) => ({ shapeType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }
}

/**
 * Top N 形状类型：按次数降序，次数相同按 allTypes 内置顺序；不足 limit 用内置顺序补足。
 * allTypes 为图元库内置顺序（基本形状 → 流程图）；默认 limit 20。
 */
export function computeTopShapes(
  rows: { shapeType: string; count: number }[],
  allTypes: string[],
  limit = 20,
): string[] {
  const builtinIndex = new Map(allTypes.map((type, index) => [type, index]))
  const sorted = [...rows].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count
    }
    // 次数相同按内置顺序；不在内置列表的类型排到最后（保持相对稳定）
    const ia = builtinIndex.get(a.shapeType) ?? Number.MAX_SAFE_INTEGER
    const ib = builtinIndex.get(b.shapeType) ?? Number.MAX_SAFE_INTEGER
    return ia - ib
  })
  const result: string[] = []
  const seen = new Set<string>()
  for (const row of sorted) {
    if (result.length >= limit) break
    if (seen.has(row.shapeType)) continue
    seen.add(row.shapeType)
    result.push(row.shapeType)
  }
  for (const type of allTypes) {
    if (result.length >= limit) break
    if (seen.has(type)) continue
    seen.add(type)
    result.push(type)
  }
  return result
}
