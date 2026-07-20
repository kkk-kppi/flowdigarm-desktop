// tests/unit/editor/shapes/nearest-port.test.ts
// 端口定位与最近端口计算：四边中点、等距优先级 top→right→bottom→left、候选限定。
import { nearestPortId, portPositionPt } from '@/application/shapes/nearest-port'

const 节点 = { x: 100, y: 50, width: 80, height: 40 }

describe('portPositionPt 四边中点', () => {
  it('上/右/下/左中点坐标正确', () => {
    expect(portPositionPt(节点, 'top')).toEqual({ x: 140, y: 50 })
    expect(portPositionPt(节点, 'right')).toEqual({ x: 180, y: 70 })
    expect(portPositionPt(节点, 'bottom')).toEqual({ x: 140, y: 90 })
    expect(portPositionPt(节点, 'left')).toEqual({ x: 100, y: 70 })
  })

  it('未知端口抛「未知端口：xxx」', () => {
    expect(() => portPositionPt(节点, '角落')).toThrow('未知端口：角落')
  })
})

describe('nearestPortId 最近端口', () => {
  it('点在近上/右/下/左各返回对应端口', () => {
    expect(nearestPortId(节点, { x: 140, y: 55 })).toBe('top')
    expect(nearestPortId(节点, { x: 175, y: 70 })).toBe('right')
    expect(nearestPortId(节点, { x: 140, y: 85 })).toBe('bottom')
    expect(nearestPortId(节点, { x: 105, y: 70 })).toBe('left')
  })

  it('节点外远处的点也按最近中点判定', () => {
    expect(nearestPortId(节点, { x: 140, y: -100 })).toBe('top')
    expect(nearestPortId(节点, { x: 500, y: 70 })).toBe('right')
    expect(nearestPortId(节点, { x: 140, y: 500 })).toBe('bottom')
    expect(nearestPortId(节点, { x: -100, y: 70 })).toBe('left')
  })

  it('等距时按 top→right→bottom→left 优先级', () => {
    // 正中心到四个中点距离相等
    expect(nearestPortId(节点, { x: 140, y: 70 })).toBe('top')
    // 右上对角线方向：到 top 与 right 等距
    const 方形节点 = { x: 0, y: 0, width: 100, height: 100 }
    expect(nearestPortId(方形节点, { x: 75, y: 25 })).toBe('top')
    // 左下对角线方向：到 bottom 与 left 等距 → bottom 优先
    expect(nearestPortId(方形节点, { x: 25, y: 75 })).toBe('bottom')
  })

  it('allowedPortIds 限定候选集合', () => {
    // 点在最上方，但候选不含 top 时应返回其余中最近的
    expect(nearestPortId(节点, { x: 140, y: 55 }, ['left', 'right'])).toBe('right')
    expect(nearestPortId(节点, { x: 105, y: 70 }, ['left', 'right'])).toBe('left')
    expect(nearestPortId(节点, { x: 140, y: 55 }, ['bottom'])).toBe('bottom')
  })

  it('候选为空时抛「无可用端口。」', () => {
    expect(() => nearestPortId(节点, { x: 140, y: 55 }, [])).toThrow('无可用端口。')
  })
})
