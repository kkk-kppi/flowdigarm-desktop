// src/application/pages/background-page-resolver.ts
// 背景页解析：前景页 → 其 backgroundPageId 直接指向的背景页；
// 背景页/无引用/悬空或类型错误的引用 → undefined；链上 >1 级只取直接引用。
import type { DiagramDocument, DiagramPage } from '@/domain/diagram'

export function resolveBackgroundPage(
  document: DiagramDocument,
  pageId: string,
): DiagramPage | undefined {
  const page = document.pages.find((p) => p.id === pageId)
  if (!page || page.type !== 'foreground' || page.backgroundPageId === undefined) {
    return undefined
  }
  const background = document.pages.find((p) => p.id === page.backgroundPageId)
  if (!background || background.type !== 'background') {
    return undefined
  }
  return background
}
