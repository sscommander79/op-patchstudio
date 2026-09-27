import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',
  testMatch:'recovery-integrity.spec.ts',
  fullyParallel:true,
  forbidOnly:!!process.env.CI,
  retries:process.env.CI?2:0,
  workers:process.env.CI?1:undefined,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:5187',trace:'on-first-retry'},
  projects:[
    {name:'chromium',use:{...devices['Desktop Chrome']}},
    {name:'firefox',use:{...devices['Desktop Firefox']}},
    {name:'webkit',use:{...devices['Desktop Safari']}},
    {name:'Mobile Chrome',use:{...devices['Pixel 5']}},
    {name:'Mobile Safari',use:{...devices['iPhone 12']}},
  ],
  webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5187 --strictPort',url:'http://127.0.0.1:5187',reuseExistingServer:false},
});
