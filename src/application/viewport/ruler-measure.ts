import type { Unit } from '@/domain/measurement'
import { ptToUnit, unitToPt } from '@/domain/measurement'

export type { Unit }

export function rulerPtToUnit(value: number, unit: Unit): number {
  return ptToUnit(value, unit)
}

export function rulerUnitToPt(value: number, unit: Unit): number {
  return unitToPt(value, unit)
}
