import {defineConfig,devices} from '@playwright/test';

const evidence='./test-results/drum-design';
export default defineConfig({
  testDir:'./tests/e2e',testMatch:'drum-approved-journey.spec.ts',
  fullyParallel:false,workers:1,retries:0,timeout:90_000,
  outputDir:`${evidence}/browser-results`,
  reporter:[['list'],['html',{outputFolder:`${evidence}/browser-report`,open:'never'}],['json',{outputFile:`${evidence}/browser-results.json`}]],
  use:{baseURL:'http://127.0.0.1:5439',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}}],
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 5439 --strictPort',url:'http://127.0.0.1:5439',reuseExistingServer:false},
});
