import {expect,type BrowserContext} from '@playwright/test';

// Calibrate against independent native HTML, never against the app under test.
// OS WebKit settings can exclude buttons from plain Tab; CI platforms differ.
export async function nativeControlKeys(context:BrowserContext){
 const probe=await context.newPage();
 try{
  await probe.setContent('<h1 id="heading" tabindex="-1">Start</h1><button id="first">First</button><button id="second">Second</button><input id="input" aria-label="Input">');
  for(const forward of ['Tab','Alt+Tab']){
   await probe.locator('#heading').focus();await probe.keyboard.press(forward);
   if(!await probe.locator('#first').evaluate(node=>node===document.activeElement))continue;
   const backward=forward==='Tab'?'Shift+Tab':'Alt+Shift+Tab';
   await probe.keyboard.press(forward);await expect(probe.locator('#second')).toBeFocused();
   await probe.keyboard.press(backward);await expect(probe.locator('#first')).toBeFocused();
   return {forward,backward};
  }
  throw new Error('Neither native Tab policy reaches buttons; keyboard environment cannot be validated');
 }finally{await probe.close();}
}
