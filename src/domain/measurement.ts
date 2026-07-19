// src/domain/measurement.ts
// pt 度量体系：所有文档内部长度一律以 pt 存储，本文件提供单位换算与显示格式化。

export type Unit = 'mm' | 'cm' | 'in' | 'pt' | 'px'

const PT_PER_INCH = 72

// 固定换算：1 in = 72 pt；1 cm = 72/2.54 pt；1 mm = 72/25.4 pt；1 CSS px = 72/96 pt。
const PT_PER_UNIT: Record<Unit, number> = {
  mm: PT_PER_INCH / 25.4,
  cm: PT_PER_INCH / 2.54,
  in: PT_PER_INCH,
  pt: 1,
  px: PT_PER_INCH / 96,
}

// formatMeasure 小数位：mm→1 位、cm→2 位、in→2 位、pt→1 位、px→0 位。
const FORMAT_DIGITS: Record<Unit, number> = {
  mm: 1,
  cm: 2,
  in: 2,
  pt: 1,
  px: 0,
}

function ptPerUnit(unit: Unit): number {
  const factor = (PT_PER_UNIT as Record<string, number>)[unit as string]
  if (typeof factor !== 'number') {
    throw new Error(`未知单位：${unit}`)
  }
  return factor
}

export function unitToPt(value: number, unit: Unit): number {
  return value * ptPerUnit(unit)
}

export function ptToUnit(pt: number, unit: Unit): number {
  return pt / ptPerUnit(unit)
}

export function formatMeasure(pt: number, unit: Unit): string {
  const digits = (FORMAT_DIGITS as Record<string, number>)[unit as string]
  if (typeof digits !== 'number') {
    throw new Error(`未知单位：${unit}`)
  }
  return ptToUnit(pt, unit).toFixed(digits)
}
