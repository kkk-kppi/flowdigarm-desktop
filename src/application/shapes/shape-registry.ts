// src/application/shapes/shape-registry.ts
// 形状定义与注册表：形状元数据（几何/端口/默认样式/文本区）与按类型查询。
// 纯 TypeScript，不依赖 Vue/X6；内置形状的注册见 common-shapes.ts。
import type { NodeStyle } from '@/domain/diagram'

/** 端口定义：位于形状未旋转 bbox 的某条边中点。 */
export interface PortDef {
  id: string
  position: 'top' | 'right' | 'bottom' | 'left'
}

export interface ShapeDefinition {
  type: string
  label: string // 中文形状名
  category: 'basic' | 'flowchart' | 'text' | 'image'
  /**
   * 主体几何：rect/ellipse 直接映射 SVG 标签；path 采用「100×100 单位正方形」约定——
   * path 字符串以 0..100 坐标描述形状轮廓，渲染时按节点 bbox 缩放（X6 侧经 refD 实现，
   * 缩略图经 SVG viewBox 实现）。
   */
  body: { markup: 'rect' | 'ellipse' | 'path'; path?: string; roundedRadius?: number }
  defaultSize: { width: number; height: number } // pt
  minSize: { width: number; height: number } // pt
  ports: PortDef[]
  /** 文本区内缩 pt：菱形用更大内缩（安全内接区域），其余默认 4pt。 */
  textAreaInset: { top: number; right: number; bottom: number; left: number }
  defaultStyle: NodeStyle
  isContainer: boolean
  keepAspectOnShiftResize: boolean
}

export class ShapeRegistry {
  private readonly definitions = new Map<string, ShapeDefinition>()

  register(def: ShapeDefinition): void {
    this.definitions.set(def.type, def)
  }

  get(type: string): ShapeDefinition {
    const def = this.definitions.get(type)
    if (!def) {
      throw new Error(`未知形状类型：${type}`)
    }
    return def
  }

  has(type: string): boolean {
    return this.definitions.has(type)
  }

  all(): ShapeDefinition[] {
    return [...this.definitions.values()]
  }

  byCategory(cat: 'basic' | 'flowchart'): ShapeDefinition[] {
    return this.all().filter((def) => def.category === cat)
  }

  portIds(type: string): string[] {
    return this.get(type).ports.map((port) => port.id)
  }
}

/** 全局形状注册表单例。 */
export const shapeRegistry: ShapeRegistry = new ShapeRegistry()
