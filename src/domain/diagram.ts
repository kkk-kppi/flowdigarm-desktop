// src/domain/diagram.ts
// .flowdiagram 文档领域模型：全部长度单位为 pt，纯类型与工厂，禁止依赖 UI/Tauri/X6。

import type { Unit } from './measurement'
import { paperSizeFor, type PaperPreset } from './paper-presets'

export const CURRENT_SCHEMA_VERSION = 1

export type PageUnit = Unit
export type PageType = 'foreground' | 'background'
export type Orientation = 'portrait' | 'landscape'
export type ConnectorKind = 'straight' | 'orthogonal' | 'curved'

export interface DiagramDocument { schemaVersion: number; id: string; name: string; pages: DiagramPage[] }

export interface DiagramPage {
  id: string; name: string; type: PageType; backgroundPageId?: string
  unit: PageUnit
  pageSize: { preset?: PaperPreset; width: number; height: number } // pt
  orientation: Orientation
  defaultConnector: ConnectorKind
  defaultArrow: 'none' | 'single' | 'double'
  autoConnectLabel: boolean
  showLineJumps: boolean
  canvas: { gridSize: number; background: string }
  nodes: DiagramNode[]; edges: DiagramEdge[]
}

export interface DiagramNode {
  id: string; shape: string // ShapeDefinition.type，如 'rect'/'process'
  x: number; y: number; width: number; height: number // pt
  angle: number // 0–359.999
  zIndex: number
  text?: TextContent
  style: NodeStyle
  link?: string
  data?: Record<string, unknown> // 可扩展业务数据
  parentId?: string // 组合/容器成员
  isContainer?: boolean
  imageHref?: string // 图片节点 data URL 或安全 URL
}

export interface NodeStyle {
  fill: string; fillOpacity: number
  stroke: string; strokeWidth: number; strokeDash?: 'solid' | 'dash' | 'dot' | 'dashdot'
  cornerRadius?: number
  shadow?: { color: string; opacity: number; offsetX: number; offsetY: number; blur: number }
}

export interface DiagramEdge {
  id: string
  source: { nodeId: string; port?: string }; target: { nodeId: string; port?: string }
  connector: ConnectorKind
  vertices: { x: number; y: number }[] // 手工拐点 pt
  labels: EdgeLabel[]
  style: EdgeStyle
  link?: string
  zIndex: number
}

export interface EdgeLabel { text: TextContent; position: number } // position 0..1

export interface EdgeStyle {
  stroke: string; strokeWidth: number; opacity: number
  dash: 'solid' | 'dash' | 'dot' | 'dashdot'
  sourceArrow: 'none' | 'arrow'; targetArrow: 'none' | 'arrow'
}

export interface TextStyle { fontFamily: string; fontSize: number; bold: boolean; italic: boolean; underline: boolean; strikethrough: boolean; color: string; background?: string }

export interface TextBlock { horizontalAlign: 'left' | 'center' | 'right'; verticalAlign: 'top' | 'middle' | 'bottom'; direction: 'horizontal' | 'vertical'; marginTop: number; marginRight: number; marginBottom: number; marginLeft: number }

export interface TextParagraph { before: number; after: number; lineHeight: number }

export interface TextContent { value: string; style: TextStyle; block: TextBlock; paragraph: TextParagraph }

export function createDefaultTextContent(value = ''): TextContent {
  return {
    value,
    style: {
      fontFamily: '微软雅黑',
      fontSize: 12,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      color: '#000000',
    },
    block: {
      horizontalAlign: 'center',
      verticalAlign: 'middle',
      direction: 'horizontal',
      marginTop: 4,
      marginRight: 4,
      marginBottom: 4,
      marginLeft: 4,
    },
    paragraph: { before: 0, after: 0, lineHeight: 1.2 },
  }
}

export function createDefaultNodeStyle(): NodeStyle {
  return {
    fill: '#FFFFFF',
    fillOpacity: 1,
    stroke: '#000000',
    strokeWidth: 1,
  }
}

export function createDefaultEdgeStyle(): EdgeStyle {
  return {
    stroke: '#666666',
    strokeWidth: 1,
    opacity: 1,
    dash: 'solid',
    sourceArrow: 'none',
    targetArrow: 'arrow',
  }
}

export function createEmptyPage(partial: Partial<DiagramPage> = {}): DiagramPage {
  const a4 = paperSizeFor('a4')
  return {
    id: crypto.randomUUID(),
    name: '页面 1',
    type: 'foreground',
    unit: 'mm',
    pageSize: { preset: 'a4', width: a4.width, height: a4.height },
    orientation: 'portrait',
    defaultConnector: 'orthogonal',
    defaultArrow: 'single',
    autoConnectLabel: true,
    showLineJumps: false,
    canvas: { gridSize: 10, background: '#FFFFFF' },
    nodes: [],
    edges: [],
    ...partial,
  }
}

export function createEmptyDocument(name = '未命名流程图'): DiagramDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name,
    pages: [createEmptyPage()],
  }
}
