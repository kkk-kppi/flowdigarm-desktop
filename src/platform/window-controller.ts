export interface WindowController {
  minimize(): Promise<void>
  toggleMaximize(): Promise<void>
  requestClose(): Promise<void>
  onCloseRequested(): Promise<() => void>
}
