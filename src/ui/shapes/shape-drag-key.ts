// src/ui/shapes/shape-drag-key.ts
// 图元库拖拽起点注入键：App 提供（转发到 CanvasArea 的 X6 Dnd），ElementLibrary 注入调用。
// 选用 X6 Dnd 而非 HTML5 drag：Dnd 在画布内渲染与目标形状一致的拖拽预览，
// 落点即文档 pt 坐标，无需自行处理坐标换算与 dragover 反馈。
import type { InjectionKey } from 'vue'

export type ShapeDragStarter = (shapeType: string, e: MouseEvent) => void

export const shapeDragStartKey: InjectionKey<ShapeDragStarter> = Symbol('shapeDragStart')
