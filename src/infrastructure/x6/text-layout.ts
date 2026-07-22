// src/infrastructure/x6/text-layout.ts
// 文本布局纯函数：TextContent → X6 label 显示行与 attrs（无 Graph 实例，可在 jsdom 测试）。
// 竖排为逐字排版（每字符一行，源文本 \n 视为换列、以空行占位），禁止用 transform 旋转整段。
// 说明（最简可靠方案）：
// - X6 label 为 SVG text，不支持文本背景填充；textBackground 键写入 attrs 供覆盖层编辑器读取，
//   画布渲染降级为纯文本。
// - lineHeight 将领域倍率换算为 X6/SVG tspan 的绝对 dy；段前/段后和文本块四边距统一收缩文本区。
import type { DiagramNode, TextContent } from '@/domain/diagram'

export interface TextLayoutInput {
  content: TextContent
  /** 文本区尺寸 pt（textAreaForNode 结果）。 */
  areaPt: { width: number; height: number }
}

export interface TextLayoutResult {
  /** 已按方向处理好的显示行（竖排为单字符行）。 */
  lines: string[]
  /** 文本已在纯函数中完成分行，固定为 false，禁止 X6 再次按高度截断。 */
  wrap: boolean
  /** X6 label attrs：fontFamily/fontSize/fontWeight/fontStyle/textDecoration/fill/
   *  textAnchor/textVerticalAnchor/textBackground/lineHeight。 */
  attrs: Record<string, unknown>
}

const HORIZONTAL_ANCHORS = { left: 'start', center: 'middle', right: 'end' } as const
const VERTICAL_ANCHORS = { top: 'top', middle: 'middle', bottom: 'bottom' } as const

/** 竖排逐字分行：每字符一行；源文本 \n 视为换列，以空行占位（X6 不支持多列竖排）。 */
function verticalLines(value: string): string[] {
  const lines: string[] = []
  for (const char of value) {
    lines.push(char === '\n' ? '' : char)
  }
  return lines
}

export function layoutText(input: TextLayoutInput): TextLayoutResult {
  const { content } = input
  const vertical = content.block.direction === 'vertical'
  const decorations: string[] = []
  if (content.style.underline) decorations.push('underline')
  if (content.style.strikethrough) decorations.push('line-through')
  const attrs: Record<string, unknown> = {
    fontFamily: content.style.fontFamily,
    fontSize: content.style.fontSize,
    fontWeight: content.style.bold ? 700 : 400,
    fontStyle: content.style.italic ? 'italic' : 'normal',
    textDecoration: decorations.length > 0 ? decorations.join(' ') : 'none',
    fill: content.style.color,
    textAnchor: HORIZONTAL_ANCHORS[content.block.horizontalAlign],
    textVerticalAnchor: VERTICAL_ANCHORS[content.block.verticalAlign],
    // X6 将 lineHeight 作为 SVG tspan 的绝对 dy；领域值是 CSS 风格倍率。
    lineHeight: Number((content.style.fontSize * content.paragraph.lineHeight).toFixed(3)),
  }
  if (content.style.background) {
    attrs.textBackground = content.style.background
  }
  return {
    lines: vertical ? verticalLines(content.value) : wrapHorizontalText(content, input.areaPt.width),
    wrap: false,
    attrs,
  }
}

/** 节点文本区 = bbox − 四边内缩（pt，文档坐标）；内缩超过尺寸时宽高钳制为 0。 */
export function textAreaForNode(
  node: DiagramNode,
  inset: { top: number; right: number; bottom: number; left: number },
  content?: TextContent,
): { x: number; y: number; width: number; height: number } {
  const block = content?.block
  const paragraph = content?.paragraph
  const left = inset.left + (block?.marginLeft ?? 0)
  const right = inset.right + (block?.marginRight ?? 0)
  const top = inset.top + (block?.marginTop ?? 0) + (paragraph?.before ?? 0)
  const bottom = inset.bottom + (block?.marginBottom ?? 0) + (paragraph?.after ?? 0)
  return {
    x: node.x + left,
    y: node.y + top,
    width: Math.max(0, node.width - left - right),
    height: Math.max(0, node.height - top - bottom),
  }
}

/** 无 SVG view 时估算文本外框，供边标签编辑器提供不会裁掉内容的安全尺寸。 */
export function estimateTextSizePt(content: TextContent): { width: number; height: number } {
  const advance = content.style.fontSize * content.paragraph.lineHeight
  if (content.block.direction === 'vertical') {
    const count = Math.max(1, [...content.value].length)
    return {
      width: Number(advance.toFixed(3)),
      height: Number((advance * count).toFixed(3)),
    }
  }
  const lines = content.value.split('\n')
  const maxCharacters = Math.max(1, ...lines.map((line) => [...line].length))
  return {
    width: Number((content.style.fontSize * maxCharacters).toFixed(3)),
    height: Number((advance * Math.max(1, lines.length)).toFixed(3)),
  }
}

let textMeasureContext: CanvasRenderingContext2D | null | undefined

function browserTextMeasureContext(): CanvasRenderingContext2D | null {
  if (textMeasureContext !== undefined) return textMeasureContext
  textMeasureContext = (
    typeof document !== 'undefined'
    && typeof navigator !== 'undefined'
    && !navigator.userAgent.toLowerCase().includes('jsdom')
  )
    ? document.createElement('canvas').getContext('2d')
    : null
  return textMeasureContext
}

/** X6 与 SVG 共用的横排分行；浏览器按真实字体测量，测试环境保守估算，且每次至少消费一个字素。 */
export function wrapHorizontalText(content: TextContent, width: number): string[] {
  const sourceLines = content.value.split('\n')
  if (width < content.style.fontSize) return sourceLines
  const wrapped: string[] = []
  const fallbackAdvance = (character: string): number => {
    if (character === '\t') return content.style.fontSize * 2.4
    if (character === ' ') return content.style.fontSize * 0.33
    return character.codePointAt(0)! <= 0xff
      ? content.style.fontSize * 0.6
      : content.style.fontSize
  }
  const measure = (value: string): number => {
    const context = browserTextMeasureContext()
    if (context) {
      context.font = `${content.style.italic ? 'italic' : 'normal'} ${content.style.bold ? 700 : 400} ${content.style.fontSize}px ${JSON.stringify(content.style.fontFamily)}`
      return context.measureText(value).width
    }
    return [...value].reduce((total, character) => total + fallbackAdvance(character), 0)
  }
  const graphemes = (value: string): string[] => {
    const Segmenter = (Intl as unknown as {
      Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => {
        segment: (input: string) => Iterable<{ segment: string }>
      }
    }).Segmenter
    return Segmenter
      ? [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].map(({ segment }) => segment)
      : [...value]
  }
  for (const sourceLine of sourceLines) {
    if (sourceLine === '') {
      wrapped.push('')
      continue
    }
    if (measure(sourceLine) <= width) {
      wrapped.push(sourceLine)
      continue
    }
    let line = ''
    let lineWidth = 0
    for (const character of graphemes(sourceLine)) {
      const characterWidth = measure(character)
      if (line && lineWidth + characterWidth > width) {
        wrapped.push(line)
        line = ''
        lineWidth = 0
      }
      line += character
      lineWidth += characterWidth
    }
    wrapped.push(line)
  }
  return wrapped
}
