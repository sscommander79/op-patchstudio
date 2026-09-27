import {defineConfig,devices} from '@playwright/test';
import {resolve} from 'node:path';
const fixture=resolve(process.env.PLAYWRIGHT_FAKE_AUDIO_FILE||'/tmp/opstudio-missing-stem-audio.wav');
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['stem-recording-device.spec.ts'],globalSetup:'./tests/e2e/recordingFakeDeviceSetup.ts',workers:1,retries:0,reporter:'list',
 use:{baseURL:'http://127.0.0.1:5187',trace:'retain-on-failure'},
 projects:[{name:'synthetic audio and MIDI',use:{...devices['Desktop Chrome'],channel:'chromium',launchOptions:{args:['--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${fixture}`]}}}],
 webServer:{command:'npm run preview -- --host 127.0.0.1 --port 5187 --strictPort',url:'http://127.0.0.1:5187',reuseExistingServer:false}
});
