// tests/unit/editor/arrangement/align-cells.test.ts
// 锚点对齐：基准 = 选择序列第一个图元（非外接矩形/最后点击）；
// 六种模式各以第一个为基准；<2 个有效节点 → null；一次对齐一条撤销记录。
import { describe, expect, it } from 'vitest'
import { createEmptyPage, type DiagramPage } from '@/domain/diagram'
import { CommandHistory } from '@/application/commands/command-history'
import { createAlignCommand } from '@/application/arrangement/align-cells'
import { createTestDocument, createTestNode } from '../../../helpers/test-document'

/** 三节点：anchor(node-1) 非最左/最上，便于构造与外接矩形基准不同的反例。 */
function alignPage(): DiagramPage {
  return createEmptyPage({
    id: 'page-1',
    nodes: [
      createTestNode({ id: 'node-1', x: 100, y: 100, width: 50, height: 30, zIndex: 0 }),
      createTestNode({ id: 'node-2', x: 200, y: 300, width: 40, height: 20, zIndex: 1 }),
      createTestNode({ id: 'node-3', x: 10, y: 50, width: 60, height: 10, zIndex: 2 }),
    ],
  })
}

function applyAlign(page: DiagramPage, ids: string[], mode: Parameters<typeof createAlignCommand>[2]) {
  const command = createAlignCommand(page, ids, mode)
  expect(command).not.toBeNull()
  const document = { ...createTestDocument(), pages: [page] }
  const next = command!.apply(document)
  return { command: command!, page: next.pages[0] }
}

describe('createAlignCommand 水平对齐（基准 = 选择序列第一个图元）', () => {
  it('左对齐：各节点 x = 第一个图元 x（非外接矩形左边）', () => {
    // 外接矩形左边 = 10（node-3），基准左边 = 100（node-1）；两者不同构成反例
    const { page } = applyAlign(alignPage(), ['node-1', 'node-2', 'node-3'], 'left')
    expect(page.nodes.find((n) => n.id === 'node-1')).toMatchObject({ x: 100, y: 100 })
    expect(page.nodes.find((n) => n.id === 'node-2')).toMatchObject({ x: 100, y: 300 })
    expect(page.nodes.find((n) => n.id === 'node-3')).toMatchObject({ x: 100, y: 50 })
  })

  it('水平居中：各节点 x = 第一个图元中心 x − 自身宽/2', () => {
    // anchor 中心 x = 100 + 25 = 125
    const { page } = applyAlign(alignPage(), ['node-1', 'node-2', 'node-3'], 'center-h')
    expect(page.nodes.find((n) => n.id === 'node-2')).toMatchObject({ x: 125 - 20, y: 300 })
    expect(page.nodes.find((n) => n.id === 'node-3')).toMatchObject({ x: 125 - 30, y: 50 })
  })

  it('右对齐：各节点 x = 第一个图元右边 − 自身宽', () => {
    // anchor 右边 = 150
    const { page } = applyAlign(alignPage(), ['node-1', 'node-2', 'node-3'], 'right')
    expect(page.nodes.find((n) => n.id === 'node-2')).toMatchObject({ x: 150 - 40, y: 300 })
    expect(page.nodes.find((n) => n.id === 'node-3')).toMatchObject({ x: 150 - 60, y: 50 })
  })
})

describe('createAlignCommand 垂直对齐', () => {
  it('顶端对齐：各节点 y = 第一个图元 y（非外接矩形顶边 50）', () => {
    const { page } = applyAlign(alignPage(), ['node-1', 'node-2', 'node-3'], 'top')
    expect(page.nodes.find((n) => n.id === 'node-2')).toMatchObject({ x: 200, y: 100 })
    expect(page.nodes.find((n) => n.id === 'node-3')).toMatchObject({ x: 10, y: 100 })
  })

  it('垂直居中：各节点 y = 第一个图元中心 y − 自身高/2', () => {
    // anchor 中心 y = 100 + 15 = 115
    const { page } = applyAlign(alignPage(), ['node-1', 'node-2', 'node-3'], 'middle-v')
    expect(page.nodes.find((n) => n.id === 'node-2')).toMatchObject({ x: 200, y: 115 - 10 })
    expect(page.nodes.find((n) => n.id === 'node-3')).toMatchObject({ x: 10, y: 115 - 5 })
  })

  it('底端对齐：各节点 y = 第一个图元底边 − 自身高', () => {
    // anchor 底边 = 130
    const { page } = applyAlign(alignPage(), ['node-1', 'node-2', 'node-3'], 'bottom')
    expect(page.nodes.find((n) => n.id === 'node-2')).toMatchObject({ x: 200, y: 130 - 20 })
    expect(page.nodes.find((n) => n.id === 'node-3')).toMatchObject({ x: 10, y: 130 - 10 })
  })
})

describe('createAlignCommand 边界与撤销', () => {
  it('少于 2 个有效节点返回 null（空选/单选/ID 不存在）', () => {
    const page = alignPage()
    expect(createAlignCommand(page, [], 'left')).toBeNull()
    expect(createAlignCommand(page, ['node-1'], 'left')).toBeNull()
    expect(createAlignCommand(page, ['不存在'], 'left')).toBeNull()
    expect(createAlignCommand(page, ['node-1', '不存在'], 'left')).toBeNull()
  })

  it('边 ID 不参与对齐（过滤后不足 2 个节点 → null）', () => {
    const page = createEmptyPage({
      id: 'page-1',
      nodes: [createTestNode({ id: 'node-1', x: 0, y: 0 })],
      edges: [
        {
          id: 'edge-1',
          source: { nodeId: 'node-1' },
          target: { nodeId: 'node-1' },
          connector: 'straight',
          vertices: [],
          labels: [],
          style: {
            stroke: '#666666',
            strokeWidth: 1,
            opacity: 1,
            dash: 'solid',
            sourceArrow: 'none',
            targetArrow: 'arrow',
          },
          zIndex: 1,
        },
      ],
    })
    expect(createAlignCommand(page, ['node-1', 'edge-1'], 'left')).toBeNull()
  })

  it('全部节点已在基准位置（无实际移动）返回 null', () => {
    const page = createEmptyPage({
      id: 'page-1',
      nodes: [
        createTestNode({ id: 'node-1', x: 100, y: 0, width: 50, height: 30 }),
        createTestNode({ id: 'node-2', x: 100, y: 90, width: 40, height: 20 }),
      ],
    })
    expect(createAlignCommand(page, ['node-1', 'node-2'], 'left')).toBeNull()
  })

  it('标签为「对齐图元」；一次对齐一条撤销记录，撤销一步全部恢复', () => {
    const page = alignPage()
    const command = createAlignCommand(page, ['node-1', 'node-2', 'node-3'], 'left')
    expect(command?.label).toBe('对齐图元')

    const history = new CommandHistory()
    const document = { ...createTestDocument(), pages: [page] }
    const next = history.execute(command!, document)
    expect(history.size).toBe(1)
    expect(next.pages[0].nodes.every((n) => n.x === 100)).toBe(true)

    const reverted = history.undo(next)
    expect(reverted?.pages[0].nodes.find((n) => n.id === 'node-2')).toMatchObject({ x: 200, y: 300 })
    expect(reverted?.pages[0].nodes.find((n) => n.id === 'node-3')).toMatchObject({ x: 10, y: 50 })
  })
})
