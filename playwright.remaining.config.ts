import {defineConfig,devices} from '@playwright/test';
import base from './playwright.config';

// Remaining surface gallery: Chromium only, served by the instrumented control-audit Vite config on its
// own port and output directory so it never shares a server or results with another run. Viewport,
// appearance and theme are set per test inside the spec.
export default defineConfig({
  ...base,
  testMatch:'**/remaining-surfaces.spec.ts',
  testIgnore:[],
  workers:2,
  reporter:'list',
  outputDir:'/tmp/opstudio-remaining-results',
  use:{...base.use,baseURL:'http://127.0.0.1:5303',serviceWorkers:'block'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:{command:'npx vite --config vite.control-audit.config.ts --host 127.0.0.1 --port 5303 --strictPort',url:'http://127.0.0.1:5303',reuseExistingServer:false},
});
