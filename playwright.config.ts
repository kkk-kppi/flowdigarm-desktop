import { defineConfig } from '@playwright/test'

// E2E 用例在后续任务补充；本任务仅建立配置与 e2e/ 目录。
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:1420',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
  },
})
