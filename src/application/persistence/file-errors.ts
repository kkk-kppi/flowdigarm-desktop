export type DiagramFileErrorCode = 'not-found' | 'invalid' | 'too-large' | 'permission' | 'io'
export type DiagramFileOperation = 'read' | 'save'

const READ_MESSAGES: Record<DiagramFileErrorCode, string> = {
  'not-found': '文件不存在或已被移动。',
  invalid: '文件格式无效，未打开文件。',
  'too-large': '文件过大，最大支持 20 MB。',
  permission: '没有权限读取该文件。',
  io: '无法读取文件。',
}

export class DiagramFileError extends Error {
  readonly name = 'DiagramFileError'

  constructor(
    readonly code: DiagramFileErrorCode,
    operation: DiagramFileOperation = 'read',
    message = operation === 'save' && code === 'permission'
      ? '没有权限保存到该位置。'
      : operation === 'save' && code === 'io'
        ? '无法保存，原文件未被覆盖。'
        : READ_MESSAGES[code],
  ) {
    super(message)
  }
}

export function normalizeDiagramFileError(
  error: unknown,
  operation: DiagramFileOperation = 'read',
): DiagramFileError {
  if (error instanceof DiagramFileError) return error
  const message = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : ''
  if (message.includes('不存在') || message.includes('已被移动')) return new DiagramFileError('not-found', operation)
  if (message.includes('过大') || message.includes('20 MB')) return new DiagramFileError('too-large', operation)
  if (message.includes('权限') || message.includes('拒绝访问')) return new DiagramFileError('permission', operation)
  if (message.includes('格式无效') || message.includes('文件版本') || message.includes('路径无效')) {
    return new DiagramFileError('invalid', operation, message)
  }
  return new DiagramFileError('io', operation)
}
