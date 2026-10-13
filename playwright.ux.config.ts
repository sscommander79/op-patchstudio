import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:'**/ux-journeys.spec.ts',workers:2,reporter:'list',use:{...base.use,baseURL:'http://127.0.0.1:5297'},webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5297 --strictPort',url:'http://127.0.0.1:5297',reuseExistingServer:false}});
