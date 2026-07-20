// src/application/links/hyperlink-validator.ts
// 超链接前端校验：仅 http/https/mailto；空串表示清除链接（合法）。
// 包装领域谓词 isAllowedHyperlinkProtocol，返回面向用户的中文错误串。
import { isAllowedHyperlinkProtocol } from '@/domain/validators'

export const HYPERLINK_PROTOCOL_ERROR = '仅支持 http、https、mailto 链接。'

/** 合法（含空串）→ null；非法 → 中文错误串。 */
export function validateHyperlink(url: string): string | null {
  if (url === '') {
    return null
  }
  return isAllowedHyperlinkProtocol(url) ? null : HYPERLINK_PROTOCOL_ERROR
}
