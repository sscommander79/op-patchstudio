import {defineConfig,devices} from '@playwright/test';
import base from './playwright.config';

// Exhaustive surface gallery: Chromium only for now. Viewport, appearance and theme are set per test
// inside the spec. Service workers are blocked so the spec's network interception sees every request.
export default defineConfig({
  ...base,
  testMatch:'**/exhaustive-surfaces.spec.ts',
  testIgnore:[],
  workers:2,
  reporter:'list',
  outputDir:'/tmp/opstudio-exhaustive-results',
  use:{...base.use,baseURL:'http://127.0.0.1:5298',serviceWorkers:'block'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:{command:'npx vite --config vite.control-audit.config.ts --host 127.0.0.1 --port 5298 --strictPort',url:'http://127.0.0.1:5298',reuseExistingServer:false},
});
