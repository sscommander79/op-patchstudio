import {expect,test} from './control-audit-test';
import {gotoWorkspace} from './workspace-actions';

// Run only with the isolated fake-device configuration; never touches physical devices.
for(const finishAction of ['Continue editing','Save to library','Review OP-XY export'])test(`guided hardware flow checks captures and finishes with ${finishAction}`,async({page,context,baseURL})=>{
  test.setTimeout(60_000);
  test.skip(!process.env.PLAYWRIGHT_FAKE_AUDIO_FILE,'Requires explicitly configured fake audio');
  if(!baseURL)throw new Error('A local test origin is required');
  await page.addInitScript(()=>{
    const messages:number[][]=[];
    class FakeOutput extends EventTarget {
      id='guided-test-output';name='Guided test MIDI';manufacturer='Test';type='output';state='connected';connection='open';onstatechange=null;
      send(data:Uint8Array|number[]){messages.push(Array.from(data));}clear(){}
      async open(){this.connection='open';return this;}async close(){this.connection='closed';return this;}
    }
    const output=new FakeOutput();
    const access=Object.assign(new EventTarget(),{inputs:new Map(),outputs:new Map([[output.id,output]]),sysexEnabled:false,onstatechange:null});
    let requests=0;
    Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>{requests++;return access;}});
    Object.defineProperty(window,'guidedTestEvidence',{get:()=>({requests,messages})});
  });
  await context.grantPermissions(['microphone'],{origin:new URL(baseURL).origin});
  await gotoWorkspace(page,'multisample');
  await page.getByLabel('Instrument name',{exact:true}).fill('Guided audit capture');
  await page.getByLabel('Instrument name',{exact:true}).blur();
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Overview',exact:true}).click();
  await page.getByRole('button',{name:'Setup guide: multisample a synth'}).click();
  await page.getByRole('button',{name:'Continue to setup'}).click();
  await page.getByRole('button',{name:'Open editor and Record takes'}).click();
  const recorder=page.getByRole('dialog',{name:'Record takes'});
  await expect(recorder.getByRole('heading',{name:'Connect and check',exact:true})).toBeVisible();
  await expect(recorder.getByRole('heading',{name:'Review tray'})).toBeHidden();
  const evidence=()=>page.evaluate(()=>Reflect.get(window,'guidedTestEvidence') as {requests:number;messages:number[][]});
  expect((await evidence()).requests).toBe(0);
  await expect(recorder.getByRole('button',{name:'Continue to capture range'})).toBeDisabled();
  const devices=await page.evaluate(()=>navigator.mediaDevices.enumerateDevices());
  const inputs=devices.filter(device=>device.kind==='audioinput');
  expect(inputs.length).toBeGreaterThan(0);
  expect(inputs.every(device=>device.label.startsWith('Fake '))).toBe(true);
  await recorder.getByLabel('Guided audio input').selectOption(inputs.find(device=>device.label==='Fake Audio Input 1')?.deviceId??inputs[0].deviceId);
  await recorder.getByRole('button',{name:'Enable MIDI',exact:true}).click();
  await recorder.getByLabel('MIDI output').selectOption('guided-test-output');
  await recorder.getByRole('button',{name:'Check sound on one note'}).click();
  await expect(recorder.getByRole('button',{name:'Audition check note'})).toBeEnabled({timeout:15_000});
  expect((await evidence()).messages).toEqual([[0x90,48,100],[0x80,48,0]]);
  await expect(recorder.locator('input[aria-label^="Root note for take"]')).toHaveCount(0);
  await recorder.getByRole('button',{name:'Audition check note'}).click();
  await recorder.getByRole('button',{name:'Stop check preview'}).click();
  await recorder.getByRole('checkbox',{name:/I heard the intended instrument/}).check();
  await recorder.getByRole('button',{name:'Continue to capture range'}).click();
  await recorder.getByLabel('End note',{exact:true}).fill('54');
  await recorder.getByRole('button',{name:'Start automatic capture'}).click();
  await expect(recorder.getByRole('heading',{name:'Review tray'})).toBeVisible({timeout:15_000});
  await expect(recorder.locator('input[aria-label^="Root note for take"]')).toHaveCount(2);
  expect(await recorder.locator('input[aria-label^="Root note for take"]').evaluateAll(nodes=>nodes.map(node=>(node as HTMLInputElement).value))).toEqual(['48','54']);
  expect((await evidence()).messages).toEqual([[0x90,48,100],[0x80,48,0],[0x90,48,100],[0x80,48,0],[0x90,54,100],[0x80,54,0]]);
  await recorder.getByRole('button',{name:'Recording help'}).click();
  await expect(page.getByRole('dialog',{name:'Help',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(recorder.locator('input[aria-label^="Root note for take"]')).toHaveCount(2);
  await recorder.getByRole('button',{name:'Add selected takes'}).click();
  await expect(recorder.getByRole('heading',{name:'2 takes added to this multisample instrument'})).toBeVisible();
  await expect(recorder.getByRole('heading',{name:'Review tray'})).toBeHidden();
  await expect(recorder.getByRole('button',{name:'Save to library',exact:true})).toBeVisible();
  await expect(recorder.getByRole('button',{name:'Review OP-XY export'})).toBeVisible();
  await recorder.getByRole('button',{name:finishAction,exact:true}).click();
  await expect(recorder).toBeHidden();
  if(finishAction==='Save to library')await expect(page.getByText('Saved Guided audit capture to the library.',{exact:true})).toBeVisible();
  if(finishAction==='Review OP-XY export')await expect(page.getByRole('dialog',{name:'Export OP-XY preset',exact:true})).toBeVisible();
});
