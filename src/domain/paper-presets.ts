// src/domain/paper-presets.ts
// 纸张预设尺寸表，全部以 pt 存储、纵向（width ≤ height）。

import { unitToPt } from './measurement'

export type PaperPreset = 'letter' | 'tabloid' | 'legal' | 'statement' | 'executive'
  | 'a3' | 'a4' | 'a5' | 'b4-jis' | 'b5-jis' | 'custom'

export interface PaperSize { width: number; height: number } // pt，纵向

function sizeFromInches(widthIn: number, heightIn: number): PaperSize {
  return { width: unitToPt(widthIn, 'in'), height: unitToPt(heightIn, 'in') }
}

function sizeFromMillimeters(widthMm: number, heightMm: number): PaperSize {
  return { width: unitToPt(widthMm, 'mm'), height: unitToPt(heightMm, 'mm') }
}

export const PAPER_SIZES: Record<Exclude<PaperPreset, 'custom'>, PaperSize> = {
  letter: sizeFromInches(8.5, 11),
  tabloid: sizeFromInches(11, 17),
  legal: sizeFromInches(8.5, 14),
  statement: sizeFromInches(5.5, 8.5),
  executive: sizeFromInches(7.25, 10.5),
  a3: sizeFromMillimeters(297, 420),
  a4: sizeFromMillimeters(210, 297),
  a5: sizeFromMillimeters(148, 210),
  'b4-jis': sizeFromMillimeters(257, 364),
  'b5-jis': sizeFromMillimeters(182, 257),
}

export function paperSizeFor(preset: PaperPreset, custom?: PaperSize): PaperSize {
  if (preset === 'custom') {
    if (!custom) {
      throw new Error('自定义纸张必须提供尺寸。')
    }
    return custom
  }
  return PAPER_SIZES[preset]
}
