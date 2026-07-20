import {
  InMemoryShapeUsageRepository,
  type ShapeUsageRepository,
} from '@/application/shapes/shape-usage-repository'

export type InvokeAdapter = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>

interface ShapeUsageRow {
  shapeType: string
  useCount: number
}

export class TauriShapeUsageRepository implements ShapeUsageRepository {
  private readonly fallback = new InMemoryShapeUsageRepository()
  private degraded = false

  constructor(private readonly invoke: InvokeAdapter) {}

  async recordUsage(shapeType: string): Promise<void> {
    if (this.degraded) {
      await this.fallback.recordUsage(shapeType)
      return
    }
    try {
      await this.invoke('record_shape_usage', { shapeType })
    } catch {
      this.degraded = true
      await this.fallback.recordUsage(shapeType)
    }
  }

  async topUsed(limit: number): Promise<{ shapeType: string; count: number }[]> {
    if (this.degraded) return this.fallback.topUsed(limit)
    try {
      const rows = await this.invoke('top_shape_usage', { limit }) as ShapeUsageRow[]
      return rows.map((row) => ({ shapeType: row.shapeType, count: row.useCount }))
    } catch {
      this.degraded = true
      return this.fallback.topUsed(limit)
    }
  }
}
