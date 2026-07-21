/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_E2E?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

import './e2e/e2e-types'
