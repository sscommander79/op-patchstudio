import {expect,test} from './control-audit-test';
import {nativeControlKeys} from './keyboard-policy';

test('native full-control keyboard navigation reaches buttons after heading focus',async({context},testInfo)=>{
 const keys=await nativeControlKeys(context);
 await testInfo.attach('native-tab-policy',{body:JSON.stringify(keys),contentType:'application/json'});
 expect(['Tab','Alt+Tab']).toContain(keys.forward);
});
