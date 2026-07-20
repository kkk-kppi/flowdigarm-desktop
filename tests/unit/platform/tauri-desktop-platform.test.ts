import { invoke } from '@tauri-apps/api/core'
import {
  normalizeDiagramSavePath,
  tauriDesktopPlatform,
  tauriRecoveryRepository,
} from '@/platform/tauri-desktop-platform'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))

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

describe('tauri recovery adapter', () => {
  beforeEach(() => vi.mocked(invoke).mockReset())

  it('conditional remove 把 documentId 与 versionToken 一起传给 command', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined)
    await tauriRecoveryRepository.remove('doc-1', '3:7')
    expect(invoke).toHaveBeenCalledWith('delete_recovery_snapshot', {
      documentId: 'doc-1',
      versionToken: '3:7',
    })
  })

  it('拒绝缺少 versionToken 的恢复写入 DTO', async () => {
    await expect(tauriDesktopPlatform.writeRecoverySnapshot({
      documentId: 'doc-1',
      name: '恢复',
      json: '{}',
    })).rejects.toThrow('自动恢复快照数据无效。')
    expect(invoke).not.toHaveBeenCalled()
  })
})
