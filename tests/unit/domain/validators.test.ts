// tests/unit/domain/validators.test.ts
import type { DiagramEdge, DiagramNode } from '@/domain/diagram'
import {
  createDefaultEdgeStyle,
  createDefaultNodeStyle,
  createEmptyDocument,
  createEmptyPage,
} from '@/domain/diagram'
import { MAX_PT } from '@/domain/limits'
import {
  collectDuplicateIds,
  findBackgroundPageCycle,
  findDanglingPortReferences,
  isAllowedHyperlinkProtocol,
  isFiniteNumber,
  isUuidV4,
  isValidColor,
  isValidPtLength,
  isValidPtPosition,
} from '@/domain/validators'

function makeNode(id: string, overrides: Partial<DiagramNode> = {}): DiagramNode {
  return {
    id,
    shape: 'rect',
    x: 10,
    y: 20,
    width: 120,
    height: 60,
    angle: 0,
    zIndex: 0,
    style: createDefaultNodeStyle(),
    ...overrides,
  }
}

function makeEdge(id: string, sourceId: string, targetId: string, overrides: Partial<DiagramEdge> = {}): DiagramEdge {
  return {
    id,
    source: { nodeId: sourceId },
    target: { nodeId: targetId },
    connector: 'orthogonal',
    vertices: [],
    labels: [],
    style: createDefaultEdgeStyle(),
    zIndex: 0,
    ...overrides,
  }
}

describe('基础谓词', () => {
  it('isFiniteNumber 只接受有限数字', () => {
    expect(isFiniteNumber(0)).toBe(true)
    expect(isFiniteNumber(-3.14)).toBe(true)
    expect(isFiniteNumber(Number.NaN)).toBe(false)
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isFiniteNumber('12')).toBe(false)
    expect(isFiniteNumber(null)).toBe(false)
  })

  it('isValidPtLength 要求 0..MAX_PT', () => {
    expect(isValidPtLength(0)).toBe(true)
    expect(isValidPtLength(MAX_PT)).toBe(true)
    expect(isValidPtLength(-1)).toBe(false)
    expect(isValidPtLength(MAX_PT + 1)).toBe(false)
    expect(isValidPtLength(Number.NaN)).toBe(false)
  })

  it('isValidPtPosition 允许负值但限制绝对值', () => {
    expect(isValidPtPosition(-100)).toBe(true)
    expect(isValidPtPosition(MAX_PT)).toBe(true)
    expect(isValidPtPosition(-MAX_PT)).toBe(true)
    expect(isValidPtPosition(MAX_PT + 1)).toBe(false)
    expect(isValidPtPosition(-MAX_PT - 1)).toBe(false)
    expect(isValidPtPosition(Number.NaN)).toBe(false)
  })

  it('isValidColor 接受 #RRGGBB 与 #RRGGBBAA（大小写不敏感）', () => {
    expect(isValidColor('#FFFFFF')).toBe(true)
    expect(isValidColor('#a1b2c3')).toBe(true)
    expect(isValidColor('#FFFFFF80')).toBe(true)
    expect(isValidColor('#a1B2c3D4')).toBe(true)
    expect(isValidColor('#FFF')).toBe(false)
    expect(isValidColor('#GGGGGG')).toBe(false)
    expect(isValidColor('红色')).toBe(false)
    expect(isValidColor('')).toBe(false)
    expect(isValidColor(123)).toBe(false)
  })

  it('isUuidV4 只接受 v4 UUID', () => {
    expect(isUuidV4(crypto.randomUUID())).toBe(true)
    expect(isUuidV4('11111111-1111-4111-8111-111111111111')).toBe(true)
    expect(isUuidV4('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(false) // v1
    expect(isUuidV4('节点一')).toBe(false)
    expect(isUuidV4('')).toBe(false)
  })

  it('isAllowedHyperlinkProtocol 仅放行 http/https/mailto', () => {
    expect(isAllowedHyperlinkProtocol('javascript:alert(1)')).toBe(false)
    expect(isAllowedHyperlinkProtocol('HTTPS://A.COM')).toBe(true)
    expect(isAllowedHyperlinkProtocol('http://example.com/订单')).toBe(true)
    expect(isAllowedHyperlinkProtocol('mailto:someone@example.com')).toBe(true)
    expect(isAllowedHyperlinkProtocol('ftp://example.com')).toBe(false)
    expect(isAllowedHyperlinkProtocol('file:///C:/秘密.txt')).toBe(false)
    expect(isAllowedHyperlinkProtocol('不是链接')).toBe(false)
  })
})

describe('文档结构谓词', () => {
  it('collectDuplicateIds 返回重复的 id', () => {
    const doc = createEmptyDocument('重复测试')
    const page = doc.pages[0]
    page.nodes.push(makeNode('节点-重复'), makeNode('节点-重复'), makeNode('节点-唯一'))
    page.edges.push(makeEdge('连线-重复', '节点-重复', '节点-唯一'), makeEdge('连线-重复', '节点-唯一', '节点-重复'))
    const duplicates = collectDuplicateIds(doc)
    expect(duplicates).toContain('节点-重复')
    expect(duplicates).toContain('连线-重复')
    expect(duplicates).toHaveLength(2)
  })

  it('collectDuplicateIds 对唯一 id 文档返回空数组', () => {
    const doc = createEmptyDocument('唯一测试')
    const page = doc.pages[0]
    page.nodes.push(makeNode('节点甲'), makeNode('节点乙'))
    page.edges.push(makeEdge('连线一', '节点甲', '节点乙'))
    expect(collectDuplicateIds(doc)).toEqual([])
  })

  it('findBackgroundPageCycle 检测背景页引用环', () => {
    const bg1 = createEmptyPage({ name: '背景一', type: 'background' })
    const bg2 = createEmptyPage({ name: '背景二', type: 'background' })
    bg1.backgroundPageId = bg2.id
    bg2.backgroundPageId = bg1.id
    const doc = createEmptyDocument('循环测试')
    doc.pages = [bg1, bg2]
    const cycle = findBackgroundPageCycle(doc)
    expect(cycle).not.toBeNull()
    expect(cycle).toContain(bg1.id)
    expect(cycle).toContain(bg2.id)
  })

  it('findBackgroundPageCycle 对无环引用返回 null', () => {
    const background = createEmptyPage({ name: '背景页', type: 'background' })
    const foreground = createEmptyPage({ name: '前景页' })
    foreground.backgroundPageId = background.id
    const doc = createEmptyDocument('无环测试')
    doc.pages = [foreground, background]
    expect(findBackgroundPageCycle(doc)).toBeNull()
  })

  it('findDanglingPortReferences 找出端口不在形状端口集中的边', () => {
    const page = createEmptyPage()
    page.nodes.push(makeNode('节点甲'), makeNode('节点乙'))
    page.edges.push(
      makeEdge('连线-好', '节点甲', '节点乙', { source: { nodeId: '节点甲', port: 'right' }, target: { nodeId: '节点乙', port: 'left' } }),
      makeEdge('连线-坏', '节点甲', '节点乙', { source: { nodeId: '节点甲', port: '不存在的端口' } }),
    )
    const resolver = (shape: string) => (shape === 'rect' ? ['left', 'right'] : [])
    expect(findDanglingPortReferences(page, resolver)).toEqual(['连线-坏'])
  })

  it('findDanglingPortReferences 对引用不存在节点的边也算悬空', () => {
    const page = createEmptyPage()
    page.nodes.push(makeNode('节点甲'))
    page.edges.push(makeEdge('连线-悬空', '节点甲', '不存在的节点'))
    expect(findDanglingPortReferences(page, () => [])).toEqual(['连线-悬空'])
    page.edges[0] = makeEdge('连线-正常', '节点甲', '节点甲')
    expect(findDanglingPortReferences(page, () => [])).toEqual([])
  })
})
