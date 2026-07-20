// tests/unit/editor/arrangement/descendants.test.ts
// 后代收集：沿 parentId 链收集全部后代 id（多层嵌套），不含根自身；环安全。
import { describe, expect, it } from 'vitest'
import { createEmptyPage } from '@/domain/diagram'
import { collectDescendantIds } from '@/application/arrangement/descendants'
import { createTestNode } from '../../../helpers/test-document'

describe('collectDescendantIds', () => {
  it('收集直接子节点与多层嵌套后代', () => {
    const page = createEmptyPage({
      id: 'page-1',
      nodes: [
        createTestNode({ id: 'container', shape: 'group', isContainer: true }),
        createTestNode({ id: 'child-1', parentId: 'container' }),
        createTestNode({ id: 'child-2', parentId: 'container' }),
        createTestNode({ id: 'nested', shape: 'group', isContainer: true, parentId: 'container' }),
        createTestNode({ id: 'grandchild', parentId: 'nested' }),
        createTestNode({ id: 'outsider' }),
      ],
    })
    const result = collectDescendantIds(page, ['container'])
    expect(result).toHaveLength(4)
    expect(result).toEqual(expect.arrayContaining(['child-1', 'child-2', 'nested', 'grandchild']))
    expect(result).not.toContain('container')
    expect(result).not.toContain('outsider')
  })

  it('多个根：合并各根后代；无后代返回空数组', () => {
    const page = createEmptyPage({
      id: 'page-1',
      nodes: [
        createTestNode({ id: 'a' }),
        createTestNode({ id: 'b', parentId: 'a' }),
        createTestNode({ id: 'c' }),
        createTestNode({ id: 'd', parentId: 'c' }),
      ],
    })
    expect(collectDescendantIds(page, ['a', 'c'])).toEqual(
      expect.arrayContaining(['b', 'd']),
    )
    expect(collectDescendantIds(page, ['b', 'd'])).toEqual([])
    expect(collectDescendantIds(page, [])).toEqual([])
  })

  it('parentId 指向不存在节点时按顶层处理；环数据不导致死循环', () => {
    const page = createEmptyPage({
      id: 'page-1',
      nodes: [
        createTestNode({ id: 'a', parentId: 'b' }),
        createTestNode({ id: 'b', parentId: 'a' }), // 环（损坏数据）
        createTestNode({ id: 'c', parentId: 'ghost' }), // 悬空 parentId
      ],
    })
    expect(collectDescendantIds(page, ['a'])).toEqual(['b'])
    expect(collectDescendantIds(page, ['c'])).toEqual([])
  })
})
