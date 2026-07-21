import type { PageUnit } from '@/domain/diagram'
import { MAX_PT } from '@/domain/limits'
import { formatMeasure, unitToPt } from '@/domain/measurement'

export type GeometryValueKind = 'position' | 'length'

export function geometryDisplayValue(valuePt: number, unit: PageUnit): string {
  return formatMeasure(valuePt, unit)
}

export function parseGeometryInput(
  raw: string | number,
  unit: PageUnit,
  kind: GeometryValueKind,
): number | null {
  const value = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(value)) return null
  const points = unitToPt(value, unit)
  return kind === 'position'
    ? Math.max(-MAX_PT, Math.min(MAX_PT, points))
    : Math.max(0, Math.min(MAX_PT, points))
}
