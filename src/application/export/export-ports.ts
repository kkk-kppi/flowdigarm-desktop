export type ExportFormat = 'svg' | 'png' | 'pdf' | 'json'
export type ExportScope = 'currentPage' | 'allPages'
export type ExportDpi = 96 | 150 | 300

export interface ExportLinkAnnotation {
  url: string
  xPt: number
  yPt: number
  widthPt: number
  heightPt: number
}

export interface ExportPagePayload {
  name: string
  widthPt: number
  heightPt: number
  svg: string
  links: ExportLinkAnnotation[]
}

export interface NativeExportRequest {
  format: ExportFormat
  scope: ExportScope
  fileName: string
  path: string
  dpi?: number
  pages: ExportPagePayload[]
  documentJson?: string
}

export interface DiagramExporter {
  chooseDestination(input: { format: ExportFormat; suggestedName: string }): Promise<string | null>
  export(input: NativeExportRequest): Promise<string[]>
}

export interface ExportOptions {
  format: ExportFormat
  scope: ExportScope
  fileName: string
  destination: string
  dpi?: number
}
