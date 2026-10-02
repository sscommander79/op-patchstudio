# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: export-workflow.spec.ts >> a failed autosave offers a retry that saves the current work
- Location: tests/e2e/export-workflow.spec.ts:120:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /retry.*save|save.*retry/i })
    - locator resolved to <button type="button" class="studio-button-secondary">Retry save</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
  - element was detached from the DOM, retrying

```

# Page snapshot

```yaml
- generic [ref=e1]:
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
            - generic [ref=e18]:
              - generic [ref=e19]: Theme
              - combobox "Theme" [ref=e20]:
                - option "System" [selected]
                - option "Light"
                - option "Dark"
            - button "Help" [ref=e21] [cursor=pointer]
        - paragraph [ref=e22]:
          - generic [ref=e23]:
            - text: Studio /
            - strong [ref=e24]: Drum kit editor
      - main [ref=e26]:
        - heading "Drum kit editor" [level=1] [ref=e27]
        - region "Instrument project controls" [ref=e28]:
          - generic [ref=e29]:
            - generic [ref=e30]:
              - generic [ref=e31]: Instrument name
              - textbox "Instrument name" [active] [ref=e32]: Retry this save
            - status [ref=e33]: Saved locally
            - generic [ref=e34]:
              - button "Undo" [ref=e35] [cursor=pointer]
              - button "Redo" [disabled] [ref=e36]
              - group [ref=e37]:
                - generic "Project" [ref=e38] [cursor=pointer]
              - button "Export OP-XY" [ref=e39] [cursor=pointer]
        - region "drum tool content" [ref=e41]:
          - generic [ref=e42]:
            - generic [ref=e43]:
              - region "Studio Seed demo kit" [ref=e44]:
                - generic [ref=e45]:
                  - paragraph [ref=e46]: STARTER KIT
                  - strong [ref=e47]: Studio Seed
                - button "Add demo kit" [ref=e48] [cursor=pointer]
              - group "Kit setup guide" [ref=e49]:
                - generic "Kit setup guide Optional" [ref=e50] [cursor=pointer]:
                  - generic [ref=e51]: Kit setup guide
                  - generic [ref=e52]: Optional
            - generic [ref=e53]:
              - generic [ref=e54]:
                - region "Drum pad instrument, 1 of 24 loaded" [ref=e56]:
                  - generic [ref=e57]:
                    - generic [ref=e58]:
                      - heading "PERFORMANCE / drum pads" [level=3] [ref=e59]
                      - generic [aria-hidden] [ref=e62]: 
                    - generic [ref=e63]:
                      - generic [ref=e64]:
                        - generic [aria-hidden] [ref=e65]: 
                        - text: 1 / 24 loaded
                      - button "organize" [ref=e66] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e67]: 
                      - button "midi" [ref=e69] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e70]: 
                      - button "Pin keyboard to top" [ref=e72] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e73]: 
                  - text:  
                  - group "Drum keyboard" [ref=e74]:
                    - generic [ref=e75]:
                      - group "Lower octave drum keys" [ref=e76]:
                        - paragraph [ref=e77]:
                          - text: Lower pads · 1–12
                          - generic [ref=e78]: Computer keys active
                        - generic [ref=e79]:
                          - generic [ref=e80]:
                            - button "KD2 drum key W" [ref=e82] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e83]: W
                              - strong [ref=e84]: KD2
                              - generic [ref=e85]: EMPTY
                            - button "SD2 drum key E" [ref=e87] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e88]: E
                              - strong [ref=e89]: SD2
                              - generic [ref=e90]: EMPTY
                            - button "CLP drum key R" [ref=e92] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e93]: R
                              - strong [ref=e94]: CLP
                              - generic [ref=e95]: SELECTED
                            - button "CH drum key Y" [ref=e97] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e98]: "Y"
                              - strong [ref=e99]: CH
                              - generic [ref=e100]: EMPTY
                            - button "OH drum key U" [ref=e102] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e103]: U
                              - strong [ref=e104]: OH
                              - generic [ref=e105]: EMPTY
                          - generic [ref=e106]:
                            - button "KD1 drum key A" [ref=e108] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e109]: A
                              - strong [ref=e110]: KD1
                              - generic [ref=e111]: EMPTY
                            - button "SD1 drum key S" [ref=e113] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e114]: S
                              - strong [ref=e115]: SD1
                              - generic [ref=e116]: EMPTY
                            - button "RIM drum key D" [ref=e118] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e119]: D
                              - strong [ref=e120]: RIM
                              - generic [ref=e121]: EMPTY
                            - button "TB drum key F" [ref=e123] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e124]: F
                              - strong [ref=e125]: TB
                              - generic [ref=e126]: EMPTY
                            - button "SH drum key G" [ref=e128] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e129]: G
                              - strong [ref=e130]: SH
                              - generic [ref=e131]: EMPTY
                            - button "CL drum key H" [ref=e133] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e134]: H
                              - strong [ref=e135]: CL
                              - generic [ref=e136]: EMPTY
                            - button "CAB drum key J" [ref=e138] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e139]: J
                              - strong [ref=e140]: CAB
                              - generic [ref=e141]: EMPTY
                      - group "Upper octave drum keys" [ref=e142]:
                        - paragraph [ref=e143]:
                          - text: Upper pads · 13–24
                          - generic [ref=e144]: Press Z / X to play
                        - generic [ref=e145]:
                          - generic [ref=e146]:
                            - button "RC drum key W" [ref=e148] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e149]: W
                              - strong [ref=e150]: RC
                              - generic [ref=e151]: EMPTY
                            - button "CC drum key E" [ref=e153] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e154]: E
                              - strong [ref=e155]: CC
                              - generic [ref=e156]: EMPTY
                            - button "COW drum key R" [ref=e158] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e159]: R
                              - strong [ref=e160]: COW
                              - generic [ref=e161]: EMPTY
                            - button "LC drum key Y" [ref=e163] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e164]: "Y"
                              - strong [ref=e165]: LC
                              - generic [ref=e166]: EMPTY
                            - button "HC drum key U" [ref=e168] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e169]: U
                              - strong [ref=e170]: HC
                              - generic [ref=e171]: EMPTY
                          - generic [ref=e172]:
                            - button "LT1 drum key A" [ref=e174] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e175]: A
                              - strong [ref=e176]: LT1
                              - generic [ref=e177]: EMPTY
                            - button "MT drum key S" [ref=e179] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e180]: S
                              - strong [ref=e181]: MT
                              - generic [ref=e182]: EMPTY
                            - button "HT drum key D" [ref=e184] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e185]: D
                              - strong [ref=e186]: HT
                              - generic [ref=e187]: EMPTY
                            - button "TRI drum key F" [ref=e189] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e190]: F
                              - strong [ref=e191]: TRI
                              - generic [ref=e192]: EMPTY
                            - button "LT2 drum key G" [ref=e194] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e195]: G
                              - strong [ref=e196]: LT2
                              - generic [ref=e197]: EMPTY
                            - button "WS drum key H" [ref=e199] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e200]: H
                              - strong [ref=e201]: WS
                              - generic [ref=e202]: EMPTY
                            - button "GUI drum key J" [ref=e204] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e205]: J
                              - strong [ref=e206]: GUI
                              - generic [ref=e207]: EMPTY
                - generic "Add and create sounds" [ref=e208]:
                  - button "Add sounds" [ref=e209] [cursor=pointer]
                  - button "Slice audio" [ref=e210] [cursor=pointer]
                  - button "Record takes" [ref=e211] [cursor=pointer]
              - generic [ref=e213]:
                - generic [ref=e214]:
                  - heading "EDIT / Sample management" [level=3] [ref=e216]
                  - generic "Sample workspace view" [ref=e217]:
                    - button "Focus" [pressed] [ref=e218]
                    - button "Table" [ref=e219]
                - generic [ref=e220]:
                  - region "Focused sample editor" [ref=e221]:
                    - generic [ref=e222]:
                      - generic [ref=e223]:
                        - paragraph [ref=e224]: SELECTED SOUND
                        - heading "Pad 6 · retry-me.wav" [level=3] [ref=e225]
                      - generic [ref=e226]:
                        - button "Play selected" [ref=e227] [cursor=pointer]
                        - button "Previous pad" [ref=e228] [cursor=pointer]
                        - button "Next pad →" [ref=e229] [cursor=pointer]
                    - generic [ref=e230]:
                      - generic [ref=e231]:
                        - button "" [ref=e232] [cursor=pointer]
                        - generic [ref=e234] [cursor=pointer]
                      - generic [ref=e235]:
                        - generic [ref=e236]:
                          - text: Mode
                          - combobox "Mode" [ref=e237]:
                            - option "One shot" [selected]
                            - option "Mute group"
                            - option "Loop"
                            - option "Gate"
                        - button "Forward" [ref=e238] [cursor=pointer]
                        - generic [ref=e239]:
                          - text: In point (seconds)
                          - spinbutton "In point (seconds)" [ref=e240]: "0"
                        - generic [ref=e241]:
                          - text: Out point (seconds)
                          - spinbutton "Out point (seconds)" [ref=e242]: "0.1"
                        - generic [ref=e243]:
                          - text: Transpose
                          - status "Transpose 0" [ref=e244]: 0 st
                          - slider [ref=e245]: "0"
                        - generic [ref=e246]:
                          - text: Gain
                          - status "Gain 0" [ref=e247]: 0 dB
                          - slider [ref=e248]: "0"
                        - generic [ref=e249]:
                          - text: Pan
                          - status "Pan 0" [ref=e250]: "0"
                          - slider [ref=e251]: "0"
                    - generic [ref=e252]:
                      - button "Detailed edit" [ref=e253] [cursor=pointer]
                      - button "Slice this sample" [ref=e254] [cursor=pointer]
                      - button "Replace" [ref=e255] [cursor=pointer]
                      - button "Clear" [ref=e256] [cursor=pointer]
                    - generic [ref=e257]:
                      - generic [ref=e258]:
                        - text: Move or swap with pad
                        - combobox "Move or swap with pad" [ref=e259]:
                          - option "Pad 1" [selected]
                          - option "Pad 2"
                          - option "Pad 3"
                          - option "Pad 4"
                          - option "Pad 5"
                          - option "Pad 6"
                          - option "Pad 7"
                          - option "Pad 8"
                          - option "Pad 9"
                          - option "Pad 10"
                          - option "Pad 11"
                          - option "Pad 12"
                          - option "Pad 13"
                          - option "Pad 14"
                          - option "Pad 15"
                          - option "Pad 16"
                          - option "Pad 17"
                          - option "Pad 18"
                          - option "Pad 19"
                          - option "Pad 20"
                          - option "Pad 21"
                          - option "Pad 22"
                          - option "Pad 23"
                          - option "Pad 24"
                      - paragraph [ref=e260]: Pad 1 is empty. The selected sound will move there.
                      - button "Move or swap" [ref=e261] [cursor=pointer]
                    - region "Unassigned sounds" [ref=e262]:
                      - generic [ref=e263]:
                        - heading "Unassigned sounds" [level=4] [ref=e264]
                        - generic [ref=e265]: "0"
                      - paragraph [ref=e266]: Imported sources and overflow sounds appear here until you assign them.
                  - generic "Drum instrument actions" [ref=e267]:
                    - button "reset instrument" [ref=e268] [cursor=pointer]
                    - button "clear all" [ref=e269] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e270]: 
                      - text: clear all
                    - button "import OP-1 preset" [ref=e271] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e272]: 
                      - text: import OP-1 preset
                    - button "bulk edit" [disabled] [ref=e273]:
                      - generic [aria-hidden] [ref=e274]: 
                      - text: bulk edit
                    - button "browse folder" [ref=e275] [cursor=pointer]
            - group [ref=e276]:
              - generic "Preset and performance settings poly · transpose 0 · volume 69%" [ref=e277] [cursor=pointer]:
                - text: Preset and performance settings
                - generic [ref=e278]: poly · transpose 0 · volume 69%
              - option "poly" [selected]
              - option "mono"
              - option "legato"
              - text:  
            - group [ref=e279]:
              - generic "Audio output and processing WAV · 44.1 kHz · 16-bit · stereo" [ref=e280] [cursor=pointer]:
                - text: Audio output and processing
                - generic [ref=e281]: WAV · 44.1 kHz · 16-bit · stereo
              - text: 
              - option "original"
              - option "44.1 khz" [selected]
              - option "22 khz"
              - option "11 khz"
              - option "original"
              - option "24-bit" [disabled]
              - option "16-bit" [selected]
              - option "12-bit"
              - option "8-bit"
              - option "original" [selected]
              - option "mono" [disabled]
              - text:  
    - status [ref=e282]:
      - paragraph [ref=e283]: The studio is ready to work offline.
      - button "Later" [ref=e285] [cursor=pointer]
    - generic [ref=e286]:
      - generic [ref=e287]: OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.OP-XY, OP-1 and OP-Z are registered trademarks of teenage engineering.
      - generic [ref=e288]:
        - generic [ref=e289]: proudly open source
        - generic [ref=e290]: "|"
        - link "github fork" [ref=e291] [cursor=pointer]:
          - /url: https://github.com/sscommander79/op-patchstudio
        - generic [ref=e292]: "|"
        - generic [ref=e293]: v0.16.0 · build b28b57e5
      - generic [ref=e294]:
        - text: fork maintained by sscommander79 · original project by
        - link "joseph-holland" [ref=e295] [cursor=pointer]:
          - /url: https://github.com/joseph-holland
      - generic [ref=e296]:
        - text: inspired by the awesome
        - link "opxy-drum-tool" [ref=e297] [cursor=pointer]:
          - /url: https://buba447.github.io/opxy-drum-tool/
        - text: by zeitgeese
  - generic:
    - generic:
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
  - generic:
    - generic:
      - generic:
        - paragraph: snap all sample markers to zero crossings for cleaner audio. this does not affect future imports.
```

# Test source

```ts
  38  |   if (!manifest) throw new Error('Preset has no patch.json');
  39  |   const patch = JSON.parse(await manifest.async('string')) as {
  40  |     regions: { lokey: number; hikey: number; sample: string; framecount: number }[];
  41  |     octave: number;
  42  |     engine: Record<string, unknown>;
  43  |     envelope: Record<string, unknown>;
  44  |     fx: Record<string, unknown>;
  45  |   };
  46  |   for (const region of patch.regions) {
  47  |     const member = zip.file(region.sample);
  48  |     expect(member, `Missing audio: ${region.sample}`).not.toBeNull();
  49  |     expect((await member!.async('uint8array')).length).toBeGreaterThan(44);
  50  |   }
  51  |   return { zip, patch };
  52  | }
  53  | 
  54  | test('a kit with empty pads exports the same pad assignments', async ({ page }) => {
  55  |   await gotoWorkspace(page,'drum');
  56  |   await loadPad(page, 'KD1 drum key A', wavFixture('kick.wav'));
  57  |   await loadPad(page, 'CLP drum key R', wavFixture('clap.wav'));
  58  |   await expectDrumLoaded(page,2);
  59  |   const { patch } = await downloadPatch(page);
  60  |   expect(patch.regions.map(region => [region.lokey, region.hikey])).toEqual([[53, 53], [58, 58]]);
  61  | });
  62  | 
  63  | test('same-name samples remain distinct audio files in the downloaded kit', async ({ page }) => {
  64  |   await gotoWorkspace(page,'drum');
  65  |   await loadPad(page, 'KD1 drum key A', wavFixture('hit.wav', 1));
  66  |   await loadPad(page, 'KD2 drum key W', wavFixture('hit.wav', -1));
  67  |   await expectDrumLoaded(page,2);
  68  |   const { zip, patch } = await downloadPatch(page);
  69  |   expect(new Set(patch.regions.map(region => region.sample)).size).toBe(2);
  70  |   const first = await zip.file(patch.regions[0].sample)!.async('uint8array');
  71  |   const second = await zip.file(patch.regions[1].sample)!.async('uint8array');
  72  |   expect(first).not.toEqual(second);
  73  | });
  74  | 
  75  | test('imported multisample settings survive the real upload and export flow', async ({ page }) => {
  76  |   await gotoWorkspace(page,'drum');
  77  |   await openWorkspace(page,'multisample');
  78  |   await page.getByLabel('choose multisample audio files').setInputFiles(wavFixture('tone-C4.wav'));
  79  |   await applyAudioImport(page);
  80  |   await expect(page.getByText('tone-C4.wav', { exact: true }).first()).toBeVisible();
  81  |   await openAdvanced(page,/Preset and performance settings/);
  82  |   const imported = {
  83  |     type: 'multisampler', octave: 3,
  84  |     engine: { transpose: 12, playmode: 'mono', customHardwareField: 42 },
  85  |     envelope: { amp: { attack: 123, decay: 456, sustain: 789, release: 1000 } },
  86  |   };
  87  |   const chooser = page.waitForEvent('filechooser');
  88  |   await page.getByRole('button', { name: /import patch\.json/ }).click();
  89  |   await (await chooser).setFiles({ name: 'patch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  90  |   await expect(page.getByText('successfully imported multisample preset settings', { exact: true })).toBeVisible();
  91  |   const { patch } = await downloadPatch(page);
  92  |   expect.soft(patch.octave).toBe(3);
  93  |   expect.soft(patch.engine.transpose).toBe(12);
  94  |   expect.soft(patch.engine.playmode).toBe('mono');
  95  |   expect.soft(patch.engine.customHardwareField).toBe(42);
  96  |   expect.soft(patch.envelope.amp).toEqual(imported.envelope.amp);
  97  | });
  98  | 
  99  | test('an older saved session can be restored after reload with its pad assignments', async ({ page }) => {
  100 |   await gotoWorkspace(page,'drum');
  101 |   await loadPad(page, 'CLP drum key R', wavFixture('recover-me.wav'));
  102 |   await page.getByRole('textbox', { name: 'Instrument name', exact: true }).fill('Keep this session');
  103 |   await expect.poll(async () => (await readCurrentSession(page))?.drumSettings?.presetName).toBe('Keep this session');
  104 |   // Simulate returning two days later without a real clock delay. The saved
  105 |   // audio and musical state came from the actual file chooser and autosave.
  106 |   await setCurrentSessionTimestamp(page,Date.now()-2*24*60*60*1000);
  107 |   await page.reload();
  108 |   const dialog = page.getByRole('dialog', { name: 'restore session' });
  109 |   await expect(dialog).toBeVisible();
  110 |   await page.keyboard.press('Escape');
  111 |   await expect(dialog).toBeVisible();
  112 |   await dialog.getByRole('button', { name: 'restore', exact: true }).click();
  113 |   await expect(dialog).not.toBeVisible();
  114 |   await openWorkspace(page,'drum');
  115 |   await expect(page.getByRole('textbox', { name: 'Instrument name', exact: true })).toHaveValue('Keep this session');
  116 |   const { patch } = await downloadPatch(page);
  117 |   expect(patch.regions.map(region => [region.lokey, region.hikey])).toEqual([[58, 58]]);
  118 | });
  119 | 
  120 | test('a failed autosave offers a retry that saves the current work', async ({ page }) => {
  121 |   await page.addInitScript(() => {
  122 |     const original = IDBObjectStore.prototype.put;
  123 |     let failNextMusicalSave = true;
  124 |     IDBObjectStore.prototype.put = function (...args) {
  125 |       const value = args[0] as { drumSamples?: unknown[] };
  126 |       if (this.name === 'sessions' && value.drumSamples?.length && failNextMusicalSave) {
  127 |         failNextMusicalSave = false;
  128 |         throw new DOMException('Simulated storage failure', 'QuotaExceededError');
  129 |       }
  130 |       return original.apply(this, args);
  131 |     };
  132 |   });
  133 |   await gotoWorkspace(page,'drum');
  134 |   await loadPad(page, 'CLP drum key R', wavFixture('retry-me.wav'));
  135 |   await page.getByRole('textbox', { name: 'Instrument name', exact: true }).fill('Retry this save');
  136 |   const retry = page.getByRole('button', { name: /retry.*save|save.*retry/i });
  137 |   await expect(retry).toBeVisible();
> 138 |   await retry.click();
      |               ^ Error: locator.click: Test timeout of 30000ms exceeded.
  139 |   await expect.poll(async () => (await readCurrentSession(page))?.drumSettings?.presetName).toBe('Retry this save');
  140 |   await expect(retry).not.toBeVisible();
  141 | });
  142 | 
  143 | test('library reload restores saved multisample settings and keeps the drum kit', async ({ page }) => {
  144 |   await gotoWorkspace(page,'drum');
  145 |   await loadPad(page, 'CLP drum key R', wavFixture('keep-drum.wav'));
  146 |   await openWorkspace(page,'multisample');
  147 |   await page.getByLabel('choose multisample audio files').setInputFiles(wavFixture('library-C4.wav'));
  148 |   await applyAudioImport(page);
  149 |   await expect(page.getByText('library-C4.wav', { exact: true }).first()).toBeVisible();
  150 |   await openAdvanced(page,/Preset and performance settings/);
  151 |   const original = {
  152 |     type: 'multisampler', name: 'Library complete', octave: 2,
  153 |     engine: { transpose: 12, playmode: 'legato', volume: 12345 },
  154 |     envelope: { amp: { attack: 123, decay: 456, sustain: 789, release: 1000 } },
  155 |     fx: { active: true, vendorSetting: 72 },
  156 |   };
  157 |   const importSettings = async (preset: Record<string, unknown>) => {
  158 |     const chooser = page.waitForEvent('filechooser');
  159 |     await page.getByRole('button', { name: /import patch\.json/ }).click();
  160 |     await (await chooser).setFiles({ name: 'patch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(preset)) });
  161 |     await expect(page.getByRole('textbox', { name: 'Instrument name', exact: true })).toHaveValue(String(preset.name));
  162 |   };
  163 |   await importSettings(original);
  164 |   await projectAction(page,'Save to library');
  165 |   await expect(page.getByText('Saved Library complete to the library.', { exact: true })).toBeVisible();
  166 |   await importSettings({ type: 'multisampler', name: 'Temporary setting', octave: -1, engine: { transpose: -12, playmode: 'poly', volume: 32767 }, fx: { active: false } });
  167 |   await openWorkspace(page,'library');
  168 |   await page.getByRole('button', { name: /^(load preset|load)$/ }).click();
  169 |   await page.getByRole('button', { name: 'ok', exact: true }).click();
  170 |   await expect(page.locator('.studio-shell-location strong')).toHaveText('Multisample editor');
  171 |   await expect(page.getByRole('textbox', { name: 'Instrument name', exact: true })).toHaveValue('Library complete');
  172 |   const { patch } = await downloadPatch(page);
  173 |   expect.soft(patch.octave).toBe(2);
  174 |   expect.soft(patch.engine.transpose).toBe(12);
  175 |   expect.soft(patch.engine.playmode).toBe('legato');
  176 |   expect.soft(patch.engine.volume).toBe(12345);
  177 |   expect.soft(patch.envelope.amp).toEqual(original.envelope.amp);
  178 |   expect.soft(patch.fx.vendorSetting).toBe(72);
  179 |   await openWorkspace(page,'drum');
  180 |   const drum = await downloadPatch(page);
  181 |   expect(drum.patch.regions.map(region => region.lokey)).toEqual([58]);
  182 | });
  183 | 
  184 | 
  185 | test('portable project restores sparse audio and its import can be undone', async ({ page }) => {
  186 |   await gotoWorkspace(page,'drum');
  187 |   await loadPad(page, 'CLP drum key R', wavFixture('project-clap.wav'));
  188 |   await expectDrumLoaded(page,1);
  189 |   await page.getByRole('textbox', { name: 'Instrument name', exact: true }).fill('Portable project');
  190 |   const backupEvent = page.waitForEvent('download');
  191 |   await projectAction(page,'Download project');
  192 |   const backup = await backupEvent;
  193 |   expect(backup.suggestedFilename()).toMatch(/\.opstudio$/);
  194 |   const backupPath = await backup.path();
  195 |   if (!backupPath) throw new Error('Project backup did not produce a file');
  196 |   await loadPad(page, 'KD1 drum key A', wavFixture('added-kick.wav'));
  197 |   await expectDrumLoaded(page,2);
  198 |   const chooserEvent = page.waitForEvent('filechooser');
  199 |   await projectAction(page,'Open project');
  200 |   await (await chooserEvent).setFiles({ name: backup.suggestedFilename(), mimeType: 'application/zip', buffer: await readFile(backupPath) });
  201 |   await expectDrumLoaded(page,1);
  202 |   let exported = await downloadPatch(page, false);
  203 |   expect(exported.patch.regions.map(region => region.lokey)).toEqual([58]);
  204 |   await page.getByRole('button', { name: 'Undo', exact: true }).click();
  205 |   await expectDrumLoaded(page,2);
  206 |   exported = await downloadPatch(page, false);
  207 |   expect(exported.patch.regions.map(region => region.lokey)).toEqual([53, 58]);
  208 |   await page.getByRole('button', { name: 'Redo', exact: true }).click();
  209 |   await expectDrumLoaded(page,1);
  210 |   exported = await downloadPatch(page, false);
  211 |   expect(exported.patch.regions.map(region => region.lokey)).toEqual([58]);
  212 | });
  213 | 
  214 | test('settings-only work is offered for recovery after reload', async ({ page }) => {
  215 |   await gotoWorkspace(page,'drum');
  216 |   await page.getByRole('textbox', { name: 'Instrument name', exact: true }).fill('Settings before samples');
  217 |   await expect.poll(async () => (await readCurrentSession(page))?.drumSettings?.presetName).toBe('Settings before samples');
  218 |   await page.reload();
  219 |   const dialog = page.getByRole('dialog', { name: 'restore session' });
  220 |   await expect(dialog).toBeVisible();
  221 |   await dialog.getByRole('button', { name: 'restore', exact: true }).click();
  222 |   await expect(dialog).not.toBeVisible();
  223 |   await openWorkspace(page,'drum');
  224 |   await expect(page.getByRole('textbox', { name: 'Instrument name', exact: true })).toHaveValue('Settings before samples');
  225 | });
  226 | 
  227 | test('keyboard undo and redo restore whole audio loads without changing pad banks', async ({ page }) => {
  228 |   await gotoWorkspace(page,'drum');
  229 |   await loadPad(page, 'CLP drum key R', wavFixture('undo-clap.wav'));
  230 |   await loadPad(page, 'KD1 drum key A', wavFixture('undo-kick.wav'));
  231 |   await expectDrumLoaded(page,2);
  232 |   await page.keyboard.press('Control+z');
  233 |   await expectDrumLoaded(page,1);
  234 |   const desktopClap=page.getByRole('button',{name:'CLP drum key R',exact:true});
  235 |   if(await desktopClap.count()) {
  236 |     await expect(desktopClap).toBeVisible();
  237 |   } else {
  238 |     await expect(page.getByRole('button',{name:'Lower pads 1–12',exact:true})).toHaveAttribute('aria-pressed','true');
```