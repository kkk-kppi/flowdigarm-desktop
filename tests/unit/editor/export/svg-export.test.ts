import { createDefaultTextContent, createEmptyDocument, createEmptyPage } from '@/domain/diagram'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes'
import { renderPageSvg } from '@/infrastructure/export/svg-export'
import { createTestEdge, createTestNode } from '../../../helpers/test-document'

describe('renderPageSvg', () => {
  it('renders exact pt page geometry, the complete background chain once, and every registered shape', () => {
    const oldest = createEmptyPage({
      id: 'oldest', name: '最旧背景', type: 'background',
      nodes: [createTestNode({ id: 'oldest-node', x: 1, y: 2, text: createDefaultTextContent('最旧层') })],
    })
    const middle = createEmptyPage({
      id: 'middle', name: '中间背景', type: 'background', backgroundPageId: oldest.id,
      nodes: [createTestNode({ id: 'middle-node', x: 2, y: 3, text: createDefaultTextContent('中间层') })],
    })
    const background = createEmptyPage({
      id: 'background', name: '背景', type: 'background', backgroundPageId: middle.id,
      nodes: [createTestNode({ id: 'bg', x: 3, y: 4, text: createDefaultTextContent('直接背景层') })],
    })
    const nodes = shapeRegistry.all().map((definition, index) => createTestNode({
      id: `shape-${definition.type}`,
      shape: definition.type,
      x: 10 + index * 5,
      y: 30 + index * 3,
      imageHref: definition.type === 'image' ? 'data:image/png;base64,iVBORw0KGgo=' : undefined,
      zIndex: index,
      text: createDefaultTextContent(definition.label),
    }))
    const page = createEmptyPage({
      id: 'foreground', name: '前景', backgroundPageId: background.id,
      pageSize: { width: 595.276, height: 841.89 }, nodes,
    })
    const document = { ...createEmptyDocument(), pages: [page, background, oldest, middle] }

    const result = renderPageSvg(document, page.id)

    expect(result.svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="595.276pt" height="841.89pt" viewBox="0 0 595.276 841.89">')
    expect(result.svg.indexOf('最旧层')).toBeLessThan(result.svg.indexOf('中间层'))
    expect(result.svg.indexOf('中间层')).toBeLessThan(result.svg.indexOf('直接背景层'))
    expect(result.svg.indexOf('直接背景层')).toBeLessThan(result.svg.indexOf('矩形'))
    expect(result.svg.match(/data-cell-id="oldest-node"/g)).toHaveLength(1)
    expect(result.svg.match(/data-cell-id="middle-node"/g)).toHaveLength(1)
    expect(result.svg.match(/data-cell-id="bg"/g)).toHaveLength(1)
    for (const definition of shapeRegistry.all()) {
      expect(result.svg).toContain(`data-cell-id="shape-${definition.type}"`)
    }
    expect(result.svg).not.toMatch(/grid|guide|selection|page-break|editor/i)
  })

  it('escapes XML, emits vertical tspans, safe links and annotations, but omits unsafe links and image URLs', () => {
    const vertical = createDefaultTextContent('<甲&乙>')
    vertical.block.direction = 'vertical'
    const page = createEmptyPage({
      id: 'page', name: 'P',
      nodes: [
        createTestNode({ id: 'safe', x: 10, y: 20, width: 80, height: 40, link: 'https://example.com/?a=1&b=2', text: vertical }),
        createTestNode({ id: 'unsafe', x: 1, y: 2, link: 'javascript:alert(1)' }),
        createTestNode({ id: 'remote-image', shape: 'image', x: 3, y: 4, imageHref: 'https://example.com/x.png' }),
      ],
    })
    const result = renderPageSvg({ ...createEmptyDocument(), pages: [page] }, page.id)

    expect(result.svg).toContain('<a href="https://example.com/?a=1&amp;b=2">')
    expect(result.svg).toContain('&lt;')
    expect(result.svg).toContain('&amp;')
    expect(result.svg.match(/<tspan/g)?.length).toBeGreaterThanOrEqual(5)
    expect(result.svg).not.toContain('javascript:')
    expect(result.svg).not.toContain('https://example.com/x.png')
    expect(result.links).toEqual([{ url: 'https://example.com/?a=1&b=2', xPt: 10, yPt: 20, widthPt: 80, heightPt: 40 }])
  })

  it('clips partially visible negative link annotations and omits wholly outside links', () => {
    const page = createEmptyPage({
      id: 'page', name: 'P', pageSize: { width: 100, height: 100 },
      nodes: [
        createTestNode({ id: 'partial', x: -10, y: -5, width: 30, height: 20, link: 'https://example.com/partial' }),
        createTestNode({ id: 'outside', x: -50, y: -50, width: 10, height: 10, link: 'https://example.com/outside' }),
      ],
    })

    expect(renderPageSvg({ ...createEmptyDocument(), pages: [page] }, page.id).links).toEqual([
      { url: 'https://example.com/partial', xPt: 0, yPt: 0, widthPt: 20, heightPt: 15 },
    ])
  })

  it('renders image nodes as only safe images and leaves invalid image bodies unpainted', () => {
    const imageText = createDefaultTextContent('不可渲染')
    imageText.style.background = '#ff0000'
    const page = createEmptyPage({
      id: 'page', name: 'P',
      nodes: [
        createTestNode({ id: 'safe-image', shape: 'image', imageHref: 'data:image/png;base64,iVBORw0KGgo=', text: imageText }),
        createTestNode({ id: 'bad-image', shape: 'image', x: 100, imageHref: 'file:///secret.png', text: imageText }),
        createTestNode({ id: 'missing-image', shape: 'image', x: 200, text: imageText }),
      ],
    })
    const { svg } = renderPageSvg({ ...createEmptyDocument(), pages: [page] }, page.id)
    const safe = svg.match(/<g data-cell-id="safe-image"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? ''
    const bad = svg.match(/<g data-cell-id="bad-image"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? ''
    const missing = svg.match(/<g data-cell-id="missing-image"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? ''

    expect(safe).toContain('<image ')
    expect(safe).not.toMatch(/<(?:rect|path|ellipse)\b/)
    expect(safe).not.toContain('<text')
    expect(bad).not.toMatch(/<(?:image|rect|path|ellipse)\b/)
    expect(bad).not.toContain('<text')
    expect(missing).not.toMatch(/<(?:image|rect|path|ellipse)\b/)
    expect(missing).not.toContain('<text')
  })

  it.each([
    ['horizontal', 'middle'], ['horizontal', 'bottom'],
    ['vertical', 'middle'], ['vertical', 'bottom'],
  ] as const)('keeps %s %s baselines inside the diamond text area', (direction, verticalAlign) => {
    const text = createDefaultTextContent(direction === 'vertical' ? '甲乙丙' : '甲\n乙\n丙')
    text.style.fontSize = 10
    text.paragraph = { before: 2, after: 3, lineHeight: 1.2 }
    text.block.direction = direction
    text.block.verticalAlign = verticalAlign
    const node = createTestNode({ id: `diamond-${direction}-${verticalAlign}`, shape: 'diamond', x: 10, y: 20, width: 120, height: 100, text })
    const page = createEmptyPage({ id: 'page', nodes: [node] })

    const { svg } = renderPageSvg({ ...createEmptyDocument(), pages: [page] }, page.id)
    const group = svg.match(new RegExp(`<g data-cell-id="diamond-${direction}-${verticalAlign}"[^>]*>([\\s\\S]*?)<\\/g>`))?.[1] ?? ''
    const baselines = [...group.matchAll(/<tspan[^>]* y="([\d.]+)"/g)].map((match) => Number(match[1]))
    const inset = shapeRegistry.get('diamond').textAreaInset
    const top = node.y + inset.top + text.block.marginTop + text.paragraph.before
    const bottom = node.y + node.height - inset.bottom - text.block.marginBottom - text.paragraph.after

    expect(baselines).toHaveLength(3)
    expect(baselines.every((baseline) => baseline >= top && baseline <= bottom)).toBe(true)
    if (verticalAlign === 'bottom') expect(baselines.at(-1)).toBe(bottom)
    else expect((baselines[0] - text.style.fontSize + baselines.at(-1)!) / 2).toBeCloseTo((top + bottom) / 2)
  })

  it('renders straight, orthogonal, and curved edge paths with vertices, dash, markers, opacity, labels, and z-order', () => {
    const nodes = [
      createTestNode({ id: 'a', x: 10, y: 10, zIndex: 2 }),
      createTestNode({ id: 'b', x: 210, y: 110, zIndex: 3 }),
    ]
    const label = createDefaultTextContent('边<&>')
    const edges = [
      createTestEdge({ id: 'straight', connector: 'straight', zIndex: -3 }),
      createTestEdge({ id: 'orthogonal', connector: 'orthogonal', vertices: [{ x: 80, y: 70 }], zIndex: -2 }),
      createTestEdge({
        id: 'curved', connector: 'curved', vertices: [{ x: 100, y: 30 }, { x: 150, y: 90 }],
        labels: [{ text: label, position: 0.5 }], zIndex: -1,
        style: { stroke: '#123456', strokeWidth: 2, opacity: 0.4, dash: 'dashdot', sourceArrow: 'arrow', targetArrow: 'arrow' },
      }),
    ]
    const page = createEmptyPage({ id: 'page', nodes, edges })
    const { svg } = renderPageSvg({ ...createEmptyDocument(), pages: [page] }, page.id)

    expect(svg.indexOf('data-cell-id="straight"')).toBeLessThan(svg.indexOf('data-cell-id="a"'))
    expect(svg).toMatch(/data-cell-id="straight"[^>]*>[\s\S]*? L /)
    expect(svg).toMatch(/data-cell-id="orthogonal"[^>]*>[\s\S]*?H 80 V 70/)
    expect(svg).toMatch(/data-cell-id="curved"[^>]*>[\s\S]*? C /)
    expect(svg).toContain('stroke-dasharray="8 4 2 4"')
    expect(svg).toContain('opacity="0.4"')
    expect(svg).toContain('marker-start="url(#arrow-start)"')
    expect(svg).toContain('marker-end="url(#arrow-end)"')
    expect(svg).toContain('边&lt;&amp;&gt;')
  })

  it('rejects an unknown page without mutating the document', () => {
    const document = createEmptyDocument()
    const before = structuredClone(document)
    expect(() => renderPageSvg(document, 'missing')).toThrow('导出页面不存在。')
    expect(document).toEqual(before)
  })

  it('renders cyclic background references without duplicate pages', () => {
    const first = createEmptyPage({
      id: 'first', type: 'background', backgroundPageId: 'second',
      nodes: [createTestNode({ id: 'first-node' })],
    })
    const second = createEmptyPage({
      id: 'second', type: 'background', backgroundPageId: 'first',
      nodes: [createTestNode({ id: 'second-node' })],
    })
    const page = createEmptyPage({ id: 'page', backgroundPageId: first.id })

    const { svg } = renderPageSvg({ ...createEmptyDocument(), pages: [page, first, second] }, page.id)

    expect(svg.match(/data-cell-id="first-node"/g)).toHaveLength(1)
    expect(svg.match(/data-cell-id="second-node"/g)).toHaveLength(1)
  })

  it('uses the same center rotation for the node body and its edge terminal', () => {
    const page = createEmptyPage({
      id: 'page',
      nodes: [
        createTestNode({ id: 'rotated', x: 10, y: 20, width: 80, height: 40, angle: 90 }),
        createTestNode({ id: 'target', x: 210, y: 20, width: 80, height: 40 }),
      ],
      edges: [createTestEdge({
        id: 'edge', connector: 'orthogonal',
        source: { nodeId: 'rotated', port: 'right' }, target: { nodeId: 'target', port: 'left' },
      })],
    })

    const { svg } = renderPageSvg({ ...createEmptyDocument(), pages: [page] }, page.id)

    expect(svg).toContain('<g data-cell-id="rotated" transform="rotate(90 50 40)">')
    expect(svg).toMatch(/data-cell-id="edge"[^>]*><path d="M 50 80 /)
  })
})
