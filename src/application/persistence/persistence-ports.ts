export interface DiagramFileRepository {
  open(): Promise<{ path: string; json: string } | null>
  read(path: string): Promise<{ path: string; json: string }>
  save(input: { path?: string; suggestedName: string; json: string }): Promise<string | null>
}

export interface RecoverySnapshot {
  documentId: string
  name: string
  json: string
  sourcePath?: string
  updatedAt: number
}

export interface RecoverySnapshotWrite {
  documentId: string
  name: string
  json: string
  sourcePath?: string
}

export interface RecoveryRepository {
  latest(): Promise<RecoverySnapshot | null>
  write(input: RecoverySnapshotWrite): Promise<void>
  remove(documentId: string): Promise<void>
}

export interface RecentDocument {
  path: string
  documentId: string
  name: string
  lastOpenedAt: number
  pinned: boolean
}

export interface RecentDocumentRepository {
  list(): Promise<RecentDocument[]>
  remove(path: string): Promise<void>
}

export interface SettingsRepository {
  all(): Promise<Record<string, unknown>>
  set(key: string, value: unknown): Promise<void>
}
