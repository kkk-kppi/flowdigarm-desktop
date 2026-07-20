import { createEmptyDocument, type DiagramDocument } from '@/domain/diagram'
import { serializeDiagramDocument } from '@/domain/document-schema'
import type { DiagramFileRepository } from '@/application/persistence/persistence-ports'
import { openDiagram, openRecentDiagram, saveDiagram } from '@/application/persistence/document-file-use-cases'

function validDocument(): DiagramDocument {
  const document = createEmptyDocument('审批流程')
  document.id = 'doc-1'
  document.pages[0].id = 'page-1'
  return document
}

function repository(overrides: Partial<DiagramFileRepository> = {}): DiagramFileRepository {
  return {
    open: async () => null,
    read: async (path) => ({ path, json: serializeDiagramDocument(validDocument()) }),
    save: async ({ path }) => path ?? 'C:/docs/审批流程.flowdiagram',
    ...overrides,
  }
}

describe('document file use cases', () => {
  it('openDiagram 在选择取消时返回 null', async () => {
    await expect(openDiagram(repository())).resolves.toBeNull()
  })

  it('openDiagram 解析合法文件并返回路径、文档与警告', async () => {
    const result = await openDiagram(repository({
      open: async () => ({ path: 'C:/docs/a.flowdiagram', json: serializeDiagramDocument(validDocument()) }),
    }))
    expect(result).toMatchObject({ ok: true, path: 'C:/docs/a.flowdiagram' })
    if (result?.ok) expect(result.document.name).toBe('审批流程')
  })

  it.each([
    ['schema', '{"schemaVersion":0}'],
    ['geometry', () => {
      const document = validDocument()
      document.pages[0].pageSize.width = -1
      return JSON.stringify(document)
    }],
    ['URL', () => {
      const document = validDocument()
      document.pages[0].nodes.push({
        id: 'node-1', shape: 'rect', x: 0, y: 0, width: 10, height: 10, angle: 0, zIndex: 0,
        style: { fill: '#ffffff', fillOpacity: 1, stroke: '#000000', strokeWidth: 1 },
        link: 'javascript:alert(1)',
      })
      return JSON.stringify(document)
    }],
  ])('非法 %s 返回失败且不改调用方当前文档', async (_label, jsonValue) => {
    const current = validDocument()
    const before = structuredClone(current)
    const json = typeof jsonValue === 'function' ? jsonValue() : jsonValue
    const result = await openDiagram(repository({ open: async () => ({ path: 'C:/bad.flowdiagram', json }) }))
    expect(result).toMatchObject({ ok: false })
    expect(current).toEqual(before)
  })

  it('openRecentDiagram 复用同一解析流程', async () => {
    const result = await openRecentDiagram(repository(), 'C:/docs/recent.flowdiagram')
    expect(result).toMatchObject({ ok: true, path: 'C:/docs/recent.flowdiagram' })
  })

  it('saveDiagram 序列化文档并传递已有路径与建议名称', async () => {
    const calls: unknown[] = []
    const document = validDocument()
    const result = await saveDiagram(repository({
      save: async (input) => {
        calls.push(input)
        return input.path ?? null
      },
    }), document, 'C:/docs/a.flowdiagram')
    expect(result).toEqual({ ok: true, path: 'C:/docs/a.flowdiagram' })
    expect(calls).toEqual([{
      path: 'C:/docs/a.flowdiagram',
      suggestedName: '审批流程.flowdiagram',
      json: serializeDiagramDocument(document),
    }])
  })

  it('保存取消或失败返回中文结果且不修改文档', async () => {
    const document = validDocument()
    const before = structuredClone(document)
    await expect(saveDiagram(repository({ save: async () => null }), document)).resolves.toEqual({ ok: false, error: '已取消保存。' })
    await expect(saveDiagram(repository({ save: async () => { throw new Error('disk') } }), document)).resolves.toEqual({ ok: false, error: '保存文件失败，原文件未被覆盖。' })
    expect(document).toEqual(before)
  })
})
