# Transfer guidance evidence

Checked 2026-09-04 for Task8/9 help copy.

- Official [OP-XY com guide](https://teenage.engineering/guides/op-xy/com), sections19 and19.5: connect to computer first, press COM then M4 for MTP. Mac users are directed to Fieldkit. M4 ejects the device. This applies to adding samples, presets and projects.
- Official [how-to guide](https://teenage.engineering/guides/op-xy/how-to) identifies the root presets/projects/samples folders. Do not confuse preset output with a sample-library import or a Studio backup.
- Current repository export hook downloads `<name>.preset.zip`; archive holds patch.json and audio at its root. Existing README instructs extraction then copying the folder to presets. Retain that workflow while clearly naming the extracted `<name>.preset` folder and preserving its contents. It is repository interoperability behavior, not an official published patch-schema guarantee.
- Do not hardcode community claims about allowed nested folder depth: firmware behavior may differ. Link official guidance and include recorded firmware in device validation.
- Completion copy should say the file was downloaded, then offer transfer steps; it must not say the OP-XY accepted it before an actual device test.

Loop help can cite the official [sample guide](https://teenage.engineering/guides/op-xy/sample): loop forever retains looping after key release; loop until release stops looping on release; loop off disables it. Browser envelopes/crossfade remain approximate as documented separately.
