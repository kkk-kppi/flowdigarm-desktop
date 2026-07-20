// tests/unit/editor/shapes/shape-registry.test.ts
// 形状注册表与内置形状：14 个形状注册齐全、必填字段非空、分类数量、未知类型抛错、端口四个。
import '@/application/shapes/common-shapes'
import { ShapeRegistry, shapeRegistry } from '@/application/shapes/shape-registry'

const ALL_TYPES = [
  'rect',
  'rounded-rect',
  'circle',
  'ellipse',
  'triangle',
  'diamond',
  'process',
  'decision',
  'terminator',
  'subprocess',
  'document',
  'data',
  'text',
  'image',
] as const

describe('内置形状注册', () => {
  it('14 个内置形状全部注册（另有 Task 7 组合容器形状 group）', () => {
    expect(shapeRegistry.all()).toHaveLength(15)
    for (const type of ALL_TYPES) {
      expect(shapeRegistry.has(type), `形状 ${type} 应已注册`).toBe(true)
    }
    expect(shapeRegistry.has('group')).toBe(true)
  })

  it('中文标签逐字正确', () => {
    const labels: Record<string, string> = {
      rect: '矩形',
      'rounded-rect': '圆角矩形',
      circle: '圆形',
      ellipse: '椭圆',
      triangle: '三角形',
      diamond: '菱形',
      process: '流程',
      decision: '判定',
      terminator: '终止',
      subprocess: '子流程',
      document: '文档',
      data: '数据流',
      text: '文本框',
      image: '图片',
    }
    for (const [type, label] of Object.entries(labels)) {
      expect(shapeRegistry.get(type).label).toBe(label)
    }
  })

  it('必填字段非空：type/label/category/body/defaultSize/minSize/textAreaInset/defaultStyle', () => {
    for (const def of shapeRegistry.all()) {
      expect(def.type).toBeTruthy()
      expect(def.label).toBeTruthy()
      expect(def.category).toBeTruthy()
      expect(def.body.markup).toBeTruthy()
      expect(def.defaultSize.width).toBeGreaterThan(0)
      expect(def.defaultSize.height).toBeGreaterThan(0)
      expect(def.minSize.width).toBeGreaterThan(0)
      expect(def.minSize.height).toBeGreaterThan(0)
      expect(def.textAreaInset).toBeTruthy()
      expect(def.defaultStyle).toBeTruthy()
    }
  })

  it('基本形状 6 个、流程图 6 个；默认尺寸 120×72 / 140×72', () => {
    const basics = shapeRegistry.byCategory('basic')
    const flowcharts = shapeRegistry.byCategory('flowchart')
    expect(basics.map((d) => d.type)).toEqual([
      'rect',
      'rounded-rect',
      'circle',
      'ellipse',
      'triangle',
      'diamond',
    ])
    expect(flowcharts.map((d) => d.type)).toEqual([
      'process',
      'decision',
      'terminator',
      'subprocess',
      'document',
      'data',
    ])
    for (const def of basics) {
      expect(def.defaultSize).toEqual({ width: 120, height: 72 })
    }
    for (const def of flowcharts) {
      expect(def.defaultSize).toEqual({ width: 140, height: 72 })
    }
  })

  it('分类归属：text 为 text、image 为 image', () => {
    expect(shapeRegistry.get('text').category).toBe('text')
    expect(shapeRegistry.get('image').category).toBe('image')
  })

  it('最小尺寸：文本框 24×20、图片 24×24、其余 36×24', () => {
    expect(shapeRegistry.get('text').minSize).toEqual({ width: 24, height: 20 })
    expect(shapeRegistry.get('image').minSize).toEqual({ width: 24, height: 24 })
    for (const def of shapeRegistry.all()) {
      if (def.type === 'text' || def.type === 'image') continue
      expect(def.minSize, `形状 ${def.type} 最小尺寸`).toEqual({ width: 36, height: 24 })
    }
  })

  it('Shift 等比缩放：图片与椭圆为 true，其余为 false', () => {
    expect(shapeRegistry.get('image').keepAspectOnShiftResize).toBe(true)
    expect(shapeRegistry.get('ellipse').keepAspectOnShiftResize).toBe(true)
    expect(shapeRegistry.get('rect').keepAspectOnShiftResize).toBe(false)
    expect(shapeRegistry.get('text').keepAspectOnShiftResize).toBe(false)
  })

  it('文本框默认样式透明：填充不透明度 0、描边线宽 0', () => {
    const style = shapeRegistry.get('text').defaultStyle
    expect(style.fillOpacity).toBe(0)
    expect(style.strokeWidth).toBe(0)
  })

  it('菱形文本区内缩约为宽高 25%，其他形状默认 4pt', () => {
    const diamond = shapeRegistry.get('diamond')
    expect(diamond.textAreaInset.left).toBe(120 * 0.25)
    expect(diamond.textAreaInset.right).toBe(120 * 0.25)
    expect(diamond.textAreaInset.top).toBe(72 * 0.25)
    expect(diamond.textAreaInset.bottom).toBe(72 * 0.25)
    const decision = shapeRegistry.get('decision')
    expect(decision.textAreaInset.left).toBe(140 * 0.25)
    expect(decision.textAreaInset.top).toBe(72 * 0.25)
    const rect = shapeRegistry.get('rect')
    expect(rect.textAreaInset).toEqual({ top: 4, right: 4, bottom: 4, left: 4 })
  })

  it('path 形状必须携带单位正方形路径；path 坐标不超出 0..100', () => {
    for (const def of shapeRegistry.all()) {
      if (def.body.markup === 'path') {
        expect(def.body.path, `形状 ${def.type} 应定义 path`).toBeTruthy()
        const numbers = def.body.path!.match(/-?\d+(\.\d+)?/g)!.map(Number)
        for (const n of numbers) {
          expect(n, `形状 ${def.type} path 坐标 ${n} 应在 0..100`).toBeGreaterThanOrEqual(0)
          expect(n, `形状 ${def.type} path 坐标 ${n} 应在 0..100`).toBeLessThanOrEqual(100)
        }
      }
    }
  })

  it('portIds 返回上/右/下/左四个端口（group 容器无端口）', () => {
    for (const def of shapeRegistry.all()) {
      if (def.type === 'group') {
        expect(shapeRegistry.portIds(def.type)).toEqual([])
        continue
      }
      expect(shapeRegistry.portIds(def.type), `形状 ${def.type} 端口`).toEqual([
        'top',
        'right',
        'bottom',
        'left',
      ])
    }
  })

  it('未知形状类型抛「未知形状类型：xxx」', () => {
    expect(() => shapeRegistry.get('不存在的形状')).toThrow('未知形状类型：不存在的形状')
  })
})

describe('ShapeRegistry 单元行为', () => {
  it('register/get/has/all/byCategory/portIds 基本行为', () => {
    const registry = new ShapeRegistry()
    expect(registry.has('rect')).toBe(false)
    registry.register({
      type: 'rect',
      label: '矩形',
      category: 'basic',
      body: { markup: 'rect' },
      defaultSize: { width: 120, height: 72 },
      minSize: { width: 36, height: 24 },
      ports: [
        { id: 'top', position: 'top' },
        { id: 'right', position: 'right' },
        { id: 'bottom', position: 'bottom' },
        { id: 'left', position: 'left' },
      ],
      textAreaInset: { top: 4, right: 4, bottom: 4, left: 4 },
      defaultStyle: {
        fill: '#FFFFFF',
        fillOpacity: 1,
        stroke: '#000000',
        strokeWidth: 1,
      },
      isContainer: false,
      keepAspectOnShiftResize: false,
    })
    expect(registry.has('rect')).toBe(true)
    expect(registry.get('rect').label).toBe('矩形')
    expect(registry.all()).toHaveLength(1)
    expect(registry.byCategory('basic')).toHaveLength(1)
    expect(registry.byCategory('flowchart')).toHaveLength(0)
    expect(registry.portIds('rect')).toEqual(['top', 'right', 'bottom', 'left'])
  })
})
