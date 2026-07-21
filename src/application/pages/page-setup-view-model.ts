import type { PageUnit } from '@/domain/diagram'
import { MAX_PT } from '@/domain/limits'
import { formatMeasure, unitToPt } from '@/domain/measurement'

export function formatPageMeasure(valuePt: number, unit: PageUnit): string {
  return formatMeasure(valuePt, unit)
}

export function parsePageLength(raw: string | number, unit: PageUnit): number | null {
  const value = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(MAX_PT, unitToPt(value, unit)))
}
