import {test,expect} from './control-audit-test';
import {gotoWorkspace} from './workspace-actions';
import {applyAudioImport} from './import-helpers';
function tone(name='audit-C4.wav'){
 const n=4800,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(96000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(10000*Math.sin(i/(name.startsWith('replacement')?25:20))),44+2*i);return{name,mimeType:'audio/wav',buffer:b};
}
for(const width of [1440,390])test(`multisample table ${width}px root editing replace clear and Undo`,async({page})=>{
 await page.setViewportSize({width,height:1000});await gotoWorkspace(page,'multisample');
 await page.getByLabel('choose multisample audio files').setInputFiles(tone());await applyAudioImport(page);
 await page.getByRole('button',{name:'Table',exact:true}).click();
 const root=page.getByPlaceholder('C4 or 60').first();await expect(root).toBeVisible();const original=await root.inputValue();
 await root.fill('64');await root.press('Enter');await expect(root).not.toHaveValue(original);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(root).toHaveValue(original);
 await root.fill('0');await root.press('Enter');await expect(root).toHaveValue('C-2');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(root).toHaveValue(original);
 await root.fill('Bb4');await root.press('Enter');await expect(root).toHaveValue('A#4');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(root).toHaveValue(original);
 await root.fill('invalid');await root.blur();await expect(root).toHaveValue(original);
 await page.getByRole('button',{name:'Focus',exact:true}).click();
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Replace zone',exact:true}).click();await(await chooser).setFiles(tone('replacement-C4.wav'));
 await page.getByRole('dialog',{name:'Import audio'}).getByLabel('Assignment for replacement-C4.wav').selectOption('replace');
 await applyAudioImport(page);
 await expect(page.getByText('replacement-C4.wav',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Table',exact:true}).click();
 await page.getByTitle('clear',{exact:true}).first().click();await page.getByRole('button',{name:'cancel',exact:true}).click();
 await expect(page.getByText('replacement-C4.wav',{exact:true}).first()).toBeVisible();
 await page.getByTitle('clear',{exact:true}).first().click();await page.getByRole('button',{name:'ok',exact:true}).click();
 await expect(page.getByText('replacement-C4.wav',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByText('replacement-C4.wav',{exact:true}).first()).toBeVisible();
});

for(const {width,advanceClock} of [{width:1440,advanceClock:false},{width:390,advanceClock:false},{width:1440,advanceClock:true}])test(`multisample table ${width}px supports keyboard audition${advanceClock?' while the audio clock advances':''}`,async({page,browserName})=>{
 test.skip(advanceClock&&browserName==='firefox','Firefox currentTime is task-stable; synchronous clock-advance injection is inapplicable. Ordinary Enter/Space cases still run.');
 await page.addInitScript(()=>{
  const win=window as Window & {__tableAudioStarts:number};win.__tableAudioStarts=0;
  const original=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){win.__tableAudioStarts++;return original.apply(this,args);};
 });
 await page.setViewportSize({width,height:1000});await gotoWorkspace(page,'multisample');
 await page.getByLabel('choose multisample audio files').setInputFiles(tone());await applyAudioImport(page);
 await page.getByRole('button',{name:'Table',exact:true}).click();
 if(advanceClock)await page.evaluate(()=>{
  const original=AudioParam.prototype.setValueAtTime;
  const createGain=BaseAudioContext.prototype.createGain;
  const contexts=new WeakMap<AudioParam,BaseAudioContext>();
  const probe=window as Window & {__tableClockAdvance:number};probe.__tableClockAdvance=0;
  BaseAudioContext.prototype.createGain=function(){const node=createGain.call(this);contexts.set(node.gain,this);return node;};
  let injected=false;
  AudioParam.prototype.setValueAtTime=function(...args){
   const context=contexts.get(this);
   if(!injected&&args[0]===0&&context){
    injected=true;const before=context.currentTime;const until=performance.now()+25;
    while(performance.now()<until){ /* force an audio render quantum to pass */ }
    probe.__tableClockAdvance=context.currentTime-before;
   }
   return original.apply(this,args);
  };
 });
 const play=page.getByTitle('play',{exact:true}).first();await expect(play).toBeVisible();await play.scrollIntoViewIfNeeded();await play.focus();await expect(play).toBeFocused();
 await page.keyboard.down('Enter');
 await expect.poll(()=>page.evaluate(()=>(window as Window & {__tableAudioStarts:number}).__tableAudioStarts)).toBe(1);
 await page.keyboard.up('Enter');
 await page.keyboard.down('Space');
 await expect.poll(()=>page.evaluate(()=>(window as Window & {__tableAudioStarts:number}).__tableAudioStarts)).toBe(2);
 await page.keyboard.up('Space');
 if(advanceClock)expect(await page.evaluate(()=>(window as Window & {__tableClockAdvance:number}).__tableClockAdvance)).toBeGreaterThan(0);
});
