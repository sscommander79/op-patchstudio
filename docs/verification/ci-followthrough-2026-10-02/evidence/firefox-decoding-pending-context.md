# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: slicing.spec.ts >> slicer groups, disclosure keyboard access and fixed footer at 1280x720
- Location: tests/e2e/slicing.spec.ts:273:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: 'slice audio' }).getByText('Sound 1 of 3', { exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: 'slice audio' }).getByText('Sound 1 of 3', { exact: true }) with timeout 5000ms
  - waiting for getByRole('dialog', { name: 'slice audio' }).getByText('Sound 1 of 3', { exact: true })

```

```yaml
- main:
  - strong: OP–PatchStudio
  - text: Unofficial preset studio
  - navigation "Workspace":
    - button "Overview"
    - button "Library"
    - button "Transfer"
    - button "Devices"
  - text: LOCAL WORKSPACE
  - group "Appearance":
    - text: Appearance
    - radio "OP-1 Field" [checked]
    - text: OP-1 Field
    - radio "OP-XY"
    - text: OP-XY
  - text: Theme
  - combobox "Theme":
    - option "System" [selected]
    - option "Light"
    - option "Dark"
  - button "Help"
  - paragraph:
    - text: Studio /
    - strong: Drum kit editor
  - main:
    - heading "Drum kit editor" [level=1]
    - region "Instrument project controls":
      - text: Instrument name
      - textbox "Instrument name"
      - status: Unsaved changes
      - button "Undo" [disabled]
      - button "Redo" [disabled]
      - group: Project
      - button "Export OP-XY"
    - region "drum tool content":
      - region "Studio Seed demo kit":
        - paragraph: STARTER KIT
        - strong: Studio Seed
        - paragraph: Ten deterministic synthesized drum voices. Loading makes no sound until you play a pad.
        - button "Load demo kit"
      - group "Kit setup guide": Kit setup guide Optional
      - region "Drum pad instrument, 0 of 24 loaded":
        - heading "PERFORMANCE / drum pads" [level=3]
        - text: 0 / 24 loaded
        - button "organize"
        - button "midi"
        - button "Pin keyboard to top"
        - group "Drum keyboard":
          - group "Lower octave drum keys":
            - paragraph: Lower pads · 1–12 Computer keys active
            - button "KD2 drum key W":
              - strong: KD2
              - text: EMPTY
            - button "SD2 drum key E":
              - strong: SD2
              - text: EMPTY
            - button "CLP drum key R":
              - strong: CLP
              - text: EMPTY
            - button "CH drum key Y":
              - strong: CH
              - text: EMPTY
            - button "OH drum key U":
              - strong: OH
              - text: EMPTY
            - button "KD1 drum key A":
              - strong: KD1
              - text: SELECTED
            - button "SD1 drum key S":
              - strong: SD1
              - text: EMPTY
            - button "RIM drum key D":
              - strong: RIM
              - text: EMPTY
            - button "TB drum key F":
              - strong: TB
              - text: EMPTY
            - button "SH drum key G":
              - strong: SH
              - text: EMPTY
            - button "CL drum key H":
              - strong: CL
              - text: EMPTY
            - button "CAB drum key J":
              - strong: CAB
              - text: EMPTY
          - group "Upper octave drum keys":
            - paragraph: Upper pads · 13–24 Press Z / X to play
            - button "RC drum key W":
              - strong: RC
              - text: EMPTY
            - button "CC drum key E":
              - strong: CC
              - text: EMPTY
            - button "COW drum key R":
              - strong: COW
              - text: EMPTY
            - button "LC drum key Y":
              - strong: LC
              - text: EMPTY
            - button "HC drum key U":
              - strong: HC
              - text: EMPTY
            - button "LT1 drum key A":
              - strong: LT1
              - text: EMPTY
            - button "MT drum key S":
              - strong: MT
              - text: EMPTY
            - button "HT drum key D":
              - strong: HT
              - text: EMPTY
            - button "TRI drum key F":
              - strong: TRI
              - text: EMPTY
            - button "LT2 drum key G":
              - strong: LT2
              - text: EMPTY
            - button "WS drum key H":
              - strong: WS
              - text: EMPTY
            - button "GUI drum key J":
              - strong: GUI
              - text: EMPTY
      - button "Add sounds"
      - button "Slice audio"
      - button "Record takes"
      - heading "EDIT / Sample management" [level=3]
      - button "Focus" [pressed]
      - button "Table"
      - region "Focused sample editor":
        - paragraph: SELECTED SOUND
        - heading "Pad 1 · Empty" [level=3]
        - button "Previous pad" [disabled]
        - button "Next pad →"
        - paragraph: This selected pad is empty. Add a sample or record a sound into it.
        - button "Add sample"
        - button "Record here"
        - region "Unassigned sounds":
          - heading "Unassigned sounds" [level=4]
          - text: "0"
          - paragraph: Imported sources and overflow sounds appear here until you assign them.
      - button "reset instrument"
      - button "clear all" [disabled]
      - button "import OP-1 preset"
      - button "bulk edit" [disabled]
      - button "browse folder"
      - group: Preset and performance settings poly · transpose 0 · volume 69%
      - group: Audio output and processing WAV · 44.1 kHz · 16-bit · stereo
      - dialog "slice audio":
        - heading "Turn a loop into drum sounds" [level=3]
        - paragraph: Make slices, edit and listen, then assign keys. Scroll through the controls below.
        - main "Slicing controls":
          - status:
            - paragraph: Decoding source... 0%
            - progressbar
        - button "Cancel"
        - button "Add sounds to kit" [disabled]
  - text: OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering. this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only. OP-XY, OP-1 and OP-Z are registered trademarks of teenage engineering. proudly open source |
  - link "github fork":
    - /url: https://github.com/sscommander79/op-patchstudio
  - text: "| v0.16.0 · build ec81b61e fork maintained by sscommander79 · original project by"
  - link "joseph-holland":
    - /url: https://github.com/joseph-holland
  - text: inspired by the awesome
  - link "opxy-drum-tool":
    - /url: https://buba447.github.io/opxy-drum-tool/
  - text: by zeitgeese
- heading "keyboard controls" [level=3]
- paragraph:
  - strong: "load:"
  - text: select an empty pad and use Add sounds, or drag audio directly onto a pad
- paragraph:
  - strong: "play:"
  - text: use keyboard keys (
  - strong: A-J, W, E, R, Y, U
  - text: ) to trigger samples and
  - strong: Z
  - text: /
  - strong: X
  - text: to switch octaves
- paragraph:
  - strong: "pin:"
  - text: use the pin icon to keep the keyboard at the top of the screen
- paragraph: snap all sample markers to zero crossings for cleaner audio. this does not affect future imports.
```

# Test source

```ts
  1   | import { expect, test, type Download, type Page } from './audio-context-fixture';
  2   | import { readFile } from 'node:fs/promises';
  3   | import JSZip from 'jszip';
  4   | import {downloadDevicePreset, gotoWorkspace, expectDrumLoaded, openAdvanced, openWorkspace, projectAction} from './workspace-actions';
  5   | 
  6   | function transientWav(name = 'browser-break.wav') {
  7   |   const sampleRate=48_000,frames=48_000,buffer=Buffer.alloc(44+frames*2);
  8   |   buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);
  9   |   buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);
  10  |   buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
  11  |   buffer.writeUInt32LE(sampleRate,24);buffer.writeUInt32LE(sampleRate*2,28);
  12  |   buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  13  |   buffer.write('data',36);buffer.writeUInt32LE(frames*2,40);
  14  |   for(const onset of [4_000,18_000,35_000]) {
  15  |     for(let offset=0;offset<64;offset+=1) buffer.writeInt16LE(Math.round(30_000*Math.exp(-offset/9)),44+(onset+offset)*2);
  16  |   }
  17  |   return {name,mimeType:'audio/wav',buffer};
  18  | }
  19  | 
  20  | async function openExternalSlicer(page:Page) {
  21  |   const chooser=page.waitForEvent('filechooser');
  22  |   await page.getByRole('button',{name:'Slice audio',exact:true}).click();
  23  |   await (await chooser).setFiles(transientWav());
  24  |   const dialog=page.getByRole('dialog',{name:'slice audio'});
  25  |   await expect(dialog).toBeVisible();
> 26  |   await expect(dialog.getByText('Sound 1 of 3',{exact:true})).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  27  |   return dialog;
  28  | }
  29  | 
  30  | // Keep both controls within the modal body before a native browser drag. Playwright's
  31  | // target auto-scroll after mouse-down can otherwise move the drag source behind the fixed header.
  32  | async function dragSoundToPad(dialog:ReturnType<Page['getByRole']>,number:number,pad:string) {
  33  |   const source=dialog.getByRole('button',{name:`Select sound ${number}`,exact:true}),target=dialog.getByRole('button',{name:pad,exact:true});
  34  |   await source.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();
  35  |   const from=await source.boundingBox(),to=await target.boundingBox();expect(from).not.toBeNull();expect(to).not.toBeNull();
  36  |   const top=Math.min(from!.y,to!.y),bottom=Math.max(from!.y+from!.height,to!.y+to!.height);
  37  |   await dialog.getByRole('main',{name:'Slicing controls'}).evaluate((node,bounds)=>{const rect=node.getBoundingClientRect();if(bounds.top<rect.top+8)node.scrollTop+=bounds.top-rect.top-8;else if(bounds.bottom>rect.bottom-8)node.scrollTop+=bounds.bottom-rect.bottom+8;},{top,bottom});
  38  |   const body=await dialog.getByRole('main',{name:'Slicing controls'}).boundingBox(),start=await source.boundingBox(),end=await target.boundingBox();
  39  |   expect(start!.y).toBeGreaterThanOrEqual(body!.y);expect(end!.y+end!.height).toBeLessThanOrEqual(body!.y+body!.height);
  40  |   await source.dragTo(target);
  41  | }
  42  | 
  43  | async function downloadedBytes(download:Download) {
  44  |   expect(await download.failure()).toBeNull();
  45  |   const path=await download.path();
  46  |   if(!path)throw new Error('Download did not produce a file');
  47  |   return readFile(path);
  48  | }
  49  | 
  50  | function wavFrames(bytes:Uint8Array) {
  51  |   const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  52  |   let channels=0,bits=0;
  53  |   for(let offset=12;offset+8<=bytes.length;) {
  54  |     const id=Buffer.from(bytes.subarray(offset,offset+4)).toString('ascii'),size=view.getUint32(offset+4,true);
  55  |     if(id==='fmt '){channels=view.getUint16(offset+10,true);bits=view.getUint16(offset+22,true);}
  56  |     if(id==='data')return size/(channels*(bits/8));
  57  |     offset+=8+size+(size%2);
  58  |   }
  59  |   throw new Error('Exported WAV has no data chunk');
  60  | }
  61  | 
  62  | const projectPadState=(manifest:ProjectManifest)=>manifest.project.drumSamples.map(({sampleId,...fields})=>{void sampleId;return fields;});
  63  | 
  64  | type SliceProvenance={sourceIdentity:string;sourceName:string;startFrame:number;endFrame:number;sourceFrameCount:number;sourceSampleRate:number;sourceChannels:number};
  65  | type ProjectManifest={
  66  |   project:{drumSamples:Array<{name:string;sampleId:string;assignedKey?:number;sourceIdentity?:string;sliceProvenance?:SliceProvenance}>};
  67  |   samples:Array<{id:string;name:string;audioPath:string;sourcePath?:string;metadata:{sampleRate:number;channels:number};audio:{frames:number;sampleRate:number;channels:number}}>;
  68  | };
  69  | 
  70  | async function readProject(bytes:Buffer) {
  71  |   const zip=await JSZip.loadAsync(bytes),file=zip.file('manifest.json');
  72  |   if(!file)throw new Error('Project backup has no manifest.json');
  73  |   return JSON.parse(await file.async('string')) as ProjectManifest;
  74  | }
  75  | 
  76  | test('direct slice replacement and existing-pad unassignment preserve originals, cancel, and atomic Undo/Redo',async({page})=>{
  77  |   await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();await expectDrumLoaded(page,10);
  78  |   const backup=async()=>{const event=page.waitForEvent('download');await projectAction(page,'Download project');return downloadedBytes(await event);};
  79  |   const before=await backup();
  80  |   const open=async()=>{await page.getByRole('button',{name:'Slice this sample',exact:true}).click();const dialog=page.getByRole('dialog',{name:'slice audio'});await expect(dialog.getByRole('button',{name:'Select sound 1',exact:true})).toBeVisible();return dialog;};
  81  |   let dialog=await open();
  82  |   const selector=dialog.getByRole('button',{name:'Select sound 1',exact:true}),waveform=dialog.getByLabel('Sound 1 waveform');
  83  |   await selector.scrollIntoViewIfNeeded();const soundBox=await selector.boundingBox(),waveBox=await waveform.boundingBox();
  84  |   expect(soundBox!.y).toBeGreaterThanOrEqual(waveBox!.y+waveBox!.height-1);
  85  |   expect(soundBox!.y-waveBox!.y-waveBox!.height).toBeLessThan(100);
  86  |   await dragSoundToPad(dialog,1,'Pad 1, KD1, Seed Kick');
  87  |   await expect(dialog.getByRole('alert')).toContainText('preserve the existing sound');
  88  |   await expect(dialog.getByRole('button',{name:'Keep',exact:true})).toBeFocused();
  89  |   await expect(dialog.getByRole('button',{name:'Add sounds to kit'})).toBeDisabled();
  90  |   await dialog.getByRole('button',{name:'Keep',exact:true}).click();
  91  |   await dragSoundToPad(dialog,1,'Pad 1, KD1, Seed Kick');
  92  |   await dialog.getByRole('button',{name:'Replace',exact:true}).click();
  93  |   await expect(dialog.getByRole('button',{name:'Pad 1, KD1, Sound 1',exact:true})).toBeVisible();
  94  |   await dialog.getByRole('button',{name:'Pad 3, SD1, Seed Snare',exact:true}).click();
  95  |   await expect(dialog.getByLabel('Destination pad')).toHaveValue('2');
  96  |   await dialog.getByRole('button',{name:'Unassign pad sound',exact:true}).click();
  97  |   await expect(dialog.getByRole('button',{name:'Pad 3, SD1, Empty',exact:true})).toBeVisible();
  98  |   await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expectDrumLoaded(page,10);
  99  |   const afterCancel=await backup();expect(projectPadState(await readProject(afterCancel))).toEqual(projectPadState(await readProject(before)));
  100 |   dialog=await open();
  101 |   await dragSoundToPad(dialog,1,'Pad 1, KD1, Seed Kick');
  102 |   await dialog.getByRole('button',{name:'Replace',exact:true}).click();
  103 |   await dialog.getByRole('button',{name:'Pad 3, SD1, Seed Snare',exact:true}).click();
  104 |   await dialog.getByRole('button',{name:'Unassign pad sound',exact:true}).click();
  105 |   const overflow=dialog.getByRole('checkbox');if(await overflow.count())await overflow.check();
  106 |   await dialog.getByRole('button',{name:'Add sounds to kit'}).click();await expect(dialog).not.toBeVisible();await expectDrumLoaded(page,9);
  107 |   const committed=await backup(),committedProject=await readProject(committed),originalProject=await readProject(before);
  108 |   for(const name of ['Seed Kick','Seed Snare']){
  109 |     const originalRef=originalProject.project.drumSamples.find(sample=>sample.name===name),retainedRef=committedProject.project.drumSamples.find(sample=>sample.name===name);
  110 |     expect(originalRef).toBeDefined();expect(retainedRef).toBeDefined();expect(retainedRef!.assignedKey).toBeUndefined();
  111 |     const original=originalProject.samples.find(sample=>sample.id===originalRef!.sampleId)!,retained=committedProject.samples.find(sample=>sample.id===retainedRef!.sampleId)!;
  112 |     expect(original).toBeDefined();expect(retained).toBeDefined();
  113 |     const oldZip=await JSZip.loadAsync(before),newZip=await JSZip.loadAsync(committed);
  114 |     expect(await newZip.file(retained.audioPath)!.async('uint8array')).toEqual(await oldZip.file(original.audioPath)!.async('uint8array'));
  115 |     if(original.sourcePath){expect(retained.sourcePath).toBeDefined();expect(await newZip.file(retained.sourcePath!)!.async('uint8array')).toEqual(await oldZip.file(original.sourcePath)!.async('uint8array'));}
  116 |   }
  117 |   expect(committedProject.project.drumSamples.find(sample=>sample.assignedKey===0)?.sliceProvenance).toBeTruthy();
  118 |   await page.getByRole('button',{name:'Undo',exact:true}).click();await expectDrumLoaded(page,10);
  119 |   expect(projectPadState(await readProject(await backup()))).toEqual(projectPadState(originalProject));
  120 |   await page.getByRole('button',{name:'Redo',exact:true}).click();await expectDrumLoaded(page,9);
  121 |   expect(projectPadState(await readProject(await backup()))).toEqual(projectPadState(committedProject));
  122 | });
  123 | 
  124 | test('slice source, live clock mark, apply, export, undo, and portable provenance round trip',async({page})=>{
  125 |   await page.goto('/',{waitUntil:'domcontentloaded'});
  126 |   await openWorkspace(page,'drum');
```