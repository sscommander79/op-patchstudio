import {defineConfig,devices} from '@playwright/test';
import base from './playwright.config';

// Final coverage gaps: Chromium only, served by the instrumented control-audit Vite config on its own
// port and output directory so it never shares a server or results with another run.
export default defineConfig({
  ...base,
  testMatch:'**/final-coverage-gaps.spec.ts',
  testIgnore:[],
  workers:2,
  reporter:'list',
  outputDir:'/tmp/opstudio-final-gap-results',
  use:{...base.use,baseURL:'http://127.0.0.1:5304',serviceWorkers:'block'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:{command:'npx vite --config vite.control-audit.config.ts --host 127.0.0.1 --port 5304 --strictPort',url:'http://127.0.0.1:5304',reuseExistingServer:false},
});
