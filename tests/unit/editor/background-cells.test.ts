// tests/unit/editor/background-cells.test.ts
// 背景页 cell 元数据：zIndex 压底偏移、data {background:true} 标记、
// 交互/选择排除谓词——「背景页内容在前景页不可直接选择」的唯一实现（graph-adapter 调用）。
import { createEmptyPage } from '@/domain/diagram'
import { pageToCells } from '@/infrastructure/x6/cell-mapper'
import {
  BACKGROUND_Z_OFFSET,
  isBackgroundCellData,
  isCellInteractable,
  toBackgroundCell,
} from '@/infrastructure/x6/background-cells'
import { createTestEdge, createTestNode } from '../../helpers/test-document'

describe('toBackgroundCell', () => {
  it('背景节点 zIndex 整体压底：低于同基准前景 cell 一个偏移量', () => {
    const page = createEmptyPage({ nodes: [createTestNode({ id: 'n-1', zIndex: 3 })] })
    const [foreground] = pageToCells(page)
    const background = toBackgroundCell(foreground)
    expect(background.zIndex).toBe(foreground.zIndex - BACKGROUND_Z_OFFSET)
    expect(background.zIndex).toBeLessThan(foreground.zIndex)
  })

  it('背景边同样压底并携带 data 标记', () => {
    const page = createEmptyPage({
      nodes: [createTestNode({ id: 'n-1' }), createTestNode({ id: 'n-2' })],
      edges: [createTestEdge({ id: 'e-1', zIndex: 2 })],
    })
    const edgeMeta = pageToCells(page).find((cell) => cell.kind === 'edge')
    expect(edgeMeta).toBeDefined()
    const background = toBackgroundCell(edgeMeta!)
    expect(background.zIndex).toBe(2 - BACKGROUND_Z_OFFSET)
    expect(background.data).toEqual({ background: true })
  })

  it('携带 data {background:true} 标记且不改动原元数据', () => {
    const page = createEmptyPage({ nodes: [createTestNode({ id: 'n-1' })] })
    const [foreground] = pageToCells(page)
    const background = toBackgroundCell(foreground)
    expect(background.data).toEqual({ background: true })
    expect(foreground.data).toBeUndefined()
    expect(foreground.zIndex).toBe(0)
  })
})

describe('isBackgroundCellData / isCellInteractable', () => {
  it('data 标记识别：标记为 true，普通/空 data 为 false', () => {
    expect(isBackgroundCellData({ background: true })).toBe(true)
    expect(isBackgroundCellData({ background: false })).toBe(false)
    expect(isBackgroundCellData({})).toBe(false)
    expect(isBackgroundCellData(undefined)).toBe(false)
    expect(isBackgroundCellData(null)).toBe(false)
  })

  it('交互/选择谓词：背景标记 cell 返回 false（排除），普通 cell 返回 true', () => {
    const backgroundCell = { getData: () => ({ background: true }) }
    const normalCell = { getData: () => undefined }
    expect(isCellInteractable(backgroundCell)).toBe(false)
    expect(isCellInteractable(normalCell)).toBe(true)
  })
})
