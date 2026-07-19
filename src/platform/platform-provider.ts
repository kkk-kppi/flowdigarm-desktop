import { inject, provide, type InjectionKey } from 'vue'
import type { DesktopPlatform } from './desktop-platform'
import { tauriDesktopPlatform } from './tauri-desktop-platform'

const platformKey: InjectionKey<DesktopPlatform> = Symbol('desktop-platform')

/**
 * 在应用根组件 setup 中调用，注入平台实现。
 * 测试可传入 mock 平台；生产默认使用 Tauri 实现。
 */
export function providePlatform(platform: DesktopPlatform = tauriDesktopPlatform): void {
  provide(platformKey, platform)
}

/** 在组件 setup 中读取平台实现；未显式 provide 时回退到 Tauri 实现。 */
export function usePlatform(): DesktopPlatform {
  return inject(platformKey, () => tauriDesktopPlatform, true)
}
