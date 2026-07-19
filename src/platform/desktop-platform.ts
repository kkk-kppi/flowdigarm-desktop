/**
 * 平台契约（详细设计 §8.4）：前端只依赖此接口，不直接触碰 Tauri API。
 * document 的具体类型在领域模型落地后收窄，本任务使用 unknown。
 */
export interface DesktopPlatform {
  openDiagram(): Promise<{ path: string; document: unknown } | null>
  saveDiagram(input: { path?: string; document: unknown }): Promise<string | null>
  exportDiagram(input: unknown): Promise<string | null>
  openExternalLink(url: string): Promise<void>
  readRecoverySnapshot(): Promise<unknown | null>
  writeRecoverySnapshot(document: unknown): Promise<void>
}
