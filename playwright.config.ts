import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    actionTimeout: 10_000,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node tests/e2e/mock-server.mjs',
    url: 'http://127.0.0.1:4242/sample.html',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
})
