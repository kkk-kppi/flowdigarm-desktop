import { createPinia, setActivePinia } from 'pinia'
import type { ClipboardPayload } from '@/application/clipboard/clipboard-service'
import { createDefaultEdgeStyle, createDefaultNodeStyle, createDefaultTextContent } from '@/domain/diagram'
import {
  FLOWDIAGRAM_CLIPBOARD_MIME,
  SystemClipboard,
  type ClipboardTextApi,
} from '@/infrastructure/clipboard/system-clipboard'
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'

const nodeId = '00000000-0000-4000-8000-000000000001'
const secondNodeId = '00000000-0000-4000-8000-000000000002'
const edgeId = '00000000-0000-4000-8000-000000000003'

function payload(): ClipboardPayload {
  return {
    nodes: [{
      id: nodeId, shape: 'rect', x: 10, y: 20, width: 80, height: 40,
      angle: 0, zIndex: 0, style: createDefaultNodeStyle(),
    }],
    edges: [],
  }
}

function payloadWithEdge(): ClipboardPayload {
  return {
    nodes: [payload().nodes[0], { ...payload().nodes[0], id: secondNodeId, text: createDefaultTextContent('目标') }],
    edges: [{
      id: edgeId,
      source: { nodeId, port: 'right' },
      target: { nodeId: secondNodeId, port: 'left' },
      connector: 'orthogonal',
      vertices: [{ x: 50, y: 40 }],
      labels: [{ text: createDefaultTextContent('标签'), position: 0.5 }],
      style: createDefaultEdgeStyle(),
      zIndex: 2,
    }],
  }
}

function api(): ClipboardTextApi & { text: string } {
  return {
    text: '',
    async writeText(value) { this.text = value },
    async readText() { return this.text },
  }
}

describe('SystemClipboard', () => {
  it('writes and reads a marked FlowDiagram payload through navigator clipboard text', async () => {
    const clipboardApi = api()
    const clipboard = new SystemClipboard(clipboardApi, vi.fn())

    await clipboard.write(payload())
    const serialized = JSON.parse(clipboardApi.text)
    expect(serialized.mime).toBe(FLOWDIAGRAM_CLIPBOARD_MIME)
    await expect(clipboard.read()).resolves.toEqual(payload())
  })

  it('keeps an in-app fallback and gives Chinese feedback when the API is denied', async () => {
    const notice = vi.fn()
    const clipboard = new SystemClipboard({
      writeText: async () => { throw new Error('denied') },
      readText: async () => { throw new Error('denied') },
    }, notice)

    await clipboard.write(payload())
    await expect(clipboard.read()).resolves.toEqual(payload())
    expect(notice).toHaveBeenCalledWith('系统剪贴板不可用，已使用应用内剪贴板。')
  })

  it.each([
    JSON.stringify({ mime: FLOWDIAGRAM_CLIPBOARD_MIME, payload: { nodes: [{ ...payload().nodes[0], id: 'not-uuid' }], edges: [] } }),
    JSON.stringify({ mime: FLOWDIAGRAM_CLIPBOARD_MIME, payload: { nodes: payload().nodes, edges: [{ id: '00000000-0000-4000-8000-000000000002', source: { nodeId }, target: { nodeId: '00000000-0000-4000-8000-000000000099' }, connector: 'straight', vertices: [], labels: [], style: {}, zIndex: 0 }] } }),
    JSON.stringify({ mime: FLOWDIAGRAM_CLIPBOARD_MIME, payload: { nodes: [{ ...payload().nodes[0], x: Number.POSITIVE_INFINITY }], edges: [] } }),
    'not-json',
  ])('rejects hostile or malformed system payloads without throwing', async (text) => {
    const notice = vi.fn()
    const clipboard = new SystemClipboard({ writeText: async () => {}, readText: async () => text }, notice)
    await expect(clipboard.read()).resolves.toBeNull()
    expect(notice).toHaveBeenCalledWith('系统剪贴板内容无效，已使用应用内剪贴板。')
  })

  it.each([
    ['missing shape', (value: any) => { delete value.nodes[0].shape }],
    ['missing node style', (value: any) => { delete value.nodes[0].style }],
    ['missing text block', (value: any) => { delete value.nodes[1].text.block }],
    ['missing connector', (value: any) => { delete value.edges[0].connector }],
    ['missing labels', (value: any) => { delete value.edges[0].labels }],
    ['missing edge style', (value: any) => { delete value.edges[0].style }],
    ['duplicate UUID', (value: any) => { value.edges[0].id = value.nodes[0].id }],
    ['negative size', (value: any) => { value.nodes[0].width = -1 }],
    ['hostile node URL', (value: any) => { value.nodes[0].link = 'javascript:alert(1)' }],
    ['hostile image URL', (value: any) => { value.nodes[0].imageHref = 'file:///etc/passwd' }],
    ['invalid label position', (value: any) => { value.edges[0].labels[0].position = 2 }],
    ['invalid vertex', (value: any) => { value.edges[0].vertices[0].x = Number.NaN }],
  ])('rejects %s instead of trusting missing or hostile nested data', async (_label, mutate) => {
    const candidate = structuredClone(payloadWithEdge()) as any
    mutate(candidate)
    const notice = vi.fn()
    const text = JSON.stringify({ mime: FLOWDIAGRAM_CLIPBOARD_MIME, version: 1, payload: candidate })
    const clipboard = new SystemClipboard({ writeText: async () => {}, readText: async () => text }, notice)

    await expect(clipboard.read()).resolves.toBeNull()
    expect(notice).toHaveBeenCalledWith('系统剪贴板内容无效，已使用应用内剪贴板。')
  })

  it.each([
    ['self-parent', (value: any) => {
      value.nodes[0].isContainer = true
      value.nodes[0].parentId = value.nodes[0].id
    }],
    ['parent cycle', (value: any) => {
      value.nodes[0].isContainer = true
      value.nodes[1].isContainer = true
      value.nodes[0].parentId = value.nodes[1].id
      value.nodes[1].parentId = value.nodes[0].id
    }],
    ['non-container parent', (value: any) => {
      value.nodes[1].parentId = value.nodes[0].id
    }],
  ])('rejects hostile %s hierarchy', async (_label, mutate) => {
    const candidate = structuredClone(payloadWithEdge()) as any
    mutate(candidate)
    const notice = vi.fn()
    const text = JSON.stringify({ mime: FLOWDIAGRAM_CLIPBOARD_MIME, version: 1, payload: candidate })
    const clipboard = new SystemClipboard({ writeText: async () => {}, readText: async () => text }, notice)

    await expect(clipboard.read()).resolves.toBeNull()
    expect(notice).toHaveBeenCalledWith('系统剪贴板内容无效，已使用应用内剪贴板。')
  })

  it('rejects payload counts beyond the domain page limit', async () => {
    const candidate = payload()
    candidate.nodes = Array.from({ length: 5001 }, () => structuredClone(candidate.nodes[0]))
    const notice = vi.fn()
    const text = JSON.stringify({ mime: FLOWDIAGRAM_CLIPBOARD_MIME, version: 1, payload: candidate })
    const clipboard = new SystemClipboard({ writeText: async () => {}, readText: async () => text }, notice)

    await expect(clipboard.read()).resolves.toBeNull()
    expect(notice).toHaveBeenCalledWith('系统剪贴板内容无效，已使用应用内剪贴板。')
  })
})

describe('document store system clipboard integration', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('copies best-effort to the system and pastes an external payload as one history record', async () => {
    const store = useDocumentStore()
    const selection = useSelectionStore()
    const writes: ClipboardPayload[] = []
    expect(store.canPaste).toBe(false)
    store.setSystemClipboard({
      write: async (value) => { writes.push(value) },
      read: async () => payload(),
    })
    expect(store.canPaste).toBe(true)
    store.createNodeFromShape('rect')
    const existing = store.activePage!.nodes[0]
    selection.setSelection([existing.id])
    await store.copySelection()
    expect(writes).toHaveLength(1)

    store.clipboard = null
    const beforeRevision = store.currentRevision
    await store.pasteClipboard()

    expect(store.activePage!.nodes).toHaveLength(2)
    expect(store.currentRevision).toBe(beforeRevision + 1)
  })
})
