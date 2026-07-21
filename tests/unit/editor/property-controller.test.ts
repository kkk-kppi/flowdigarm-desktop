import { PropertyController } from '@/application/inspector/property-controller'
import { createTestDocument } from '../../helpers/test-document'

it('creates clamped geometry and full-snapshot edge label commands through one application boundary', () => {
  let document = createTestDocument()
  document.pages[0].edges[0].labels = [{
    text: { ...document.pages[0].nodes[0].text!, value: '' },
    position: 0.25,
  }]
  const controller = new PropertyController((command) => { document = command.apply(document) })
  const page = document.pages[0]

  controller.commitGeometry(page, page.nodes[0], 'x', '400000')
  expect(document.pages[0].nodes[0].x).toBe(1_000_000)

  controller.editEdgeLabel(document.pages[0], document.pages[0].edges[0], 'edited')
  const edited = document
  expect(edited.pages[0].edges[0].labels[0].text.value).toBe('edited')
})
