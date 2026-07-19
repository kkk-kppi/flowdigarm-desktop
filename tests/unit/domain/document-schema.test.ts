// tests/unit/domain/document-schema.test.ts
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { DiagramDocument, DiagramEdge, DiagramNode, PageUnit } from '@/domain/diagram'
import {
  CURRENT_SCHEMA_VERSION,
  createDefaultEdgeStyle,
  createDefaultNodeStyle,
  createDefaultTextContent,
  createEmptyDocument,
  createEmptyPage,
} from '@/domain/diagram'
import { MAX_TEXT_LENGTH } from '@/domain/limits'
import {
  migrateDocument,
  parseDiagramDocument,
  serializeDiagramDocument,
} from '@/domain/document-schema'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures')
const readFixture = (name: string): string => readFileSync(join(fixturesDir, name), 'utf-8')

const RECT_PORTS = ['left', 'right', 'top', 'bottom']
const portResolver = (shape: string): string[] => (shape === 'rect' ? RECT_PORTS : [])

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

function makeValidDocument(): DiagramDocument {
  const doc = createEmptyDocument('测试流程图')
  const page = doc.pages[0]
  page.nodes.push(
    makeNode('节点甲', { text: createDefaultTextContent('开始') }),
    makeNode('节点乙', { text: createDefaultTextContent('结束') }),
  )
  page.edges.push(makeEdge('连线一', '节点甲', '节点乙'))
  return doc
}

describe('fixtures 解析', () => {
  it('valid.flowdiagram：合法文档解析成功且无警告', () => {
    const result = parseDiagramDocument(readFixture('valid.flowdiagram'), portResolver)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.warnings).toEqual([])
    expect(result.document.name).toBe('订单处理流程')
    expect(result.document.pages).toHaveLength(2)
    const [background, foreground] = result.document.pages
    expect(background.type).toBe('background')
    expect(foreground.type).toBe('foreground')
    expect(foreground.backgroundPageId).toBe(background.id)
    expect(foreground.edges[0].source.port).toBe('right')
    expect(foreground.nodes[1].link).toBe('https://example.com/订单审核规范')
    expect(foreground.nodes[0].text?.value).toBe('接收订单')
  })

  it('valid.flowdiagram：不传 portResolver 也能解析成功', () => {
    const result = parseDiagramDocument(readFixture('valid.flowdiagram'))
    expect(result.ok).toBe(true)
  })

  it('legacy.flowdiagram：旧版文档迁移为唯一前景页', () => {
    const result = parseDiagramDocument(readFixture('legacy.flowdiagram'), portResolver)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(result.document.name).toBe('旧版采购流程')
    expect(result.document.pages).toHaveLength(1)
    const page = result.document.pages[0]
    expect(page.name).toBe('页面 1')
    expect(page.type).toBe('foreground')
    expect(page.nodes).toHaveLength(2)
    expect(page.edges).toHaveLength(1)
    expect(page.nodes[0].text?.value).toBe('提交采购申请')
    expect(result.warnings).toContain('已从旧版本迁移。')
  })

  it('corrupted.flowdiagram：非法 JSON 拒绝', () => {
    const result = parseDiagramDocument(readFixture('corrupted.flowdiagram'))
    expect(result).toEqual({ ok: false, error: '文件格式无效，未打开文件。' })
  })
})

describe('构造用例校验', () => {
  it('负宽节点拒绝', () => {
    const doc = makeValidDocument()
    doc.pages[0].nodes[0].width = -5
    const result = parseDiagramDocument(serializeDiagramDocument(doc))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('文件校验失败：节点尺寸无效。')
  })

  it('未知页面单位拒绝', () => {
    const doc = makeValidDocument()
    doc.pages[0].unit = '尺' as unknown as PageUnit
    const result = parseDiagramDocument(serializeDiagramDocument(doc))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('文件校验失败：页面单位未知。')
  })

  it('重复 ID 拒绝', () => {
    const doc = makeValidDocument()
    doc.pages[0].nodes.push(makeNode('节点甲'))
    const result = parseDiagramDocument(serializeDiagramDocument(doc))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('文件校验失败：存在重复的 ID。')
  })

  it('背景页循环拒绝', () => {
    const doc = makeValidDocument()
    const bg1 = createEmptyPage({ name: '背景一', type: 'background' })
    const bg2 = createEmptyPage({ name: '背景二', type: 'background' })
    bg1.backgroundPageId = bg2.id
    bg2.backgroundPageId = bg1.id
    doc.pages.push(bg1, bg2)
    const result = parseDiagramDocument(serializeDiagramDocument(doc))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('文件校验失败：背景页引用存在循环。')
  })

  it('背景页引用非背景页拒绝', () => {
    const doc = makeValidDocument()
    const other = createEmptyPage({ name: '普通页' })
    doc.pages[0].backgroundPageId = other.id
    doc.pages.push(other)
    const result = parseDiagramDocument(serializeDiagramDocument(doc))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('文件校验失败：背景页引用无效。')
  })

  it('schemaVersion 999 拒绝', () => {
    const doc = makeValidDocument()
    doc.schemaVersion = 999
    const result = parseDiagramDocument(serializeDiagramDocument(doc))
    expect(result).toEqual({ ok: false, error: '不支持的文件版本。' })
  })

  it('边引用不存在的节点拒绝', () => {
    const doc = makeValidDocument()
    doc.pages[0].edges.push(makeEdge('连线-悬空', '节点甲', '不存在的节点'))
    const result = parseDiagramDocument(serializeDiagramDocument(doc))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('文件校验失败：边引用了不存在的节点。')
  })

  it('缺失端口的旧文件迁移为节点中心锚定并加警告', () => {
    const doc = makeValidDocument()
    doc.pages[0].edges[0] = makeEdge('连线一', '节点甲', '节点乙', {
      source: { nodeId: '节点甲', port: '不存在的端口' },
      target: { nodeId: '节点乙', port: 'left' },
    })
    const result = parseDiagramDocument(serializeDiagramDocument(doc), portResolver)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.warnings).toContain('边 连线一 的端口缺失，已锚定到节点中心。')
    expect(result.document.pages[0].edges[0].source.port).toBeUndefined()
    expect(result.document.pages[0].edges[0].target.port).toBe('left')
  })

  it('javascript: 链接拒绝', () => {
    const doc = makeValidDocument()
    doc.pages[0].nodes[0].link = 'javascript:alert(1)'
    const result = parseDiagramDocument(serializeDiagramDocument(doc))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('文件校验失败：超链接协议不允许。')
  })

  it('文本超长拒绝', () => {
    const doc = makeValidDocument()
    doc.pages[0].nodes[0].text = createDefaultTextContent('汉'.repeat(MAX_TEXT_LENGTH + 1))
    const result = parseDiagramDocument(serializeDiagramDocument(doc))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('文件校验失败：文本内容超长。')
  })

  it('节点角度越界拒绝', () => {
    const doc = makeValidDocument()
    doc.pages[0].nodes[0].angle = 360
    const result = parseDiagramDocument(serializeDiagramDocument(doc))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('文件校验失败：节点角度无效。')
  })

  it('非法颜色拒绝', () => {
    const doc = makeValidDocument()
    doc.pages[0].nodes[0].style.fill = '红色'
    const result = parseDiagramDocument(serializeDiagramDocument(doc))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('文件校验失败：颜色值无效。')
  })

  it('顶层不是对象时按格式无效拒绝', () => {
    expect(parseDiagramDocument('"只是一段文本"')).toEqual({ ok: false, error: '文件格式无效，未打开文件。' })
    expect(parseDiagramDocument('[1,2,3]')).toEqual({ ok: false, error: '文件格式无效，未打开文件。' })
  })
})

describe('序列化与迁移', () => {
  it('序列化 → 解析往返相等（round-trip）', () => {
    const doc = makeValidDocument()
    const json = serializeDiagramDocument(doc)
    expect(json).toContain('\n  "schemaVersion"') // 2 空格缩进
    const result = parseDiagramDocument(json, portResolver)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.warnings).toEqual([])
    expect(result.document).toEqual(doc)
  })

  it('migrateDocument 对旧版顶层 nodes/edges 生成唯一前景页', () => {
    const legacy = JSON.parse(readFixture('legacy.flowdiagram')) as Record<string, unknown>
    const { document, warnings } = migrateDocument(legacy)
    expect(document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(Array.isArray(document.pages)).toBe(true)
    expect(document.nodes).toBeUndefined()
    expect(document.edges).toBeUndefined()
    expect(warnings).toEqual(['已从旧版本迁移。'])
  })

  it('migrateDocument 对已有 pages 的文档原样返回且无警告', () => {
    const raw = JSON.parse(serializeDiagramDocument(makeValidDocument())) as Record<string, unknown>
    const { document, warnings } = migrateDocument(raw)
    expect(document).toEqual(raw)
    expect(warnings).toEqual([])
  })
})
