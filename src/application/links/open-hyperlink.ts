// src/application/links/open-hyperlink.ts
// 超链接打开：普通点击 = 选择（不打开）；Ctrl（Windows）/ Cmd（macOS）+ 点击才打开。
// 打开前前端再校验一次白名单（Rust 侧另有二次校验，详细设计 §16）。
import type { DesktopPlatform } from '@/platform/desktop-platform'
import { validateHyperlink } from './hyperlink-validator'

/** 是否应打开链接：Ctrl 或 Cmd 任一按下。 */
export function shouldOpenHyperlink(event: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.ctrlKey || event.metaKey
}

/** 打开图元链接：非法返回中文错误串（不调平台）；合法调 platform.openExternalLink 并返回 null。 */
export async function openCellHyperlink(
  platform: DesktopPlatform,
  url: string,
): Promise<string | null> {
  if (url === '') {
    return null // 空链接无可打开（清除语义），静默不动作
  }
  const error = validateHyperlink(url)
  if (error) {
    return error
  }
  await platform.openExternalLink(url)
  return null
}
