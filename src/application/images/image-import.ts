import { CreateCellsCommand } from '@/application/commands/create-cells'
import type { EditorCommand } from '@/application/commands/editor-command'
import { createDefaultNodeStyle, type DiagramPage } from '@/domain/diagram'

export interface ImageReadResult {
  dataUrl: string
  width: number
  height: number
}

export interface ImageRepository {
  pickAndRead(): Promise<ImageReadResult | null>
}

export interface ImageImportStore {
  activePage: DiagramPage | undefined
  executeCommand(command: EditorCommand): void
  select(ids: string[]): void
  setNotice(message: string): void
}

export async function importImage(
  repository: ImageRepository,
  store: ImageImportStore,
  center?: { x: number; y: number },
): Promise<boolean> {
  const page = store.activePage
  if (!page) return false
  try {
    const image = await repository.pickAndRead()
    if (!image) return false
    if (!Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0) {
      throw new Error('图片尺寸无效。')
    }
    const scale = Math.max(Math.min(1, 240 / Math.max(image.width, image.height)), 24 / Math.min(image.width, image.height))
    const width = image.width * scale
    const height = image.height * scale
    const position = center ?? { x: page.pageSize.width / 2, y: page.pageSize.height / 2 }
    const id = crypto.randomUUID()
    store.executeCommand(new CreateCellsCommand({
      pageId: page.id,
      label: '插入图片',
      nodes: [{
        id,
        shape: 'image',
        x: position.x - width / 2,
        y: position.y - height / 2,
        width,
        height,
        angle: 0,
        style: createDefaultNodeStyle(),
        imageHref: image.dataUrl,
      }],
    }))
    store.select([id])
    return true
  } catch (error) {
    store.setNotice(error instanceof Error ? error.message : '图片导入失败。')
    return false
  }
}
