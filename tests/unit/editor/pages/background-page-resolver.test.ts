// tests/unit/editor/pages/background-page-resolver.test.ts
// 背景页解析：前景页取其直接引用的背景页；背景页/无引用/悬空引用均返回 undefined；不沿链多级追踪。
import { resolveBackgroundPage } from '@/application/pages/background-page-resolver'
import { createEmptyDocument, createEmptyPage, type DiagramDocument } from '@/domain/diagram'

function documentWith(...pages: ReturnType<typeof createEmptyPage>[]): DiagramDocument {
  return { ...createEmptyDocument(), pages }
}

describe('resolveBackgroundPage', () => {
  it('前景页返回其 backgroundPageId 直接指向的背景页', () => {
    const background = createEmptyPage({ id: 'bg-1', name: '背景页', type: 'background' })
    const foreground = createEmptyPage({ id: 'fg-1', name: '前景页', backgroundPageId: 'bg-1' })
    const document = documentWith(foreground, background)
    expect(resolveBackgroundPage(document, 'fg-1')).toBe(background)
  })

  it('背景页自身返回 undefined（即使它引用了别的背景页）', () => {
    const backgroundDeep = createEmptyPage({ id: 'bg-2', name: '底层背景', type: 'background' })
    const background = createEmptyPage({
      id: 'bg-1',
      name: '背景页',
      type: 'background',
      backgroundPageId: 'bg-2',
    })
    const foreground = createEmptyPage({ id: 'fg-1', name: '前景页', backgroundPageId: 'bg-1' })
    const document = documentWith(foreground, background, backgroundDeep)
    // 链上 >1 级只取直接引用：前景页取到 bg-1 即止；bg-1 作为背景页查询返回 undefined
    expect(resolveBackgroundPage(document, 'fg-1')).toBe(background)
    expect(resolveBackgroundPage(document, 'bg-1')).toBeUndefined()
  })

  it('无引用的前景页返回 undefined', () => {
    const foreground = createEmptyPage({ id: 'fg-1', name: '前景页' })
    const document = documentWith(foreground)
    expect(resolveBackgroundPage(document, 'fg-1')).toBeUndefined()
  })

  it('引用悬空或指向非背景页时返回 undefined', () => {
    const otherForeground = createEmptyPage({ id: 'fg-2', name: '另一前景页' })
    const dangling = createEmptyPage({ id: 'fg-1', name: '悬空引用页', backgroundPageId: 'missing' })
    const wrongType = createEmptyPage({ id: 'fg-3', name: '错误引用页', backgroundPageId: 'fg-2' })
    const document = documentWith(dangling, wrongType, otherForeground)
    expect(resolveBackgroundPage(document, 'fg-1')).toBeUndefined()
    expect(resolveBackgroundPage(document, 'fg-3')).toBeUndefined()
  })

  it('页面不存在时返回 undefined', () => {
    const document = documentWith(createEmptyPage({ id: 'fg-1' }))
    expect(resolveBackgroundPage(document, 'missing')).toBeUndefined()
  })
})
