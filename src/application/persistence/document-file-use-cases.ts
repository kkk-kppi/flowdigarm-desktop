import { parseDiagramDocument, serializeDiagramDocument } from '@/domain/document-schema'
import type { DiagramDocument } from '@/domain/diagram'
import type { DiagramFileRepository } from './persistence-ports'

export type OpenDiagramResult =
  | { ok: true; path: string; document: DiagramDocument; warnings: string[] }
  | { ok: false; error: string }

export type SaveDiagramResult =
  | { ok: true; path: string }
  | { ok: false; error: string }

export interface DiagramSaveSnapshot {
  name: string
  json: string
  path?: string
}

export async function openDiagram(repository: DiagramFileRepository): Promise<OpenDiagramResult | null> {
  try {
    const selected = await repository.open()
    return selected ? parseOpenedDiagram(selected) : null
  } catch {
    return { ok: false, error: '无法打开文件。' }
  }
}

export async function openRecentDiagram(
  repository: DiagramFileRepository,
  path: string,
): Promise<OpenDiagramResult> {
  try {
    return parseOpenedDiagram(await repository.read(path))
  } catch {
    return { ok: false, error: '无法打开文件。' }
  }
}

export async function saveDiagram(
  repository: DiagramFileRepository,
  document: DiagramDocument,
  path?: string,
): Promise<SaveDiagramResult> {
  return saveDiagramSnapshot(repository, {
    name: document.name,
    json: serializeDiagramDocument(document),
    ...(path === undefined ? {} : { path }),
  })
}

export async function saveDiagramSnapshot(
  repository: DiagramFileRepository,
  snapshot: DiagramSaveSnapshot,
): Promise<SaveDiagramResult> {
  try {
    const savedPath = await repository.save({
      ...(snapshot.path === undefined ? {} : { path: snapshot.path }),
      suggestedName: `${snapshot.name}.flowdiagram`,
      json: snapshot.json,
    })
    return savedPath
      ? { ok: true, path: savedPath }
      : { ok: false, error: '已取消保存。' }
  } catch {
    return { ok: false, error: '无法保存，原文件未被覆盖。' }
  }
}

function parseOpenedDiagram(input: { path: string; json: string }): OpenDiagramResult {
  const parsed = parseDiagramDocument(input.json)
  return parsed.ok
    ? { ok: true, path: input.path, document: parsed.document, warnings: parsed.warnings }
    : parsed
}
