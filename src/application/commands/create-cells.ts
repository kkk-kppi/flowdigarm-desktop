// src/application/commands/create-cells.ts
// 创建图元命令：一次拖入/粘贴的全部节点与边合并为一条命令（撤销边界：一次创建一条记录）。
// zIndex：自带 zIndex 的图元尊重原值且不消耗递增序号；其余按「页面现有最大 zIndex + 1」
// 依次递增（先节点数组、后边数组，顺序即入参顺序）。构造时深拷贝入参，命令自含快照。
import type { DiagramDocument, DiagramEdge, DiagramNode } from '@/domain/diagram'
import type { EditorCommand } from './editor-command'

/** 新建图元：zIndex 可缺省（由命令按页面现有最大递增分配）。 */
export type NewCell<T extends { zIndex: number }> = Omit<T, 'zIndex'> & { zIndex?: number }

export interface CreateCellsInput {
  pageId: string
  nodes?: NewCell<DiagramNode>[]
  edges?: NewCell<DiagramEdge>[]
  /** 撤销/重做菜单提示；默认「创建图元」，粘贴时传「粘贴图元」。 */
  label?: string
}

export class CreateCellsCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label: string
  private readonly pageId: string
  private readonly nodes: NewCell<DiagramNode>[]
  private readonly edges: NewCell<DiagramEdge>[]

  constructor(input: CreateCellsInput) {
    this.pageId = input.pageId
    this.nodes = structuredClone(input.nodes ?? [])
    this.edges = structuredClone(input.edges ?? [])
    this.label = input.label ?? '创建图元'
  }

  apply(document: DiagramDocument): DiagramDocument {
    const page = this.requirePage(document)
    // 递增序号只基于页面现有最大 zIndex；新图元自带 zIndex 不影响序号
    let nextZ =
      Math.max(-1, ...page.nodes.map((n) => n.zIndex), ...page.edges.map((e) => e.zIndex)) + 1
    const assignZ = <T extends { zIndex?: number }>(cell: T): T & { zIndex: number } => {
      if (cell.zIndex !== undefined) {
        return cell as T & { zIndex: number }
      }
      return { ...cell, zIndex: nextZ++ }
    }
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.pageId
          ? {
              ...p,
              nodes: [...p.nodes, ...this.nodes.map((n) => assignZ(structuredClone(n)))],
              edges: [...p.edges, ...this.edges.map((e) => assignZ(structuredClone(e)))],
            }
          : p,
      ),
    }
  }

  revert(document: DiagramDocument): DiagramDocument {
    this.requirePage(document)
    const nodeIds = new Set(this.nodes.map((n) => n.id))
    const edgeIds = new Set(this.edges.map((e) => e.id))
    return {
      ...document,
      pages: document.pages.map((p) =>
        p.id === this.pageId
          ? {
              ...p,
              nodes: p.nodes.filter((n) => !nodeIds.has(n.id)),
              edges: p.edges.filter((e) => !edgeIds.has(e.id)),
            }
          : p,
      ),
    }
  }

  private requirePage(document: DiagramDocument) {
    const page = document.pages.find((p) => p.id === this.pageId)
    if (!page) {
      throw new Error('命令目标不存在。')
    }
    return page
  }
}
