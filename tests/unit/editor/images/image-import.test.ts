import { createEmptyDocument, type DiagramDocument, type DiagramPage } from '@/domain/diagram'
import type { EditorCommand } from '@/application/commands/editor-command'
import {
  importImage,
  type ImageImportStore,
  type ImageRepository,
} from '@/application/images/image-import'

function store(): ImageImportStore & {
  document: DiagramDocument
  commands: EditorCommand[]
  selected: string[]
  notices: string[]
} {
  const document = createEmptyDocument()
  return {
    document,
    commands: [],
    selected: [],
    notices: [],
    get activePage(): DiagramPage { return this.document.pages[0] },
    executeCommand(command) {
      this.commands.push(command)
      this.document = command.apply(this.document)
    },
    select(ids) { this.selected = ids },
    setNotice(message) { this.notices.push(message) },
  }
}

function repository(result: Awaited<ReturnType<ImageRepository['pickAndRead']>>): ImageRepository {
  return { pickAndRead: async () => result }
}

describe('importImage', () => {
  it('does nothing when the native picker is cancelled', async () => {
    const target = store()
    await expect(importImage(repository(null), target)).resolves.toBe(false)
    expect(target.commands).toEqual([])
    expect(target.notices).toEqual([])
  })

  it('creates one centered selected image node with a 240pt maximum side', async () => {
    const target = store()
    const page = target.activePage!
    await expect(importImage(repository({
      dataUrl: 'data:image/png;base64,AA==', width: 1600, height: 800,
    }), target)).resolves.toBe(true)

    expect(target.commands).toHaveLength(1)
    const node = target.activePage!.nodes[0]
    expect(node).toMatchObject({
      shape: 'image', width: 240, height: 120,
      x: page.pageSize.width / 2 - 120,
      y: page.pageSize.height / 2 - 60,
      imageHref: 'data:image/png;base64,AA==',
    })
    expect(target.selected).toEqual([node.id])
  })

  it('preserves aspect ratio while ensuring the smaller side is at least 24pt', async () => {
    const target = store()
    await importImage(repository({ dataUrl: 'data:image/webp;base64,AA==', width: 12, height: 6 }), target)
    expect(target.activePage!.nodes[0]).toMatchObject({ width: 48, height: 24 })
  })

  it('degrades read failures to readable Chinese feedback', async () => {
    const target = store()
    const failing: ImageRepository = { pickAndRead: async () => { throw new Error('图片过大，最大支持 5 MB。') } }

    await expect(importImage(failing, target)).resolves.toBe(false)

    expect(target.commands).toEqual([])
    expect(target.notices).toEqual(['图片过大，最大支持 5 MB。'])
  })
})
