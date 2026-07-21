import { ExportController } from '@/application/export/export-controller'
import type { DiagramExporter, NativeExportRequest } from '@/application/export/export-ports'
import { parseDiagramDocument } from '@/domain/document-schema'
import { createEmptyPage } from '@/domain/diagram'
import { createTestDocument } from '../../../helpers/test-document'

function setup() {
  const document = createTestDocument()
  const pageId = '10000000-0000-4000-8000-000000000001'
  const nodeIds = [
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
  ]
  const edgeIds = [
    '10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000006',
  ]
  document.id = '10000000-0000-4000-8000-000000000000'
  document.pages[0].id = pageId
  document.pages[0].nodes.forEach((node, index) => { node.id = nodeIds[index] })
  document.pages[0].edges.forEach((edge, index) => {
    edge.id = edgeIds[index]
    edge.source.nodeId = nodeIds[index]
    edge.target.nodeId = nodeIds[index + 1]
  })
  document.pages.push(createEmptyPage({ id: '10000000-0000-4000-8000-000000000007', name: '非法<>页/二' }))
  const requests: NativeExportRequest[] = []
  const exporter: DiagramExporter = {
    chooseDestination: vi.fn(async () => 'C:/exports/流程.svg'),
    export: vi.fn(async (request) => { requests.push(request); return ['C:/exports/流程.svg'] }),
  }
  const state = { document, activePageId: pageId, revision: 7, dirty: true }
  const controller = new ExportController({ snapshot: () => state }, exporter)
  return { controller, exporter, requests, state }
}

describe('ExportController', () => {
  it('sanitizes names and builds all-page semantic payloads without mutating state', async () => {
    const { controller, requests, state } = setup()
    const before = structuredClone(state)

    await expect(controller.export({
      format: 'svg', scope: 'allPages', fileName: '报表<>:"/\\|?*', destination: 'C:/exports/报表.svg',
    })).resolves.toEqual(['C:/exports/流程.svg'])

    expect(requests[0]).toMatchObject({ format: 'svg', scope: 'allPages', fileName: '报表', path: 'C:/exports/报表.svg' })
    expect(requests[0].pages.map((page) => page.name)).toEqual(['流程页', '非法页二'])
    expect(requests[0].pages).toHaveLength(2)
    expect(state).toEqual(before)
  })

  it('uses one JSON payload and leaves document, revision, and dirty unchanged', async () => {
    const { controller, requests, state } = setup()
    const documentIdentity = state.document
    await controller.export({ format: 'json', scope: 'allPages', fileName: 'backup', destination: 'C:/backup.flowdiagram' })
    expect(requests[0].pages).toEqual([])
    expect(JSON.parse(requests[0].documentJson ?? '')).toEqual(state.document)
    expect(state.document).toBe(documentIdentity)
    expect(state.revision).toBe(7)
    expect(state.dirty).toBe(true)
  })

  it('serializes the active page with its complete background chain from oldest to foreground', async () => {
    const { controller, requests, state } = setup()
    const oldest = createEmptyPage({ id: '20000000-0000-4000-8000-000000000001', name: '最旧背景', type: 'background' })
    const middle = createEmptyPage({ id: '20000000-0000-4000-8000-000000000002', name: '中间背景', type: 'background', backgroundPageId: oldest.id })
    const direct = createEmptyPage({ id: '20000000-0000-4000-8000-000000000003', name: '直接背景', type: 'background', backgroundPageId: middle.id })
    state.document.pages.unshift(direct, oldest, middle)
    state.document.pages.find(({ id }) => id === state.activePageId)!.backgroundPageId = direct.id

    await controller.export({
      format: 'json', scope: 'currentPage', fileName: 'page', destination: 'C:/page.flowdiagram',
    })

    const json = requests[0].documentJson ?? ''
    const serialized = JSON.parse(json)
    expect(serialized.pages.map(({ id }: { id: string }) => id)).toEqual([
      oldest.id, middle.id, direct.id, state.activePageId,
    ])
    expect(serialized.pages[1].backgroundPageId).toBe(oldest.id)
    expect(serialized.pages[2].backgroundPageId).toBe(middle.id)
    expect(serialized.pages[3].backgroundPageId).toBe(direct.id)
    expect(parseDiagramDocument(json).ok).toBe(true)
  })

  it.each([72, 97, 600])('rejects unsupported PNG DPI %s before native export', async (dpi) => {
    const { controller, exporter } = setup()
    await expect(controller.export({ format: 'png', scope: 'currentPage', fileName: 'x', destination: 'C:/x.png', dpi })).rejects.toThrow('PNG DPI 仅支持 96、150 或 300。')
    expect(exporter.export).not.toHaveBeenCalled()
  })

  it('validates format, scope, filename, destination, and wraps native failures', async () => {
    const { controller, exporter } = setup()
    await expect(controller.export({ format: 'svg', scope: 'currentPage', fileName: '<>*', destination: 'C:/x.svg' })).rejects.toThrow('文件名不能为空。')
    await expect(controller.export({ format: 'svg', scope: 'currentPage', fileName: 'x', destination: '' })).rejects.toThrow('请选择保存位置。')
    vi.mocked(exporter.export).mockRejectedValueOnce('磁盘已满。')
    await expect(controller.export({ format: 'pdf', scope: 'allPages', fileName: 'x', destination: 'C:/x.pdf' })).rejects.toThrow('导出失败，当前文档未受影响：磁盘已满。')
  })

  it('returns picker cancellation unchanged and guards concurrent exports', async () => {
    const { controller, exporter, state } = setup()
    vi.mocked(exporter.chooseDestination).mockResolvedValueOnce(null)
    const before = structuredClone(state)
    await expect(controller.chooseDestination({ format: 'png', fileName: '流程' })).resolves.toBeNull()
    expect(state).toEqual(before)

    let finish!: (paths: string[]) => void
    vi.mocked(exporter.export).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const first = controller.export({ format: 'png', scope: 'currentPage', fileName: 'x', destination: 'C:/x.png', dpi: 150 })
    await expect(controller.export({ format: 'png', scope: 'currentPage', fileName: 'x', destination: 'C:/x.png', dpi: 150 })).rejects.toThrow('正在导出，请稍候。')
    finish(['C:/x.png'])
    await expect(first).resolves.toEqual(['C:/x.png'])
  })
})
