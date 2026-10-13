import {expect,test} from './control-audit-test';
import {expectMultisampleLoaded,gotoWorkspace,openWorkspace} from './workspace-actions';

// Run only with the isolated fake-device configuration; never touches physical devices.
test('guided hardware flow keeps the finished take, reports the missing note and asks for a new connection check',async({page,context,baseURL})=>{
  test.setTimeout(90_000);
  test.skip(!process.env.PLAYWRIGHT_FAKE_AUDIO_FILE,'Requires explicitly configured fake audio');
  if(!baseURL)throw new Error('A local test origin is required');
  await page.addInitScript(()=>{
    const messages:number[][]=[],rejected:number[][]=[];
    class FakeOutput extends EventTarget {
      id='guided-test-output';name='Guided test MIDI';manufacturer='Test';type='output';state='connected';connection='open';onstatechange=null;
      // Note-on 54 always fails, so the range stops after the first finished note.
      send(data:Uint8Array|number[]){const message=Array.from(data);if((message[0]&0xf0)===0x90&&message[1]===54&&message[2]>0){rejected.push(message);throw new Error('Synthetic MIDI failure on note 54');}messages.push(message);}clear(){}
      async open(){this.connection='open';return this;}async close(){this.connection='closed';return this;}
    }
    const output=new FakeOutput();
    const access=Object.assign(new EventTarget(),{inputs:new Map(),outputs:new Map([[output.id,output]]),sysexEnabled:false,onstatechange:null});
    let requests=0;
    Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>{requests++;return access;}});
    Object.defineProperty(window,'guidedTestEvidence',{get:()=>({requests,messages,rejected})});
  });
  await context.grantPermissions(['microphone'],{origin:new URL(baseURL).origin});
  await gotoWorkspace(page,'multisample');
  await expectMultisampleLoaded(page,0);
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Overview',exact:true}).click();
  await page.getByRole('button',{name:'Choose a source',exact:true}).click();
  await page.getByRole('button',{name:/A hardware instrument/}).click();
  await page.getByRole('button',{name:'Connect and check sound',exact:true}).click();
  const recorder=page.getByRole('dialog',{name:'Record takes'});
  const heading=(name:string)=>recorder.getByRole('heading',{name,exact:true});
  const roots=recorder.locator('input[aria-label^="Root note for take"]');
  const rootValues=()=>roots.evaluateAll(nodes=>nodes.map(node=>(node as HTMLInputElement).value));
  const currentStep=recorder.getByRole('navigation',{name:'Automatic multisampling steps'}).locator('[aria-current="step"]');
  const unfinished=recorder.getByRole('region',{name:'Unfinished notes'});
  const recordMissing54=unfinished.getByRole('button',{name:/^Record missing .*\b54\)?$/});
  const checkConnection=recorder.getByRole('button',{name:'Check connection before continuing',exact:true});
  const evidence=()=>page.evaluate(()=>Reflect.get(window,'guidedTestEvidence') as {requests:number;messages:number[][];rejected:number[][]});
  const sent=[[0x90,48,100],[0x80,48,0],[0x90,48,100],[0x80,48,0]];
  await expect(heading('Connect and check')).toBeVisible();
  expect((await evidence()).requests).toBe(0);
  const devices=await page.evaluate(()=>navigator.mediaDevices.enumerateDevices());
  const inputs=devices.filter(device=>device.kind==='audioinput');
  expect(inputs.length).toBeGreaterThan(0);
  expect(inputs.every(device=>device.label.startsWith('Fake '))).toBe(true);
  await recorder.getByLabel('Guided audio input').selectOption(inputs.find(device=>device.label==='Fake Audio Input 1')?.deviceId??inputs[0].deviceId);
  await recorder.getByRole('button',{name:'Enable MIDI',exact:true}).click();
  await recorder.getByLabel('MIDI output').selectOption('guided-test-output');
  await recorder.getByRole('button',{name:'Play a test note'}).click();
  await expect(recorder.getByRole('button',{name:'Listen to test recording'})).toBeEnabled({timeout:15_000});
  expect((await evidence()).messages).toEqual(sent.slice(0,2));
  await recorder.getByRole('button',{name:'Listen to test recording'}).click();
  await recorder.getByRole('button',{name:'Stop listening'}).click();
  await recorder.getByRole('checkbox',{name:/I heard the intended instrument/}).check();
  await recorder.getByRole('button',{name:'Continue to record'}).click();
  await recorder.getByLabel('End note',{exact:true}).fill('54');
  await recorder.getByRole('button',{name:'Start automatic recording'}).click();

  // The run ends itself on the rejected note-on: 48 stays in review, 54 is reported missing.
  await expect(heading('Review tray')).toBeVisible({timeout:20_000});
  await expect(heading('Review and retry')).toBeVisible();
  await expect(currentStep).toHaveText('4. Review');
  await expect(roots).toHaveCount(1);
  expect(await rootValues()).toEqual(['48']);
  await expect(recorder.getByRole('alert').filter({hasText:'Synthetic MIDI failure on note 54'})).toBeVisible();
  await expect(heading('Finish the missing notes')).toBeVisible();
  await expect(recordMissing54).toBeEnabled();
  await expect(unfinished.getByRole('button')).toHaveCount(1);
  // A failed send does not invalidate the confirmed check, so the connection prompt is absent here.
  await expect(checkConnection).toHaveCount(0);
  expect(await evidence()).toMatchObject({requests:1,messages:sent,rejected:[[0x90,54,100]]});

  await recorder.getByRole('button',{name:'Add selected takes'}).click();
  await expect(heading('1 take added to this multisample instrument')).toBeVisible();
  await expect(heading('Review tray')).toBeHidden();
  await expect(recorder.getByText('1 planned note was not recorded. Completed takes are already in your instrument.',{exact:true})).toBeVisible();

  // Record missing notes returns to review, where the committed take has left the tray.
  await recorder.getByRole('button',{name:'Record missing notes',exact:true}).click();
  await expect(heading('Review and retry')).toBeVisible();
  await expect(heading('Review tray')).toBeVisible();
  await expect(heading('1 take added to this multisample instrument')).toBeHidden();
  await expect(heading('Record')).toBeHidden();
  await expect(heading('Connect and check')).toBeHidden();
  await expect(currentStep).toHaveText('4. Review');
  await expect(roots).toHaveCount(0);
  await expect(recorder.getByText('No takes yet. The project changes only after Add selected takes.',{exact:true})).toBeVisible();
  await expect(heading('Finish the missing notes')).toBeVisible();
  await expect(recordMissing54).toBeEnabled();
  await expect(checkConnection).toHaveCount(0);

  // Hold duration belongs to the Record step; changing it invalidates the confirmed check.
  await recorder.getByRole('button',{name:'Record more notes',exact:true}).click();
  await expect(heading('Record')).toBeVisible();
  await expect(heading('Review tray')).toBeHidden();
  await expect(currentStep).toHaveText('3. Record');
  await expect(recordMissing54).toBeEnabled();
  await recorder.getByLabel('Hold duration',{exact:true}).fill('1.5');
  await expect(recorder.getByRole('alert').filter({hasText:'The sound check is no longer valid for these settings. Return to Connect and check again.'})).toBeVisible();
  await expect(recorder.getByRole('button',{name:'Start automatic recording'})).toBeDisabled();
  await expect(recordMissing54).toBeDisabled();
  await expect(unfinished.getByRole('button')).toHaveCount(2);
  await expect(checkConnection).toBeEnabled();

  await checkConnection.click();
  await expect(heading('Connect and check')).toBeVisible();
  await expect(heading('Record')).toBeHidden();
  await expect(heading('Review and retry')).toBeHidden();
  await expect(heading('Review tray')).toBeHidden();
  await expect(currentStep).toHaveText('2. Check');
  await expect(unfinished).toHaveCount(0);
  await expect(recorder.getByRole('checkbox',{name:/I heard the intended instrument/})).toHaveCount(0);
  await expect(recorder.getByRole('button',{name:'Listen to test recording'})).toHaveCount(0);
  // The missing note is remembered across the route: the way forward is back to review, not a new range.
  await expect(recorder.getByRole('button',{name:'Return to review retries',exact:true})).toBeDisabled();
  await expect(recorder.getByRole('button',{name:'Continue to record'})).toHaveCount(0);
  await expect(recorder.getByRole('status').filter({hasText:'Before recording: play a test note'})).toBeVisible();
  expect(await evidence()).toMatchObject({requests:1,messages:sent,rejected:[[0x90,54,100]]});

  // Nothing is left in review, so closing needs no discard confirmation; only root 48 reached the project.
  await recorder.getByRole('button',{name:'Close',exact:true}).click();
  await expect(recorder).toBeHidden();
  await openWorkspace(page,'multisample');
  await expectMultisampleLoaded(page,1);
});
