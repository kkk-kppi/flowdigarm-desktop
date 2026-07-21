import { parseDiagramDocument, serializeValidatedDiagramDocument, type DocumentValidationContext } from '@/domain/document-schema'
import type { DiagramDocument } from '@/domain/diagram'
import type { DiagramFileRepository } from './persistence-ports'
import { normalizeDiagramFileError } from './file-errors'

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

export async function openDiagram(repository: DiagramFileRepository, context?: DocumentValidationContext): Promise<OpenDiagramResult | null> {
  try {
    const selected = await repository.open()
    return selected ? parseOpenedDiagram(selected, context) : null
  } catch (error) {
    return { ok: false, error: normalizeDiagramFileError(error).message }
  }
}

export async function openRecentDiagram(
  repository: DiagramFileRepository,
  path: string,
  context?: DocumentValidationContext,
): Promise<OpenDiagramResult> {
  try {
    return parseOpenedDiagram(await repository.read(path), context)
  } catch (error) {
    return { ok: false, error: normalizeDiagramFileError(error).message }
  }
}

export async function saveDiagram(
  repository: DiagramFileRepository,
  document: DiagramDocument,
  path?: string,
  context?: DocumentValidationContext,
): Promise<SaveDiagramResult> {
  const serialized = serializeValidatedDiagramDocument(document, context)
  if (!serialized.ok) return { ok: false, error: `文档校验失败，未保存：${serialized.error}` }
  return saveDiagramSnapshot(repository, {
    name: document.name,
    json: serialized.json,
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
  } catch (error) {
    return { ok: false, error: normalizeDiagramFileError(error, 'save').message }
  }
}

function parseOpenedDiagram(input: { path: string; json: string }, context?: DocumentValidationContext): OpenDiagramResult {
  const parsed = parseDiagramDocument(input.json, context)
  return parsed.ok
    ? { ok: true, path: input.path, document: parsed.document, warnings: parsed.warnings }
    : parsed
}
