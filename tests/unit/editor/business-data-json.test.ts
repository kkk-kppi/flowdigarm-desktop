import {
  hasBusinessDataChanged,
  parseBusinessDataJson,
} from '@/application/inspector/business-data-json'

describe('业务数据 JSON 解析', () => {
  it('解析包含中文和嵌套值的 JSON 对象', () => {
    const result = parseBusinessDataJson('{"负责人":"张三","审批":{"通过":true},"步骤":["提交","复核"]}')

    expect(result).toEqual({
      ok: true,
      data: {
        负责人: '张三',
        审批: { 通过: true },
        步骤: ['提交', '复核'],
      },
    })
  })

  it('拒绝无效 JSON', () => {
    expect(parseBusinessDataJson('{"负责人":')).toEqual({
      ok: false,
      error: '业务数据 JSON 格式无效。',
    })
  })

  it.each(['[]', '"文本"', '42', 'true', 'null'])(
    '拒绝数组或标量：%s',
    (value) => {
      expect(parseBusinessDataJson(value)).toEqual({
        ok: false,
        error: '业务数据必须是 JSON 对象。',
      })
    },
  )
})

describe('业务数据变更判断', () => {
  it('忽略对象属性顺序并识别嵌套值变化', () => {
    expect(hasBusinessDataChanged({ 编号: 7, 状态: '完成' }, { 状态: '完成', 编号: 7 })).toBe(false)
    expect(hasBusinessDataChanged({ 审批: { 通过: false } }, { 审批: { 通过: true } })).toBe(true)
  })

  it('未设置业务数据与空对象视为相同', () => {
    expect(hasBusinessDataChanged(undefined, {})).toBe(false)
  })
})
