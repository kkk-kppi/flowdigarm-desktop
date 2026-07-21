import { describe, expect, it, vi } from 'vitest'

const fakeGraph = {
  use: vi.fn(),
  zoom: vi.fn(),
  translate: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  setGridSize: vi.fn(),
  showGrid: vi.fn(),
  hideGrid: vi.fn(),
  clearCells: vi.fn(),
  getCellById: vi.fn(),
  getSelectedCells: vi.fn(() => []),
  resetSelection: vi.fn(),
  cleanSelection: vi.fn(),
  dispose: vi.fn(),
}

vi.mock('@antv/x6', () => ({
  Graph: class {
    static registerNode = vi.fn()
    static registerEdge = vi.fn()
    static registerConnector = vi.fn()
    constructor() {
      return fakeGraph as unknown as typeof fakeGraph
    }
  },
}))

vi.mock('@antv/x6-plugin-scroller', () => ({
  Scroller: class {
    container = document.createElement('div')
    init() {}
  },
}))
vi.mock('@antv/x6-plugin-dnd', () => ({
  Dnd: class {
    dispose() {}
  },
}))
vi.mock('@antv/x6-plugin-selection', () => ({
  Selection: class {},
}))
vi.mock('@antv/x6-plugin-snapline', () => ({
  Snapline: class {
    enable() {}
    disable() {}
  },
}))
vi.mock('@antv/x6-plugin-transform', () => ({
  Transform: class {},
}))

import { GraphAdapter } from '@/infrastructure/x6/graph-adapter'

describe('GraphAdapter snap-to-grid', () => {
  it('keeps visual grid size when snapping is disabled', () => {
    const container = document.createElement('div')
    const adapter = new GraphAdapter(container)

    adapter.setSnapToGrid(true, 10)
    expect(fakeGraph.setGridSize).toHaveBeenLastCalledWith(10)

    adapter.setSnapToGrid(false, 10)
    expect(fakeGraph.setGridSize).toHaveBeenLastCalledWith(10)

    adapter.dispose()
  })
})
