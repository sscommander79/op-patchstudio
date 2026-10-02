import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,reporter:'list',webServer:{
  command:'npx vite --config vite.control-audit.config.ts --host 127.0.0.1 --port 5187 --strictPort',
  url:'http://127.0.0.1:5187',reuseExistingServer:false,
}});
