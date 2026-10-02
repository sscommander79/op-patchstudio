import {mergeConfig} from 'vitest/config';
import base from './vite.control-audit.config';
export default mergeConfig(base,{test:{setupFiles:['./src/test/controlAuditSetup.ts'],coverage:{enabled:false}}});
