import { defineConfig, devices } from '@playwright/test'

// Pixel baselines for the launch surface and drum workbench. Baselines are recorded per platform
// (the default -chromium-darwin suffix) and must be reviewed by a person before they are accepted.
// Semantic and layout rules live in tests/e2e/studio-design-contract.spec.ts and run in CI.
export default defineConfig({
  testDir: './tests/visual',
  outputDir: './test-results/visual',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  // In CI a missing baseline is a failure, never a silently written new image.
  updateSnapshots: process.env.CI ? 'none' : 'missing',
  reporter: [['list']],
  // Tight tolerances: small recolours of status text must register as a difference.
  expect: { toHaveScreenshot: { threshold: 0.1, maxDiffPixels: 20, animations: 'disabled', caret: 'hide', scale: 'css' } },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5196',
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5196 --strictPort',
    url: 'http://127.0.0.1:5196',
    reuseExistingServer: false,
  },
})
