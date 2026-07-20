import { normalizeDiagramSavePath } from '@/platform/tauri-desktop-platform'

describe('normalizeDiagramSavePath', () => {
  it('无扩展名时追加 .flowdiagram', () => {
    expect(normalizeDiagramSavePath('C:/docs/流程图')).toBe('C:/docs/流程图.flowdiagram')
  })

  it('大小写不同的 .flowdiagram 扩展名保持原路径', () => {
    expect(normalizeDiagramSavePath('C:/docs/流程图.FLOWDIAGRAM')).toBe('C:/docs/流程图.FLOWDIAGRAM')
  })

  it('已有其他扩展名时拒绝而不是追加双扩展名', () => {
    expect(() => normalizeDiagramSavePath('C:/docs/流程图.json')).toThrow('只能保存为 .flowdiagram 文件。')
  })
})
