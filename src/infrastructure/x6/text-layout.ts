// src/infrastructure/x6/text-layout.ts
// 文本布局纯函数：TextContent → X6 label 显示行与 attrs（无 Graph 实例，可在 jsdom 测试）。
// 竖排为逐字排版（每字符一行，源文本 \n 视为换列、以空行占位），禁止用 transform 旋转整段。
// 说明（最简可靠方案）：
// - X6 label 为 SVG text，不支持文本背景填充；textBackground 键写入 attrs 供覆盖层编辑器读取，
//   画布渲染降级为纯文本。
// - lineHeight 以倍率原样写入 attrs（X6 未知键降级为无害 DOM 属性）；段前/段后（pt）无 SVG 对应
//   概念，本版本注释说明、不落 attrs；文本块偏移由 TextBlock 四边距（textAreaInset）承担。
import type { DiagramNode, TextContent } from '@/domain/diagram'

export interface TextLayoutInput {
  content: TextContent
  /** 文本区尺寸 pt（textAreaForNode 结果）。 */
  areaPt: { width: number; height: number }
}

export interface TextLayoutResult {
  /** 已按方向处理好的显示行（竖排为单字符行）。 */
  lines: string[]
  /** horizontal → true（交给 X6 textWrap 裁剪）；vertical → false（预设 \n 分行）。 */
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
    lineHeight: content.paragraph.lineHeight,
  }
  if (content.style.background) {
    attrs.textBackground = content.style.background
  }
  return {
    lines: vertical ? verticalLines(content.value) : content.value.split('\n'),
    wrap: !vertical,
    attrs,
  }
}

/** 节点文本区 = bbox − 四边内缩（pt，文档坐标）；内缩超过尺寸时宽高钳制为 0。 */
export function textAreaForNode(
  node: DiagramNode,
  inset: { top: number; right: number; bottom: number; left: number },
): { x: number; y: number; width: number; height: number } {
  return {
    x: node.x + inset.left,
    y: node.y + inset.top,
    width: Math.max(0, node.width - inset.left - inset.right),
    height: Math.max(0, node.height - inset.top - inset.bottom),
  }
}
