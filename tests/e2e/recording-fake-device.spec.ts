import { expect, test } from './control-audit-test';
import {expectDrumLoaded,gotoWorkspace} from './workspace-actions';

test('Chromium real getUserMedia reads only the explicit deterministic fake audio device',async({page,context,baseURL})=>{
  test.skip(!process.env.PLAYWRIGHT_FAKE_AUDIO_FILE,'Set PLAYWRIGHT_FAKE_AUDIO_FILE to an explicit generated fixture path');
  if(!baseURL)throw new Error('The fake-device gate requires its configured local origin');
  await context.grantPermissions(['microphone'],{origin:new URL(baseURL).origin});
  await gotoWorkspace(page,'drum');
  const probe=await page.evaluate(async()=>{
    const devices=await navigator.mediaDevices.enumerateDevices();
    try {const stream=await navigator.mediaDevices.getUserMedia({audio:true});const settings=stream.getAudioTracks()[0]?.getSettings();stream.getTracks().forEach(track=>track.stop());return {devices:devices.map(({kind,label,deviceId})=>({kind,label,deviceId})),settings};}
    catch(reason){const error=reason as DOMException;return {devices:devices.map(({kind,label,deviceId})=>({kind,label,deviceId})),error:{name:error.name,message:error.message}};}
  });
  expect(probe).not.toHaveProperty('error');expect(probe.devices.some(device=>device.kind==='audioinput'&&/^Fake .*Audio Input/.test(device.label))).toBe(true);expect(probe).toHaveProperty('settings.sampleRate',48_000);expect(probe).toHaveProperty('settings.channelCount',1);
  await page.getByRole('button',{name:'Record takes',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:'Record takes'});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Enable input'}).click();await expect(dialog.getByText(/State: monitoring/)).toBeVisible();
  await dialog.getByRole('button',{name:'Start recording'}).click();await expect.poll(async()=>Number((await dialog.getByText(/Take time/).textContent())?.match(/Take time ([\d.]+)/)?.[1]??0),{timeout:8_000}).toBeGreaterThan(.05);
  await dialog.getByRole('button',{name:'Stop recording'}).click();await expect(dialog.locator('input[aria-label^="Name for take"]')).toHaveCount(1);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expectDrumLoaded(page,0);
});
