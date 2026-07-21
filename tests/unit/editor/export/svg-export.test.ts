import { createDefaultTextContent, createEmptyDocument, createEmptyPage } from '@/domain/diagram'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes'
import { renderPageSvg } from '@/infrastructure/export/svg-export'
import { createTestEdge, createTestNode } from '../../../helpers/test-document'

describe('renderPageSvg', () => {
  it('renders exact pt page geometry, direct background first, and every registered shape', () => {
    const background = createEmptyPage({
      id: 'background', name: '背景', type: 'background',
      nodes: [createTestNode({ id: 'bg', x: 1, y: 2, text: createDefaultTextContent('背景层') })],
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
    const document = { ...createEmptyDocument(), pages: [page, background] }

    const result = renderPageSvg(document, page.id)

    expect(result.svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="595.276pt" height="841.89pt" viewBox="0 0 595.276 841.89">')
    expect(result.svg.indexOf('背景层')).toBeLessThan(result.svg.indexOf('矩形'))
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
    expect(svg).toMatch(/data-cell-id="orthogonal"[^>]*>[\s\S]*?80 70/)
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
})
