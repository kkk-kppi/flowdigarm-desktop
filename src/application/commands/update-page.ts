// src/application/commands/update-page.ts
// 页面设置命令：右侧"页面设置"标签页一次"应用"的全部修改聚合为一条撤销记录。
// apply/revert 只写页面设置字段，禁止触碰 nodes/edges 与任何几何（单位切换 pt 几何严格不变）；
// 方向切换的宽高交换由调用方在 after.pageSize 中算好，命令只写值。
import type {
  ConnectorKind,
  DiagramDocument,
  DiagramPage,
  Orientation,
  PageUnit,
} from '@/domain/diagram'
import type { PaperPreset } from '@/domain/paper-presets'
import { findBackgroundPageCycle } from '@/domain/validators'
import type { EditorCommand } from './editor-command'

export interface PageSettingsSnapshot {
  pageSize: { preset?: PaperPreset; width: number; height: number }
  orientation: Orientation
  unit: PageUnit
  defaultConnector: ConnectorKind
  defaultArrow: 'none' | 'single' | 'double'
  autoConnectLabel: boolean
  showLineJumps: boolean
  background: string
  backgroundPageId?: string
}

/** 从页面读取当前设置快照（调用方以此构造命令的 before）。 */
export function pageSettingsSnapshotOf(page: DiagramPage): PageSettingsSnapshot {
  return {
    pageSize: { ...page.pageSize },
    orientation: page.orientation,
    unit: page.unit,
    defaultConnector: page.defaultConnector,
    defaultArrow: page.defaultArrow,
    autoConnectLabel: page.autoConnectLabel,
    showLineJumps: page.showLineJumps,
    background: page.canvas.background,
    backgroundPageId: page.backgroundPageId,
  }
}

/** 两份设置快照逐字段相等性对比（无变化时调用方不应产生命令）。 */
export function pageSettingsEqual(a: PageSettingsSnapshot, b: PageSettingsSnapshot): boolean {
  return (
    a.pageSize.preset === b.pageSize.preset &&
    a.pageSize.width === b.pageSize.width &&
    a.pageSize.height === b.pageSize.height &&
    a.orientation === b.orientation &&
    a.unit === b.unit &&
    a.defaultConnector === b.defaultConnector &&
    a.defaultArrow === b.defaultArrow &&
    a.autoConnectLabel === b.autoConnectLabel &&
    a.showLineJumps === b.showLineJumps &&
    a.background === b.background &&
    a.backgroundPageId === b.backgroundPageId
  )
}

export class UpdatePageCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '页面设置'

  constructor(
    private readonly input: {
      pageId: string
      before: PageSettingsSnapshot
      after: PageSettingsSnapshot
    },
  ) {}

  apply(document: DiagramDocument): DiagramDocument {
    const page = document.pages.find((p) => p.id === this.input.pageId)
    if (!page) {
      throw new Error('命令目标不存在。')
    }
    const next: DiagramDocument = {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.input.pageId ? writeSettings(p, this.input.after) : p,
      ),
    }
    this.assertBackgroundValid(next)
    return next
  }

  revert(document: DiagramDocument): DiagramDocument {
    const page = document.pages.find((p) => p.id === this.input.pageId)
    if (!page) {
      throw new Error('命令目标不存在。')
    }
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.input.pageId ? writeSettings(p, this.input.before) : p,
      ),
    }
  }

  /** 背景页引用合法性：目标必须是已存在的背景页，且整链无循环。 */
  private assertBackgroundValid(next: DiagramDocument): void {
    const backgroundPageId = this.input.after.backgroundPageId
    if (backgroundPageId === undefined) {
      return
    }
    const target = next.pages.find((p) => p.id === backgroundPageId)
    if (!target || target.type !== 'background') {
      throw new Error('背景页设置无效。')
    }
    if (findBackgroundPageCycle(next) !== null) {
      throw new Error('背景页设置无效。')
    }
  }
}

/** 只写设置字段；nodes/edges/canvas.gridSize 等其余字段保持原引用。 */
function writeSettings(page: DiagramPage, settings: PageSettingsSnapshot): DiagramPage {
  return {
    ...page,
    pageSize: { ...settings.pageSize },
    orientation: settings.orientation,
    unit: settings.unit,
    defaultConnector: settings.defaultConnector,
    defaultArrow: settings.defaultArrow,
    autoConnectLabel: settings.autoConnectLabel,
    showLineJumps: settings.showLineJumps,
    canvas: { ...page.canvas, background: settings.background },
    backgroundPageId: settings.backgroundPageId,
  }
}
