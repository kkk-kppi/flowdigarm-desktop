// tests/unit/editor/selection/restore-selection.test.ts
// 重渲染后选择恢复：渲染前快照的选择经「仍存在当前页」过滤后恢复；
// 已删除图元丢弃、保序（首元素仍为锚点）。jsdom 无法运行 X6，编排逻辑抽为纯函数单测。
import { computeRestoredSelection } from '@/application/selection/restore-selection'
import { createEmptyPage, type DiagramPage } from '@/domain/diagram'
import { createTestEdge, createTestNode } from '../../../helpers/test-document'

function 三节点页面(): DiagramPage {
  return createEmptyPage({
    id: 'page-1',
    name: '流程页',
    nodes: [
      createTestNode({ id: 'node-1' }),
      createTestNode({ id: 'node-2' }),
      createTestNode({ id: 'node-3' }),
    ],
    edges: [createTestEdge({ id: 'edge-1' })],
  })
}

describe('computeRestoredSelection', () => {
  it('全部选中 id 仍存在时原样保序恢复（首元素仍为锚点）', () => {
    const page = 三节点页面()
    expect(computeRestoredSelection(['node-2', 'node-1', 'edge-1'], page)).toEqual([
      'node-2',
      'node-1',
      'edge-1',
    ])
  })

  it('已不存在于页面的 id 被丢弃，其余保序（命令删除图元后场景）', () => {
    const page = 三节点页面()
    expect(computeRestoredSelection(['node-1', '幽灵节点', 'node-3'], page)).toEqual([
      'node-1',
      'node-3',
    ])
    expect(computeRestoredSelection(['幽灵边', 'edge-1'], page)).toEqual(['edge-1'])
  })

  it('节点与边 id 都计入存活集合', () => {
    const page = 三节点页面()
    expect(computeRestoredSelection(['edge-1', 'node-2'], page)).toEqual(['edge-1', 'node-2'])
  })

  it('空选择恢复为空；页面为空时任何选择都丢弃', () => {
    const page = 三节点页面()
    expect(computeRestoredSelection([], page)).toEqual([])
    const 空页 = createEmptyPage({ id: 'page-空', name: '空白页' })
    expect(computeRestoredSelection(['node-1'], 空页)).toEqual([])
  })
})
