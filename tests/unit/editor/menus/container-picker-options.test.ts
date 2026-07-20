import { validContainerMembers, validContainerTargets } from '@/application/menus/container-picker-options'
import { createTestDocument, createTestNode } from '../../../helpers/test-document'

describe('container picker options', () => {
  it('offers a target only when every selected member can join it', () => {
    const page = createTestDocument().pages[0]
    page.nodes.push(createTestNode({ id: 'container', isContainer: true }))
    page.nodes[0].parentId = 'container'
    expect(validContainerTargets(page, ['node-1', 'node-2'])).toEqual([])
  })

  it('filters self, ancestors, and descendants that would create cycles', () => {
    const page = createTestDocument().pages[0]
    page.nodes.push(
      createTestNode({ id: 'root', isContainer: true }),
      createTestNode({ id: 'child', isContainer: true, parentId: 'root' }),
      createTestNode({ id: 'grandchild', isContainer: true, parentId: 'child' }),
    )
    expect(validContainerTargets(page, ['root']).map(({ id }) => id)).not.toEqual(expect.arrayContaining(['root', 'child', 'grandchild']))
    expect(validContainerMembers(page, 'child').map(({ id }) => id)).not.toEqual(expect.arrayContaining(['root', 'child']))
  })
})
