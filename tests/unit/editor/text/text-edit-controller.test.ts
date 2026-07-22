import { TextEditController } from '@/application/text/text-edit-controller'
import { createDefaultTextContent } from '@/domain/diagram'
import { createTestDocument } from '../../../helpers/test-document'

describe('TextEditController', () => {
  it('目标文本在会话期间变化时拒绝提交，避免生成错误撤销快照', () => {
    const document = createTestDocument()
    const execute = vi.fn()
    const controller = new TextEditController(() => document, execute)
    const node = document.pages[0].nodes[0]
    const before = node.text?.value ?? ''
    node.text = { ...node.text!, value: '外部修改' }

    expect(() => controller.commit(
      document.pages[0].id,
      { kind: 'node', nodeId: node.id },
      before,
      '用户草稿',
      document,
    )).toThrow('文本已被其他操作修改，请重新编辑。')
    expect(execute).not.toHaveBeenCalled()
  })

  it('边标签变化时同样拒绝提交', () => {
    const document = createTestDocument()
    const execute = vi.fn()
    const controller = new TextEditController(() => document, execute)
    const edge = document.pages[0].edges[0]
    edge.labels = [{ text: createDefaultTextContent('原标签'), position: 0.5 }]
    const before = edge.labels[0]?.text.value ?? ''
    edge.labels[0] = { ...edge.labels[0]!, text: { ...edge.labels[0]!.text, value: '外部标签' } }

    expect(() => controller.commit(
      document.pages[0].id,
      { kind: 'edgeLabel', edgeId: edge.id, labelIndex: 0 },
      before,
      '用户标签',
      document,
    )).toThrow('文本已被其他操作修改，请重新编辑。')
    expect(execute).not.toHaveBeenCalled()
  })

  it('文档被同 ID 同文本的新实例替换时拒绝写入替换文档', () => {
    let document = createTestDocument()
    const openedDocument = document
    const execute = vi.fn()
    const controller = new TextEditController(() => document, execute)
    const node = document.pages[0].nodes[0]
    document = structuredClone(document)

    expect(() => controller.commit(
      document.pages[0].id,
      { kind: 'node', nodeId: node.id },
      node.text?.value ?? '',
      '用户草稿',
      openedDocument,
    )).toThrow('文档已发生变化，请重新编辑。')
    expect(execute).not.toHaveBeenCalled()
  })
})
