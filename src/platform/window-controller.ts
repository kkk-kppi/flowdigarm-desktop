export interface WindowController {
  minimize(): Promise<void>
  toggleMaximize(): Promise<void>
  watchMaximized(handler: (maximized: boolean) => void): Promise<() => void>
  requestClose(): Promise<void>
  onCloseRequested(): Promise<() => void>
}
