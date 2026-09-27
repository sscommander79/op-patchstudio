import { defineConfig, devices } from '@playwright/test'

// Reproduces a production service worker left on a loopback origin that later hosts the dev server.
// The spec builds its own production fixture and starts/stops servers itself, so there is no webServer.
export default defineConfig({
  testDir: './tests/dev-origin',
  outputDir: './test-results/dev-origin',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], serviceWorkers: 'allow' },
  projects: [{ name: 'chromium' }],
})
