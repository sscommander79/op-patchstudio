import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const configured=process.env.PLAYWRIGHT_FAKE_AUDIO_FILE;
const fixturePath=resolve(configured||'/tmp/opstudio-missing-fake-audio.wav');
const production=process.env.PLAYWRIGHT_PRODUCTION==='1';

export default defineConfig({
  testDir:'./tests/e2e',
  testMatch:['recording-fake-device.spec.ts','auto-sampling.spec.ts','guided-multisample-flow.spec.ts'],
  globalSetup:'./tests/e2e/recordingFakeDeviceSetup.ts',
  fullyParallel:false,
  workers:1,
  retries:0,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:5187',trace:'on-first-retry'},
  projects:[{name:'chromium fake audio device',use:{...devices['Desktop Chrome'],channel:'chromium',launchOptions:{args:['--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${fixturePath}`]}}}],
  webServer:{command:production?'npm run preview -- --host 127.0.0.1 --port 5187 --strictPort':'npm run dev -- --host 127.0.0.1 --port 5187 --strictPort',url:'http://127.0.0.1:5187',reuseExistingServer:false},
});
