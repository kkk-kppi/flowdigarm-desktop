import type { DiagramDocument, DiagramPage } from '@/domain/diagram'

/** Returns one page and its valid background closure, oldest background first. */
export function resolvePageBackgroundChain(
  document: DiagramDocument,
  pageId: string,
): DiagramPage[] {
  const pagesById = new Map(document.pages.map((page) => [page.id, page]))
  const chain: DiagramPage[] = []
  const visited = new Set<string>()
  let page = pagesById.get(pageId)

  while (page && !visited.has(page.id)) {
    visited.add(page.id)
    chain.push(page)
    const background = page.backgroundPageId === undefined
      ? undefined
      : pagesById.get(page.backgroundPageId)
    page = background?.type === 'background' ? background : undefined
  }

  return chain.reverse()
}
