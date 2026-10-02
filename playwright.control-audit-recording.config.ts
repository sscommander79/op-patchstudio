import {defineConfig} from '@playwright/test';
import base from './playwright.recording-device.config';
export default defineConfig({...base,testMatch:['recording-fake-device.spec.ts','auto-sampling.spec.ts','guided-multisample-flow.spec.ts','stem-recording-device.spec.ts'],reporter:'list',webServer:{
  command:'npx vite build --config vite.control-audit.config.ts --outDir /tmp/opstudio-control-audit-dist && npx vite preview --outDir /tmp/opstudio-control-audit-dist --host 127.0.0.1 --port 5187 --strictPort',
  url:'http://127.0.0.1:5187',reuseExistingServer:false,
}});
