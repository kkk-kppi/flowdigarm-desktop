// tests/unit/editor/text-style-targets.test.ts
// 文本样式目标构建：选中节点 + 选中边首标签；before 逐目标从当前内容取真实值；
// 无文本节点以默认 TextContent 值作 before。
import {
  beforeTextPatchOf,
  buildTextStyleTargets,
  textContentsForSelection,
} from '@/application/inspector/text-style-targets'
import { createDefaultTextContent } from '@/domain/diagram'
import type { TextStylePatch } from '@/application/commands/text-style-command'
import { createTestDocument } from '../../helpers/test-document'

const page = createTestDocument().pages[0]

describe('textContentsForSelection', () => {
  it('收集选中节点文本与选中边首标签文本（保选择序）', () => {
    const labeled = {
      ...page,
      edges: page.edges.map((edge) =>
        edge.id === 'edge-1'
          ? { ...edge, labels: [{ text: createDefaultTextContent('是'), position: 0.5 }] }
          : edge,
      ),
    }
    const contents = textContentsForSelection(labeled, ['node-1', 'edge-1', 'node-3'])
    expect(contents).toHaveLength(3)
    expect(contents[0]?.value).toBe('开始')
    expect(contents[1]?.value).toBe('是')
    expect(contents[2]?.value).toBe('结束')
  })

  it('未选中/无标签边忽略；无文本节点为 undefined', () => {
    const noText = {
      ...page,
      nodes: page.nodes.map((node) => (node.id === 'node-1' ? { ...node, text: undefined } : node)),
    }
    const contents = textContentsForSelection(noText, ['node-1', 'edge-1'])
    expect(contents).toEqual([undefined])
  })
})

describe('beforeTextPatchOf', () => {
  it('before 仅含 patch 涉及的键，取内容当前值', () => {
    const content = createDefaultTextContent('甲')
    content.style.fontSize = 20
    content.block.horizontalAlign = 'left'
    const before = beforeTextPatchOf(content, {
      style: { fontSize: 24 },
      block: { horizontalAlign: 'right' },
    })
    expect(before).toEqual({
      style: { fontSize: 20 },
      block: { horizontalAlign: 'left' },
    })
    expect(before.paragraph).toBeUndefined()
  })
})

describe('buildTextStyleTargets', () => {
  it('节点与边首标签同批；before 逐目标真实值；无文本节点取默认值', () => {
    const labeled = {
      ...page,
      nodes: page.nodes.map((node) =>
        node.id === 'node-2' ? { ...node, text: undefined } : node,
      ),
      edges: page.edges.map((edge) =>
        edge.id === 'edge-1'
          ? { ...edge, labels: [{ text: createDefaultTextContent('是'), position: 0.5 }] }
          : edge,
      ),
    }
    const patch: TextStylePatch = { style: { bold: true } }
    const targets = buildTextStyleTargets(labeled, ['node-1', 'node-2', 'edge-1'], patch)
    expect(targets).toHaveLength(3)
    expect(targets[0].target).toEqual({ kind: 'node', nodeId: 'node-1' })
    expect(targets[0].before).toEqual({ style: { bold: false } })
    expect(targets[1].target).toEqual({ kind: 'node', nodeId: 'node-2' })
    // 无文本节点 before 取默认 TextContent 值
    expect(targets[1].before).toEqual({ style: { bold: false } })
    expect(targets[2].target).toEqual({ kind: 'edgeLabel', edgeId: 'edge-1', labelIndex: 0 })
    expect(targets[2].after).toEqual(patch)
  })

  it('选择为空或无文本目标时返回空数组', () => {
    expect(buildTextStyleTargets(page, [], { style: { bold: true } })).toEqual([])
    // 无边标签的边不作为文本目标
    expect(buildTextStyleTargets(page, ['edge-1'], { style: { bold: true } })).toEqual([])
  })
})
