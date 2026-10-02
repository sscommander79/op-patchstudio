# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: file-entry-audit.spec.ts >> multisample Browse folder reviews files and Cancel keeps the empty instrument
- Location: tests/e2e/file-entry-audit.spec.ts:9:56

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator:  getByRole('dialog', { name: 'Import audio', exact: true }).getByText('first-C4.wav', { exact: true })
Expected: visible
Received: undefined

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - main [ref=e4]:
      - generic [ref=e5]:
        - generic "Studio navigation" [ref=e6]:
          - generic [ref=e7]:
            - generic [ref=e8]:
              - strong [ref=e9]: OP–PatchStudio
              - generic [ref=e10]: Unofficial preset studio
            - navigation "Workspace" [ref=e11]:
              - button "Overview" [ref=e12] [cursor=pointer]
              - button "Library" [ref=e13] [cursor=pointer]
              - button "Transfer" [ref=e14] [cursor=pointer]
              - button "Devices" [ref=e15] [cursor=pointer]
            - generic [ref=e16]:
              - generic [ref=e17]: LOCAL WORKSPACE
              - group "Appearance" [ref=e18]:
                - generic [ref=e20] [cursor=pointer]:
                  - radio "OP-1 Field" [checked] [ref=e21]
                  - generic [ref=e27]: OP-1 Field
                - generic [ref=e28] [cursor=pointer]:
                  - radio "OP-XY" [ref=e29]
                  - generic [ref=e34]: OP-XY
              - generic [ref=e35]:
                - generic [ref=e36]: Theme
                - combobox "Theme" [ref=e37]:
                  - option "System" [selected]
                  - option "Light"
                  - option "Dark"
              - button "Help" [ref=e38] [cursor=pointer]
          - paragraph [ref=e39]:
            - generic [ref=e40]:
              - text: Studio /
              - strong [ref=e41]: Multisample editor
        - main [ref=e43]:
          - heading "Multisample editor" [level=1] [ref=e44]
          - region "Instrument project controls" [ref=e45]:
            - generic [ref=e46]:
              - generic [ref=e47]:
                - generic [ref=e48]: Instrument name
                - textbox "Instrument name" [ref=e49]
              - status [ref=e50]: Unsaved changes
              - generic [ref=e51]:
                - button "Undo" [disabled] [ref=e52]
                - button "Redo" [disabled] [ref=e53]
                - group [ref=e54]:
                  - generic "Project" [ref=e55] [cursor=pointer]
                - button "Export OP-XY" [ref=e56] [cursor=pointer]
          - region "multisample tool content" [ref=e58]:
            - generic [ref=e59]:
              - generic [ref=e60]:
                - generic [ref=e62]:
                  - region "Multisample instrument, 0 of 24 loaded" [ref=e64]:
                    - generic [ref=e65]:
                      - generic [ref=e66]:
                        - heading "multisample keys" [level=3] [ref=e67]
                        - generic [aria-hidden] [ref=e70]: 
                      - generic [ref=e71]:
                        - generic [ref=e72]:
                          - generic [aria-hidden] [ref=e73]: 
                          - text: 0 / 24 loaded
                        - button "midi" [ref=e74] [cursor=pointer]:
                          - generic [aria-hidden] [ref=e75]: 
                        - button "Pin keyboard to top" [ref=e77] [cursor=pointer]:
                          - generic [aria-hidden] [ref=e78]: 
                    - text:  
                    - generic [ref=e80]:
                      - generic [ref=e81]:
                        - button "MIDI note 0, empty" [ref=e82] [cursor=pointer]:
                          - generic [ref=e83]: C-2
                        - button "MIDI note 2, empty" [ref=e84] [cursor=pointer]
                        - button "MIDI note 4, empty" [ref=e85] [cursor=pointer]
                        - button "MIDI note 5, empty" [ref=e86] [cursor=pointer]
                        - button "MIDI note 7, empty" [ref=e87] [cursor=pointer]
                        - button "MIDI note 9, empty" [ref=e88] [cursor=pointer]
                        - button "MIDI note 11, empty" [ref=e89] [cursor=pointer]
                        - button "MIDI note 1, empty" [ref=e90] [cursor=pointer]
                        - button "MIDI note 3, empty" [ref=e91] [cursor=pointer]
                        - button "MIDI note 6, empty" [ref=e92] [cursor=pointer]
                        - button "MIDI note 8, empty" [ref=e93] [cursor=pointer]
                        - button "MIDI note 10, empty" [ref=e94] [cursor=pointer]
                      - generic [ref=e95]:
                        - button "MIDI note 12, empty" [ref=e96] [cursor=pointer]:
                          - generic [ref=e97]: C-1
                        - button "MIDI note 14, empty" [ref=e98] [cursor=pointer]
                        - button "MIDI note 16, empty" [ref=e99] [cursor=pointer]
                        - button "MIDI note 17, empty" [ref=e100] [cursor=pointer]
                        - button "MIDI note 19, empty" [ref=e101] [cursor=pointer]
                        - button "MIDI note 21, empty" [ref=e102] [cursor=pointer]
                        - button "MIDI note 23, empty" [ref=e103] [cursor=pointer]
                        - button "MIDI note 13, empty" [ref=e104] [cursor=pointer]
                        - button "MIDI note 15, empty" [ref=e105] [cursor=pointer]
                        - button "MIDI note 18, empty" [ref=e106] [cursor=pointer]
                        - button "MIDI note 20, empty" [ref=e107] [cursor=pointer]
                        - button "MIDI note 22, empty" [ref=e108] [cursor=pointer]
                      - generic [ref=e109]:
                        - button "MIDI note 24, empty" [ref=e110] [cursor=pointer]:
                          - generic [ref=e111]: C0
                        - button "MIDI note 26, empty" [ref=e112] [cursor=pointer]
                        - button "MIDI note 28, empty" [ref=e113] [cursor=pointer]
                        - button "MIDI note 29, empty" [ref=e114] [cursor=pointer]
                        - button "MIDI note 31, empty" [ref=e115] [cursor=pointer]
                        - button "MIDI note 33, empty" [ref=e116] [cursor=pointer]
                        - button "MIDI note 35, empty" [ref=e117] [cursor=pointer]
                        - button "MIDI note 25, empty" [ref=e118] [cursor=pointer]
                        - button "MIDI note 27, empty" [ref=e119] [cursor=pointer]
                        - button "MIDI note 30, empty" [ref=e120] [cursor=pointer]
                        - button "MIDI note 32, empty" [ref=e121] [cursor=pointer]
                        - button "MIDI note 34, empty" [ref=e122] [cursor=pointer]
                      - generic [ref=e123]:
                        - button "MIDI note 36, empty" [ref=e124] [cursor=pointer]:
                          - generic [ref=e125]: C1
                        - button "MIDI note 38, empty" [ref=e126] [cursor=pointer]
                        - button "MIDI note 40, empty" [ref=e127] [cursor=pointer]
                        - button "MIDI note 41, empty" [ref=e128] [cursor=pointer]
                        - button "MIDI note 43, empty" [ref=e129] [cursor=pointer]
                        - button "MIDI note 45, empty" [ref=e130] [cursor=pointer]
                        - button "MIDI note 47, empty" [ref=e131] [cursor=pointer]
                        - button "MIDI note 37, empty" [ref=e132] [cursor=pointer]
                        - button "MIDI note 39, empty" [ref=e133] [cursor=pointer]
                        - button "MIDI note 42, empty" [ref=e134] [cursor=pointer]
                        - button "MIDI note 44, empty" [ref=e135] [cursor=pointer]
                        - button "MIDI note 46, empty" [ref=e136] [cursor=pointer]
                      - generic [ref=e137]:
                        - button "MIDI note 48, empty" [ref=e138] [cursor=pointer]:
                          - generic [ref=e139]: C2
                        - button "MIDI note 50, empty" [ref=e140] [cursor=pointer]
                        - button "MIDI note 52, empty" [ref=e141] [cursor=pointer]
                        - button "MIDI note 53, empty" [ref=e142] [cursor=pointer]
                        - button "MIDI note 55, empty" [ref=e143] [cursor=pointer]
                        - button "MIDI note 57, empty" [ref=e144] [cursor=pointer]
                        - button "MIDI note 59, empty" [ref=e145] [cursor=pointer]
                        - button "MIDI note 49, empty" [ref=e146] [cursor=pointer]
                        - button "MIDI note 51, empty" [ref=e147] [cursor=pointer]
                        - button "MIDI note 54, empty" [ref=e148] [cursor=pointer]
                        - button "MIDI note 56, empty" [ref=e149] [cursor=pointer]
                        - button "MIDI note 58, empty" [ref=e150] [cursor=pointer]
                      - generic [ref=e151]:
                        - button "MIDI note 60, empty" [ref=e152] [cursor=pointer]:
                          - generic [ref=e153]: C3
                        - button "MIDI note 62, empty" [ref=e154] [cursor=pointer]
                        - button "MIDI note 64, empty" [ref=e155] [cursor=pointer]
                        - button "MIDI note 65, empty" [ref=e156] [cursor=pointer]
                        - button "MIDI note 67, empty" [ref=e157] [cursor=pointer]
                        - button "MIDI note 69, empty" [ref=e158] [cursor=pointer]
                        - button "MIDI note 71, empty" [ref=e159] [cursor=pointer]
                        - button "MIDI note 61, empty" [ref=e160] [cursor=pointer]
                        - button "MIDI note 63, empty" [ref=e161] [cursor=pointer]
                        - button "MIDI note 66, empty" [ref=e162] [cursor=pointer]
                        - button "MIDI note 68, empty" [ref=e163] [cursor=pointer]
                        - button "MIDI note 70, empty" [ref=e164] [cursor=pointer]
                      - generic [ref=e165]:
                        - button "MIDI note 72, empty" [ref=e166] [cursor=pointer]:
                          - generic [ref=e167]: C4
                        - button "MIDI note 74, empty" [ref=e168] [cursor=pointer]
                        - button "MIDI note 76, empty" [ref=e169] [cursor=pointer]
                        - button "MIDI note 77, empty" [ref=e170] [cursor=pointer]
                        - button "MIDI note 79, empty" [ref=e171] [cursor=pointer]
                        - button "MIDI note 81, empty" [ref=e172] [cursor=pointer]
                        - button "MIDI note 83, empty" [ref=e173] [cursor=pointer]
                        - button "MIDI note 73, empty" [ref=e174] [cursor=pointer]
                        - button "MIDI note 75, empty" [ref=e175] [cursor=pointer]
                        - button "MIDI note 78, empty" [ref=e176] [cursor=pointer]
                        - button "MIDI note 80, empty" [ref=e177] [cursor=pointer]
                        - button "MIDI note 82, empty" [ref=e178] [cursor=pointer]
                      - generic [ref=e179]:
                        - button "MIDI note 84, empty" [ref=e180] [cursor=pointer]:
                          - generic [ref=e181]: C5
                        - button "MIDI note 86, empty" [ref=e182] [cursor=pointer]
                        - button "MIDI note 88, empty" [ref=e183] [cursor=pointer]
                        - button "MIDI note 89, empty" [ref=e184] [cursor=pointer]
                        - button "MIDI note 91, empty" [ref=e185] [cursor=pointer]
                        - button "MIDI note 93, empty" [ref=e186] [cursor=pointer]
                        - button "MIDI note 95, empty" [ref=e187] [cursor=pointer]
                        - button "MIDI note 85, empty" [ref=e188] [cursor=pointer]
                        - button "MIDI note 87, empty" [ref=e189] [cursor=pointer]
                        - button "MIDI note 90, empty" [ref=e190] [cursor=pointer]
                        - button "MIDI note 92, empty" [ref=e191] [cursor=pointer]
                        - button "MIDI note 94, empty" [ref=e192] [cursor=pointer]
                      - generic [ref=e193]:
                        - button "MIDI note 96, empty" [ref=e194] [cursor=pointer]:
                          - generic [ref=e195]: C6
                        - button "MIDI note 98, empty" [ref=e196] [cursor=pointer]
                        - button "MIDI note 100, empty" [ref=e197] [cursor=pointer]
                        - button "MIDI note 101, empty" [ref=e198] [cursor=pointer]
                        - button "MIDI note 103, empty" [ref=e199] [cursor=pointer]
                        - button "MIDI note 105, empty" [ref=e200] [cursor=pointer]
                        - button "MIDI note 107, empty" [ref=e201] [cursor=pointer]
                        - button "MIDI note 97, empty" [ref=e202] [cursor=pointer]
                        - button "MIDI note 99, empty" [ref=e203] [cursor=pointer]
                        - button "MIDI note 102, empty" [ref=e204] [cursor=pointer]
                        - button "MIDI note 104, empty" [ref=e205] [cursor=pointer]
                        - button "MIDI note 106, empty" [ref=e206] [cursor=pointer]
                      - generic [ref=e207]:
                        - button "MIDI note 108, empty" [ref=e208] [cursor=pointer]:
                          - generic [ref=e209]: C7
                        - button "MIDI note 110, empty" [ref=e210] [cursor=pointer]
                        - button "MIDI note 112, empty" [ref=e211] [cursor=pointer]
                        - button "MIDI note 113, empty" [ref=e212] [cursor=pointer]
                        - button "MIDI note 115, empty" [ref=e213] [cursor=pointer]
                        - button "MIDI note 117, empty" [ref=e214] [cursor=pointer]
                        - button "MIDI note 119, empty" [ref=e215] [cursor=pointer]
                        - button "MIDI note 109, empty" [ref=e216] [cursor=pointer]
                        - button "MIDI note 111, empty" [ref=e217] [cursor=pointer]
                        - button "MIDI note 114, empty" [ref=e218] [cursor=pointer]
                        - button "MIDI note 116, empty" [ref=e219] [cursor=pointer]
                        - button "MIDI note 118, empty" [ref=e220] [cursor=pointer]
                      - generic [ref=e221]:
                        - button "MIDI note 120, empty" [ref=e222] [cursor=pointer]:
                          - generic [ref=e223]: C8
                        - button "MIDI note 122, empty" [ref=e224] [cursor=pointer]
                        - button "MIDI note 124, empty" [ref=e225] [cursor=pointer]
                        - button "MIDI note 125, empty" [ref=e226] [cursor=pointer]
                        - button "MIDI note 127, empty" [ref=e227] [cursor=pointer]
                        - button "MIDI note 121, empty" [ref=e228] [cursor=pointer]
                        - button "MIDI note 123, empty" [ref=e229] [cursor=pointer]
                        - button "MIDI note 126, empty" [ref=e230] [cursor=pointer]
                      - generic:
                        - generic:
                          - generic: A
                          - generic: W
                          - generic: S
                          - generic: E
                          - generic: D
                          - generic: F
                          - generic: T
                          - generic: G
                          - generic: "Y"
                          - generic: H
                          - generic: U
                          - generic: J
                        - generic: Z ◀
                        - generic: ▶ X
                  - generic [ref=e231]:
                    - button "Add sounds" [ref=e232] [cursor=pointer]
                    - button "Record takes" [ref=e233] [cursor=pointer]
                - generic [ref=e235]:
                  - generic [ref=e236]:
                    - heading "EDIT / Sample management" [level=3] [ref=e238]
                    - generic [ref=e239]:
                      - generic "Multisample workspace view" [ref=e240]:
                        - button "Focus" [pressed] [ref=e241]
                        - button "Table" [ref=e242]
                      - generic [ref=e243]:
                        - generic [ref=e244]: c3=60
                        - switch "c4=60" [ref=e245] [cursor=pointer]
                        - generic [ref=e247]: c4=60
                  - generic [ref=e248]:
                    - region "Focused multisample editor" [ref=e249]:
                      - generic [ref=e250]:
                        - heading "Add multisample zones" [level=3] [ref=e251]
                        - paragraph [ref=e252]: Load one or more sounds, then set root notes, sample bounds, loop points, envelopes, and engine settings.
                        - button "Add samples" [ref=e253] [cursor=pointer]
                    - generic "Multisample instrument actions" [ref=e254]:
                      - button "reset instrument" [ref=e255] [cursor=pointer]
                      - button "clear all" [disabled] [ref=e256]:
                        - generic [aria-hidden] [ref=e257]: 
                        - text: clear all
                      - button "browse folder" [ref=e258] [cursor=pointer]
              - group [ref=e259]:
                - generic "Preset and performance settings poly · transpose 0 · volume 69%" [ref=e260] [cursor=pointer]:
                  - text: Preset and performance settings
                  - generic [ref=e261]: poly · transpose 0 · volume 69%
                - text: 
                - option "poly" [selected]
                - option "mono"
                - option "legato"
                - text:  
                - option "random"
                - option "bass"
                - option "keys" [selected]
                - option "lead"
                - option "pad"
                - option "pluck"
                - option "sustain"
                - text:   
              - group [ref=e262]:
                - generic "Audio output and processing WAV · 44.1 kHz · 16-bit · stereo" [ref=e263] [cursor=pointer]:
                  - text: Audio output and processing
                  - generic [ref=e264]: WAV · 44.1 kHz · 16-bit · stereo
                - text: 
                - option "original"
                - option "44.1 khz" [selected]
                - option "22 khz"
                - option "11 khz"
                - option "original"
                - option "24-bit"
                - option "16-bit" [selected]
                - option "12-bit"
                - option "8-bit"
                - option "original" [selected]
                - option "mono"
                - text:  
      - generic [ref=e265]:
        - generic [ref=e266]: OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.OP-XY, OP-1 and OP-Z are registered trademarks of teenage engineering.
        - generic [ref=e267]:
          - generic [ref=e268]: proudly open source
          - generic [ref=e269]: "|"
          - link "github fork" [ref=e270] [cursor=pointer]:
            - /url: https://github.com/sscommander79/op-patchstudio
          - generic [ref=e271]: "|"
          - generic [ref=e272]: v0.16.0 · build 387fe5f1
        - generic [ref=e273]:
          - text: fork maintained by sscommander79 · original project by
          - link "joseph-holland" [ref=e274] [cursor=pointer]:
            - /url: https://github.com/joseph-holland
        - generic [ref=e275]:
          - text: inspired by the awesome
          - link "opxy-drum-tool" [ref=e276] [cursor=pointer]:
            - /url: https://buba447.github.io/opxy-drum-tool/
          - text: by zeitgeese
    - dialog "Import audio" [ref=e277]:
      - heading "Import audio" [level=2] [ref=e278]
      - paragraph [ref=e279]: 2 decoded files ready for review. Browser import keeps original bytes; OP-XY export uses the output format selected below the instrument.
      - list [ref=e280]:
        - listitem [ref=e281]:
          - generic [ref=e282]:
            - checkbox "Include second-D4.wav" [checked] [ref=e283]
            - text: second-D4.wav
          - generic [ref=e284]: WAV source · source bit depth 16-bit · source rate 48000 Hz · source channels 1 · decoded 44100 Hz / 1 ch
          - generic [ref=e285]: note detected from destination or filename
          - generic [ref=e286]:
            - text: Root note
            - spinbutton "Root note for second-D4.wav" [ref=e287]: "74"
          - combobox "Assignment for second-D4.wav" [ref=e288]:
            - option "Keep for review"
            - option "Use empty root note" [selected]
        - listitem [ref=e289]:
          - generic [ref=e290]:
            - checkbox "Include first-C4.wav" [checked] [ref=e291]
            - text: first-C4.wav
          - generic [ref=e292]: WAV source · source bit depth 16-bit · source rate 48000 Hz · source channels 1 · decoded 44100 Hz / 1 ch
          - generic [ref=e293]: note detected from destination or filename
          - generic [ref=e294]:
            - text: Root note
            - spinbutton "Root note for first-C4.wav" [ref=e295]: "72"
          - combobox "Assignment for first-C4.wav" [ref=e296]:
            - option "Keep for review"
            - option "Use empty root note" [selected]
      - button "Apply import" [ref=e297]
      - button "Cancel import" [active] [ref=e298]
  - generic:
    - generic:
      - heading "keyboard controls" [level=3]:
        - generic [aria-hidden]: 
        - text: keyboard controls
      - paragraph:
        - strong: "load:"
        - text: select an empty key and use Add sounds, or drag audio directly onto a key
      - paragraph:
        - strong: "play:"
        - text: use keyboard keys (
        - strong: A-J, W, E, T, Y, U
        - text: ) &
        - strong: Z/X
        - text: to change octave
      - paragraph:
        - strong: "pin:"
        - text: keep the keyboard fixed using the pin icon
  - generic:
    - generic:
      - generic:
        - paragraph: snap all sample markers to zero crossings for cleaner audio. this does not affect future imports.
```

# Test source

```ts
  1  | import {test,expect} from './control-audit-test';
  2  | import {gotoWorkspace,openAdvanced} from './workspace-actions';
  3  | import {applyAudioImport} from './import-helpers';
  4  | import JSZip from 'jszip';
  5  | import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
  6  | import {tmpdir} from 'node:os';
  7  | import path from 'node:path';
  8  | function tone(name='entry.wav',phase=0){const n=4800,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(96000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(12000*Math.sin(i/(20+phase))),44+i*2);return{name,mimeType:'audio/wav',buffer:b};}
  9  | for(const workspace of ['drum','multisample'] as const)test(`${workspace} Browse folder reviews files and Cancel keeps the empty instrument`,async({page})=>{
  10 |  const folder=await mkdtemp(path.join(tmpdir(),'opstudio-folder-test-'));try{
  11 |   for(const [index,name] of ['first-C4.wav','second-D4.wav'].entries())await writeFile(path.join(folder,name),tone(name,index).buffer);
  12 |   await gotoWorkspace(page,workspace);const choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'browse folder',exact:true}).click();await(await choosing).setFiles(folder);
> 13 |   const review=page.getByRole('dialog',{name:'Import audio',exact:true});for(const name of ['first-C4.wav','second-D4.wav'])await expect(review.getByText(name,{exact:true})).toBeVisible();await review.getByRole('button',{name:'Cancel import',exact:true}).click();await expect(review).toBeHidden();await expect(page.getByRole('region',{name:workspace==='drum'?'Drum pad instrument, 0 of 24 loaded':'Multisample instrument, 0 of 24 loaded',exact:true})).toBeVisible();
     |                                                                                                                                                                               ^ Error: expect(locator).toBeVisible() failed
  14 |  }finally{await rm(folder,{recursive:true,force:true});}
  15 | });
  16 | test('multisample patch settings chooser imports atomically and supports Undo',async({page})=>{
  17 |  await gotoWorkspace(page,'multisample');const settings=await openAdvanced(page,/Preset and performance settings/);await settings.getByRole('heading',{name:'advanced',exact:true}).click();const slider=settings.locator('#multisample-transpose');const before=await slider.getAttribute('aria-valuenow');const choosing=page.waitForEvent('filechooser');await settings.getByRole('button',{name:/import patch\.json/}).click();await(await choosing).setFiles({name:'patch.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({type:'multisampler',engine:{playmode:'mono',transpose:9}}))});await expect(page.getByText('successfully imported multisample preset settings',{exact:true})).toBeVisible();await expect(slider).toHaveAttribute('aria-valuenow','9');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(slider).toHaveAttribute('aria-valuenow',before!);
  18 | });
  19 | test('drum import rejects malformed OP-1 files, auditions unassigned audio, and opens setup help',async({page})=>{
  20 |  await page.addInitScript(()=>{const start=AudioBufferSourceNode.prototype.start;Object.defineProperty(window,'__fileEntryPlays',{value:0,writable:true});AudioBufferSourceNode.prototype.start=function(...args:Parameters<AudioBufferSourceNode['start']>){Reflect.set(window,'__fileEntryPlays',Reflect.get(window,'__fileEntryPlays')+1);return start.apply(this,args);};});
  21 |  await gotoWorkspace(page,'drum');let choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'import OP-1 preset',exact:true}).click();await(await choosing).setFiles({name:'invalid.aiff',mimeType:'audio/aiff',buffer:Buffer.from('invalid')});await expect(page.getByText(/does not appear to be a valid OP-1 drum preset/)).toBeVisible();
  22 |  choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add sounds',exact:true}).click();await(await choosing).setFiles([tone(),tone('spare.wav',1)]);const review=page.getByRole('dialog',{name:'Import audio',exact:true});await review.getByLabel('Destination for entry.wav',{exact:true}).selectOption('unassigned');await applyAudioImport(page);const tray=page.getByRole('region',{name:'Unassigned sounds',exact:true});await expect(tray.getByRole('button',{name:'entry.wav',exact:true})).toBeVisible();await tray.getByRole('button',{name:'Play',exact:true}).first().click();await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__fileEntryPlays'))).toBeGreaterThan(0);
  23 |  const guide=page.locator('details[aria-label="Kit setup guide"]');await guide.locator('summary').click();await guide.getByRole('button',{name:'Setup help',exact:true}).click();await expect(page.getByRole('dialog',{name:'Help',exact:true})).toBeVisible();
  24 | });
  25 | test('mobile empty drum table browse loads the chosen pad',async({page})=>{
  26 |  await page.setViewportSize({width:390,height:1000});await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Table',exact:true}).click();const choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'tap to browse for audio file',exact:true}).first().click();await(await choosing).setFiles(tone());await expect(page.getByRole('region',{name:'Drum pad instrument, 1 of 24 loaded',exact:true})).toBeVisible();await expect(page.getByText('entry.wav',{exact:true}).first()).toBeVisible();
  27 | });
  28 | 
  29 | test('multisample import inclusion and root edits commit together and Undo',async({page})=>{
  30 |  await gotoWorkspace(page,'multisample');const choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add samples',exact:true}).click();await(await choosing).setFiles([tone('chosen.wav'),tone('excluded.wav',2)]);
  31 |  const review=page.getByRole('dialog',{name:'Import audio',exact:true});await review.getByLabel('Root note for chosen.wav',{exact:true}).fill('65');await review.getByLabel('Include chosen.wav',{exact:true}).check();await review.getByLabel('Include excluded.wav',{exact:true}).uncheck();await review.getByRole('button',{name:'Apply import',exact:true}).click();await expect(review.getByLabel('Include chosen.wav',{exact:true})).toHaveCount(0);await expect(review.getByLabel('Include excluded.wav',{exact:true})).toBeVisible();await review.getByRole('button',{name:'Cancel import',exact:true}).click();
  32 |  await expect(page.getByRole('region',{name:'Multisample instrument, 1 of 24 loaded',exact:true})).toBeVisible();await page.getByRole('button',{name:'Table',exact:true}).click();await expect(page.getByPlaceholder('C4 or 60').first()).toHaveValue('F3');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByRole('region',{name:'Multisample instrument, 0 of 24 loaded',exact:true})).toBeVisible();
  33 | });
  34 | 
  35 | test('export preflight edits name and includes unassigned sound only when requested',async({page,context})=>{
  36 |  await context.route(/^https:\/\//,route=>route.fulfill({status:200,contentType:'text/html',body:'Isolated guide'}));
  37 |  await gotoWorkspace(page,'drum');const choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add sounds',exact:true}).click();await(await choosing).setFiles([tone('kick.wav'),tone('spare.wav',2)]);
  38 |  const review=page.getByRole('dialog',{name:'Import audio',exact:true});await review.getByLabel('Destination for kick.wav',{exact:true}).selectOption('pad:0');await review.getByLabel('Destination for spare.wav',{exact:true}).selectOption('unassigned');await applyAudioImport(page);
  39 |  await page.getByRole('button',{name:'Export OP-XY',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Export OP-XY preset',exact:true});await dialog.getByLabel('Instrument name',{exact:true}).fill('Audited export');await dialog.getByText('File naming and format',{exact:true}).click();await expect(dialog.getByRole('combobox',{name:'Audio format',exact:true})).toBeVisible();
  40 |  const option=dialog.getByRole('checkbox',{name:/Include 1 unassigned sample/});await expect(option).not.toBeChecked();
  41 |  for(const include of [false,true]){
  42 |   await option.setChecked(include);const pending=page.waitForEvent('download');await dialog.getByRole('button',{name:'Download preset',exact:true}).click();const download=await pending;expect(await download.failure()).toBeNull();const zip=await JSZip.loadAsync(await readFile((await download.path())!));const patch=JSON.parse(await zip.file('patch.json')!.async('string'));expect(patch.regions).toHaveLength(1);expect(Object.keys(zip.files).filter(name=>/\.wav$/i.test(name))).toHaveLength(include?2:1);for(const region of patch.regions)expect(zip.file(region.sample)).not.toBeNull();
  43 |  }
  44 |  const link=dialog.getByRole('link',{name:'Open the current OP-XY transfer guide'}),href=await link.getAttribute('href');const opening=page.waitForEvent('popup');await link.click();const popup=await opening;await expect(popup).toHaveURL(href!);await popup.close();await dialog.press('Escape');await expect(dialog).toBeHidden();await expect(page.getByRole('textbox',{name:'Instrument name',exact:true})).toHaveValue('Audited export');
  45 | });
  46 | 
  47 | test('multisample zone selection and note naming do not change roots',async({page})=>{
  48 |  await gotoWorkspace(page,'multisample');const choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add samples',exact:true}).click();await(await choosing).setFiles([tone('first-C4.wav'),tone('second-D4.wav',2)]);await applyAudioImport(page);
  49 |  const editor=page.getByRole('region',{name:'Focused multisample editor'});await editor.getByRole('combobox',{name:'Selected multisample zone'}).selectOption('1');await expect(editor.getByRole('heading',{level:3})).toHaveText('first-C4.wav');const root=await editor.getByLabel('Root note',{exact:true}).inputValue();const naming=page.getByRole('switch',{name:'c4=60',exact:true});const before=await naming.getAttribute('aria-checked');await naming.focus();await naming.press('Space');await expect(naming).toHaveAttribute('aria-checked',before==='true'?'false':'true');await expect(editor.getByLabel('Root note',{exact:true})).toHaveValue(root);await naming.press('Enter');await expect(naming).toHaveAttribute('aria-checked',before!);
  50 | });
  51 | 
  52 | for(const width of [1440,390])test(`multisample empty table ${width}px browse and waveform draft cancellation`,async({page})=>{
  53 |  await page.setViewportSize({width,height:1000});await gotoWorkspace(page,'multisample');await page.getByRole('button',{name:'Table',exact:true}).click();const choosing=page.waitForEvent('filechooser');await page.getByText('no samples loaded',{exact:true}).click();await(await choosing).setFiles(tone('table-C4.wav'));await applyAudioImport(page);await expect(page.getByRole('region',{name:'Multisample instrument, 1 of 24 loaded'})).toBeVisible();await page.getByTitle('zoom and edit',{exact:true}).first().click();const zoom=page.getByRole('dialog',{name:'zoom and edit',exact:true});await zoom.getByLabel('Sample start frames').fill('200');await zoom.getByRole('button',{name:'save markers',exact:true}).click();await page.getByTitle('zoom and edit',{exact:true}).first().click();await expect(zoom.getByLabel('Sample start frames')).toHaveValue('200');await zoom.getByLabel('Sample start frames').fill('400');await zoom.press('Escape');await page.getByTitle('zoom and edit',{exact:true}).first().click();await expect(zoom.getByLabel('Sample start frames')).toHaveValue('200');await zoom.getByRole('button',{name:'cancel',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByTitle('zoom and edit',{exact:true}).first().click();await expect(zoom.getByLabel('Sample start frames')).toHaveValue('0');
  54 | });
  55 | 
  56 | test('organize row drops choose the intended empty pads',async({page})=>{
  57 |  await page.setViewportSize({width:1440,height:1000});await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'organize',exact:true}).click();
  58 |  for(const [row,pad] of [['lower',0],['upper',1]] as const){const zone=page.getByRole('region',{name:new RegExp(`Drop zone for ${row} row`)});const file=tone(`${row}.wav`,pad);const transfer=await page.evaluateHandle(({name,bytes})=>{const data=new DataTransfer();data.items.add(new File([new Uint8Array(bytes)],name,{type:'audio/wav'}));return data;},{name:file.name,bytes:[...file.buffer]});await zone.dispatchEvent('dragover',{dataTransfer:transfer});await zone.dispatchEvent('dragleave',{dataTransfer:transfer});await zone.dispatchEvent('drop',{dataTransfer:transfer});await transfer.dispose();await applyAudioImport(page);await expect(page.getByRole('region',{name:`Drum pad instrument, ${pad+1} of 24 loaded`})).toBeVisible();await page.locator(`[data-drum-pad="${pad}"]`).click();await expect(page.getByRole('region',{name:'Focused sample editor'})).toContainText(file.name);}
  59 | });
  60 | 
  61 | test('wide drum MIDI audition channel persists with an isolated MIDI stub',async({page})=>{
  62 |  await page.setViewportSize({width:1440,height:1000});
  63 |  await page.addInitScript(()=>{Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>Object.assign(new EventTarget(),{inputs:new Map(),outputs:new Map(),sysexEnabled:false,onstatechange:null})});});await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'midi',exact:true}).click();await page.getByRole('button',{name:/connect midi devices/}).click();const channel=page.getByRole('combobox',{name:'MIDI audition channel',exact:true});await channel.selectOption('16');await expect(channel).toHaveValue('16');await expect.poll(()=>page.evaluate(()=>localStorage.getItem('midi-channel'))).toBe('16');
  64 | });
  65 | 
  66 | test('an empty multisample key selects the root for the nearby Add sounds chooser',async({page})=>{
  67 |  await gotoWorkspace(page,'multisample');const keyboard=page.getByRole('region',{name:'Multisample instrument, 0 of 24 loaded'});await keyboard.locator('[data-multisample-root="60"]').click();const choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add sounds to MIDI 60',exact:true}).click();await(await choosing).setFiles(tone('target.wav'));await applyAudioImport(page);const editor=page.getByRole('region',{name:'Focused multisample editor'});await expect(editor.getByLabel('Root note',{exact:true})).toHaveValue('60');await expect(editor.getByRole('heading',{level:3})).toHaveText('target.wav');
  68 | });
  69 | 
  70 | test('sample settings waveform drag is saved once and Undo restores markers',async({page})=>{
  71 |  await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();await page.getByRole('button',{name:'Table',exact:true}).click();await page.getByTitle('settings',{exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'sample options',exact:true});const canvas=dialog.locator('canvas').first(),box=await canvas.boundingBox();expect(box).not.toBeNull();await page.mouse.move(box!.x+1,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width*.2,box!.y+box!.height/2,{steps:3});await page.mouse.up();await dialog.getByRole('button',{name:'save',exact:true}).click();await page.getByRole('button',{name:'Focus',exact:true}).click();const marker=page.getByRole('region',{name:'Focused sample editor'}).getByLabel('In point (seconds)',{exact:true});await expect.poll(async()=>Number(await marker.inputValue())).toBeGreaterThan(0);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(marker).toHaveValue('0');
  72 | });
  73 | 
```