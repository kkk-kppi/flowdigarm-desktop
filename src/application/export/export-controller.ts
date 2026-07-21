import { resolvePageBackgroundChain } from '@/application/pages/page-background-chain'
import { serializeDiagramDocument, serializeValidatedDiagramDocument, type DocumentValidationContext } from '@/domain/document-schema'
import type { DiagramDocument } from '@/domain/diagram'
import { renderPageSvg } from '@/infrastructure/export/svg-export'
import type {
  DiagramExporter,
  ExportFormat,
  ExportOptions,
  ExportScope,
  NativeExportRequest,
} from './export-ports'

interface ExportSnapshot {
  document: DiagramDocument
  activePageId: string
}

interface ExportSource {
  snapshot(): ExportSnapshot
}

const extensions: Record<ExportFormat, string> = {
  svg: 'svg', png: 'png', pdf: 'pdf', json: 'flowdiagram',
}

export function sanitizeExportName(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, '').replace(/[. ]+$/g, '').trim()
}

function assertFormat(value: string): asserts value is ExportFormat {
  if (!['svg', 'png', 'pdf', 'json'].includes(value)) throw new Error('导出格式无效。')
}

function assertScope(value: string): asserts value is ExportScope {
  if (!['currentPage', 'allPages'].includes(value)) throw new Error('导出范围无效。')
}

function reason(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' && error ? error : '未知错误。'
}

export class ExportController {
  private busy = false

  constructor(
    private readonly source: ExportSource,
    private readonly exporter: DiagramExporter,
    private readonly validationContext?: DocumentValidationContext,
  ) {}

  get isBusy(): boolean {
    return this.busy
  }

  async chooseDestination(input: { format: ExportFormat; fileName: string }): Promise<string | null> {
    assertFormat(input.format)
    const fileName = sanitizeExportName(input.fileName)
    if (!fileName) throw new Error('文件名不能为空。')
    return this.exporter.chooseDestination({
      format: input.format,
      suggestedName: `${fileName}.${extensions[input.format]}`,
    })
  }

  async export(options: ExportOptions): Promise<string[]> {
    if (this.busy) throw new Error('正在导出，请稍候。')
    assertFormat(options.format)
    assertScope(options.scope)
    const fileName = sanitizeExportName(options.fileName)
    if (!fileName) throw new Error('文件名不能为空。')
    if (!options.destination.trim()) throw new Error('请选择保存位置。')
    if (options.format === 'png' && ![96, 150, 300].includes(options.dpi ?? 0)) {
      throw new Error('PNG DPI 仅支持 96、150 或 300。')
    }
    this.busy = true
    try {
      const snapshot = structuredClone(this.source.snapshot())
      const pages = options.scope === 'currentPage'
        ? snapshot.document.pages.filter(({ id }) => id === snapshot.activePageId)
        : snapshot.document.pages
      if (pages.length === 0) throw new Error('导出页面不存在。')
      const activePage = pages[0]
      const jsonDocument = options.scope === 'currentPage'
        ? {
            ...snapshot.document,
            pages: resolvePageBackgroundChain(snapshot.document, activePage.id),
          }
        : snapshot.document
      const request: NativeExportRequest = {
        format: options.format,
        scope: options.scope,
        fileName,
        path: options.destination,
        dpi: options.format === 'png' ? options.dpi : undefined,
        pages: options.format === 'json' ? [] : pages.map((page) => {
          const rendered = renderPageSvg(snapshot.document, page.id)
          return {
            name: sanitizeExportName(page.name) || '页面',
            widthPt: page.pageSize.width,
            heightPt: page.pageSize.height,
            ...rendered,
          }
        }),
        documentJson: options.format === 'json'
          ? this.validatedJson(jsonDocument)
          : undefined,
      }
      try {
        return await this.exporter.export(request)
      } catch (error) {
        throw new Error(`导出失败，当前文档未受影响：${reason(error)}`)
      }
    } finally {
      this.busy = false
    }
  }

  private validatedJson(document: DiagramDocument): string {
    if (!this.validationContext) return serializeDiagramDocument(document)
    const result = serializeValidatedDiagramDocument(document, this.validationContext)
    if (!result.ok) throw new Error(`文档校验失败，未导出：${result.error}`)
    return result.json
  }
}
