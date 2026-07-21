export type ParseBusinessDataResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }

export function parseBusinessDataJson(value: string): ParseBusinessDataResult {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: '业务数据必须是 JSON 对象。' }
    }
    return { ok: true, data: structuredClone(parsed as Record<string, unknown>) }
  } catch {
    return { ok: false, error: '业务数据 JSON 格式无效。' }
  }
}

function canonicalJson(data: Record<string, unknown>): string {
  return JSON.stringify(data, (_key, value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    )
  })
}

export function hasBusinessDataChanged(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): boolean {
  return canonicalJson(before ?? {}) !== canonicalJson(after)
}
