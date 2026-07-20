// tests/unit/editor/arrangement/auto-connect.test.ts
// 自动连线：按选择顺序生成 n−1 条边；端口为互相对侧最近端口；
// 箭头随页面 defaultArrow；autoConnectLabel 开/关；一次操作一条撤销记录。
import { describe, expect, it, beforeEach } from 'vitest'
import { createEmptyPage, type DiagramPage } from '@/domain/diagram'
import { CommandHistory } from '@/application/commands/command-history'
import { createAutoConnectCommand } from '@/application/arrangement/auto-connect'
import { createTestDocument, createTestNode } from '../../../helpers/test-document'

/** 三节点：n1(0,0) n2(100,0) n3(50,100)，各 40×20。 */
function connectPage(partial: Partial<DiagramPage> = {}): DiagramPage {
  return createEmptyPage({
    id: 'page-1',
    nodes: [
      createTestNode({ id: 'n1', x: 0, y: 0, width: 40, height: 20, zIndex: 0 }),
      createTestNode({ id: 'n2', x: 100, y: 0, width: 40, height: 20, zIndex: 1 }),
      createTestNode({ id: 'n3', x: 50, y: 100, width: 40, height: 20, zIndex: 2 }),
    ],
    ...partial,
  })
}

let idSeq = 0
function idGen(): string {
  idSeq += 1
  return `edge-auto-${idSeq}`
}

beforeEach(() => {
  idSeq = 0
})

describe('createAutoConnectCommand 边生成', () => {
  it('3 节点按选择顺序生成 2 条边（n1→n2→n3）', () => {
    const page = connectPage()
    const command = createAutoConnectCommand(page, ['n1', 'n2', 'n3'], idGen)
    expect(command).not.toBeNull()
    const next = command!.apply({ ...createTestDocument(), pages: [page] }).pages[0]
    expect(next.edges).toHaveLength(2)
    expect(next.edges[0]).toMatchObject({
      id: 'edge-auto-1',
      source: { nodeId: 'n1' },
      target: { nodeId: 'n2' },
    })
    expect(next.edges[1]).toMatchObject({
      id: 'edge-auto-2',
      source: { nodeId: 'n2' },
      target: { nodeId: 'n3' },
    })
  })

  it('端口为互相对侧最近端口（水平相邻用 right/left，斜向用 bottom/top）', () => {
    const page = connectPage()
    const next = createAutoConnectCommand(page, ['n1', 'n2', 'n3'], idGen)!.apply({
      ...createTestDocument(),
      pages: [page],
    }).pages[0]
    // n1→n2：n1 右侧端口对 n2 中心最近；n2 左侧端口对 n1 中心最近
    expect(next.edges[0].source.port).toBe('right')
    expect(next.edges[0].target.port).toBe('left')
    // n2→n3：n2 底侧端口对 n3 中心最近；n3 顶侧端口对 n2 中心最近
    expect(next.edges[1].source.port).toBe('bottom')
    expect(next.edges[1].target.port).toBe('top')
  })

  it('连线类型取页面 defaultConnector；箭头随 defaultArrow（single/double/none）', () => {
    const single = createAutoConnectCommand(connectPage({ defaultConnector: 'straight' }), ['n1', 'n2'], idGen)!
      .apply({ ...createTestDocument(), pages: [connectPage()] })
      .pages[0].edges[0]
    expect(single.connector).toBe('straight')
    expect(single.style).toMatchObject({ sourceArrow: 'none', targetArrow: 'arrow' })

    const pageDouble = connectPage({ defaultArrow: 'double' })
    const double = createAutoConnectCommand(pageDouble, ['n1', 'n2'], idGen)!
      .apply({ ...createTestDocument(), pages: [pageDouble] })
      .pages[0].edges[0]
    expect(double.style).toMatchObject({ sourceArrow: 'arrow', targetArrow: 'arrow' })

    const pageNone = connectPage({ defaultArrow: 'none' })
    const none = createAutoConnectCommand(pageNone, ['n1', 'n2'], idGen)!
      .apply({ ...createTestDocument(), pages: [pageNone] })
      .pages[0].edges[0]
    expect(none.style).toMatchObject({ sourceArrow: 'none', targetArrow: 'none' })
  })

  it('autoConnectLabel 开启时每条边带一个空标签（position 0.5）；关闭时无标签', () => {
    const pageOn = connectPage({ autoConnectLabel: true })
    const withLabel = createAutoConnectCommand(pageOn, ['n1', 'n2'], idGen)!
      .apply({ ...createTestDocument(), pages: [pageOn] })
      .pages[0].edges[0]
    expect(withLabel.labels).toHaveLength(1)
    expect(withLabel.labels[0]).toMatchObject({ position: 0.5 })
    expect(withLabel.labels[0].text.value).toBe('')

    const pageOff = connectPage({ autoConnectLabel: false })
    const noLabel = createAutoConnectCommand(pageOff, ['n1', 'n2'], idGen)!
      .apply({ ...createTestDocument(), pages: [pageOff] })
      .pages[0].edges[0]
    expect(noLabel.labels).toHaveLength(0)
  })

  it('少于 2 个有效节点返回 null', () => {
    const page = connectPage()
    expect(createAutoConnectCommand(page, ['n1'], idGen)).toBeNull()
    expect(createAutoConnectCommand(page, [], idGen)).toBeNull()
    expect(createAutoConnectCommand(page, ['n1', '不存在'], idGen)).toBeNull()
  })

  it('容器节点不作为连接端点（跳过容器后不足 2 个 → null）', () => {
    const page = connectPage({
      nodes: [
        createTestNode({ id: 'n1', x: 0, y: 0, zIndex: 0 }),
        createTestNode({ id: 'g1', x: 100, y: 0, zIndex: 1, shape: 'group', isContainer: true }),
      ],
    })
    expect(createAutoConnectCommand(page, ['n1', 'g1'], idGen)).toBeNull()
  })

  it('标签为「自动连线」；一次操作一条撤销记录，撤销一步删除全部新边', () => {
    const page = connectPage()
    const command = createAutoConnectCommand(page, ['n1', 'n2', 'n3'], idGen)!
    expect(command.label).toBe('自动连线')

    const history = new CommandHistory()
    const next = history.execute(command, { ...createTestDocument(), pages: [page] })
    expect(history.size).toBe(1)
    expect(next.pages[0].edges).toHaveLength(2)

    const reverted = history.undo(next)
    expect(reverted?.pages[0].edges).toHaveLength(0)
  })
})
