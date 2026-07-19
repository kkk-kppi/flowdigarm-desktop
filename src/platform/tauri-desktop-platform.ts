import { invoke } from '@tauri-apps/api/core'
import type { DesktopPlatform } from './desktop-platform'

/**
 * 基于 Tauri command 的平台实现骨架。
 * 本任务只做 invoke 转发；各 Rust command 在后续任务逐一落地。
 */
export const tauriDesktopPlatform: DesktopPlatform = {
  openDiagram: () => invoke<{ path: string; document: unknown } | null>('open_diagram'),
  saveDiagram: (input) => invoke<string | null>('save_diagram', { input }),
  exportDiagram: (input) => invoke<string | null>('export_diagram', { input }),
  openExternalLink: (url) => invoke<void>('open_external_link', { url }),
  readRecoverySnapshot: () => invoke<unknown | null>('read_recovery_snapshot'),
  writeRecoverySnapshot: (document) => invoke<void>('write_recovery_snapshot', { document }),
}
