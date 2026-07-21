export async function loadApplicationRuntime<T>(
  viteE2E: string | undefined,
  loaders: { browser(): Promise<T>; tauri(): Promise<T> },
): Promise<T> {
  return viteE2E === '1' ? loaders.browser() : loaders.tauri()
}
