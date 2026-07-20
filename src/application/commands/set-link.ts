// src/application/commands/set-link.ts
// 设置链接命令：节点/边链接的设置与清除（空串归一化为 undefined 表示无链接）。
// apply 时 after 非空且协议非法抛「仅支持 http、https、mailto 链接。」（详细设计 §16/§17）。
import type { DiagramDocument } from '@/domain/diagram'
import { isAllowedHyperlinkProtocol } from '@/domain/validators'
import type { EditorCommand } from './editor-command'

export type LinkTarget = { kind: 'node' | 'edge'; cellId: string }

export interface SetLinkInput {
  pageId: string
  target: LinkTarget
  before: string | undefined
  after: string | undefined
}

/** 空串归一化为 undefined（无链接）。 */
function normalize(url: string | undefined): string | undefined {
  return url === '' || url === undefined ? undefined : url
}

export class SetLinkCommand implements EditorCommand {
  readonly id = crypto.randomUUID()
  readonly label = '设置链接'
  private readonly input: SetLinkInput

  constructor(input: SetLinkInput) {
    this.input = { ...input, target: { ...input.target } }
  }

  apply(document: DiagramDocument): DiagramDocument {
    const after = normalize(this.input.after)
    if (after !== undefined && !isAllowedHyperlinkProtocol(after)) {
      throw new Error('仅支持 http、https、mailto 链接。')
    }
    return this.write(document, after)
  }

  revert(document: DiagramDocument): DiagramDocument {
    return this.write(document, normalize(this.input.before))
  }

  private write(document: DiagramDocument, link: string | undefined): DiagramDocument {
    const { pageId, target } = this.input
    const page = document.pages.find((p) => p.id === pageId)
    const exists =
      target.kind === 'node'
        ? page?.nodes.some((n) => n.id === target.cellId)
        : page?.edges.some((e) => e.id === target.cellId)
    if (!exists) {
      throw new Error('命令目标不存在。')
    }
    return {
      ...document,
      pages: document.pages.map((p) => {
        if (p.id !== pageId) return p
        return target.kind === 'node'
          ? {
              ...p,
              nodes: p.nodes.map((node) =>
                node.id === target.cellId ? { ...node, link } : node,
              ),
            }
          : {
              ...p,
              edges: p.edges.map((edge) =>
                edge.id === target.cellId ? { ...edge, link } : edge,
              ),
            }
      }),
    }
  }
}
