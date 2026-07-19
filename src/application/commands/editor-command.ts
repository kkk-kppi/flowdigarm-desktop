// src/application/commands/editor-command.ts
// 用户行为级命令接口：命令输入与快照使用不可变领域对象；
// 不得引用 Vue ref、DOM 或 X6 Cell；apply/revert 不得修改入参文档（返回新对象，可结构共享）。
import type { DiagramDocument } from '@/domain/diagram'

export interface EditorCommand {
  id: string
  label: string // 中文，用于撤销/重做菜单提示，如 '移动图元'
  apply(document: DiagramDocument): DiagramDocument
  revert(document: DiagramDocument): DiagramDocument
}
