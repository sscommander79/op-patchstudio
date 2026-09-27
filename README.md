# OP-PatchStudio

OP-PatchStudio is a free, open-source browser studio for building drum and multisample presets for the Teenage Engineering OP-XY. This repository is the [`sscommander79/op-patchstudio`](https://github.com/sscommander79/op-patchstudio) fork of [Joseph Holland's original project](https://github.com/joseph-holland/op-patchstudio).

![OP-PatchStudio drum workspace](public/assets/preview-image.png)

![OP-PatchStudio multisample workspace](public/assets/preview-image-2.png)

The project is unofficial and is not affiliated with, endorsed by, or hardware-certified by Teenage Engineering.

## What the studio does

- Builds OP-XY drum kits with 24 mapped pads plus an unassigned-sample tray.
- Builds multisample instruments with filename note detection, editable root notes and zone mapping.
- Imports WAV, AIFF, MP3, M4A, OGG and FLAC audio when the browser can decode the format. WAV and uncompressed AIFF have built-in metadata readers; compressed-format support depends on the browser.
- Imports compatible `patch.json` settings and OP-1 drum presets.
- Edits exact in/out and loop frames, supports zero-crossing adjustment, non-destructive slicing, gain, normalization, channel/rate conversion and WAV or AIFF output.
- Records from a browser audio input after permission is granted, with manual or sound-triggered capture, pre-roll and take review.
- Saves editable presets in a browser-local library and keeps a recoverable working session.
- Provides bounded undo/redo, keyboard controls, light/dark/device themes and responsive Focus and Table views.
- Exports a device preset ZIP and a separate, versioned `.opstudio` project backup.

The waveform, envelope, pitch, loop-crossfade and processed-audio previews are browser approximations. Exported frame ranges and stored settings are authoritative; preview timing and sound are not calibrated against OP-XY hardware.

## Device preset export and project backup

These downloads have different purposes:

- **Device preset export** downloads `<name>.preset.zip`, containing `patch.json` and the exported audio files. This is the package intended for transfer to an OP-XY.
- **Project backup** downloads `<name>.opstudio`. Version 1 preserves editable settings, exact Float32 working audio, source bytes when available, assignments and imported metadata so the project can be reopened in this studio. It is not a device preset.

The local library and recovery session use IndexedDB in the current browser profile. They do not sync across browsers, profiles or devices. Private-browsing policies, site-data clearing, storage eviction and quota limits can remove or prevent local saves. Keep `.opstudio` backups for work you need to retain. A failed save is reported in the app and can be retried; it does not make cloud or account backups.

The current archive reader accepts `.opstudio` format version 1. It validates the complete manifest and referenced audio before replacing the open project. Future archive versions may require a newer build.

## Transfer to OP-XY

1. Generate and download the device preset ZIP.
2. Extract it without changing the contents. Keep `patch.json` and its audio files together in the extracted `<name>.preset` folder.
3. Connect the OP-XY to the computer. On the device, press **COM**, then **M4** to enter MTP mode. Teenage Engineering directs Mac users to its Fieldkit transfer app.
4. Copy the extracted `.preset` folder into the OP-XY's root `presets` folder.
5. Eject with **M4**, then load and verify the preset on the device.

See Teenage Engineering's current [OP-XY COM guide](https://teenage.engineering/guides/op-xy/com) and [OP-XY how-to guide](https://teenage.engineering/guides/op-xy/how-to). Firmware behavior can change. Automated browser checks verify the downloaded archive, but physical-device import, playback and timing remain an unperformed release check.

## Offline use and updates

The production build is an installable progressive web app. After a successful online visit has populated its cache, the core studio, local import/edit flows, recording code, project backups and preset export are designed to work offline. A first-ever visit cannot work offline. Live Patreon posts, support links, the hosted feedback form and other external pages need a network connection; the app shows an offline fallback instead of an empty hosted form.

When a new build is ready, the app presents **Update now** and **Later**. Choosing Later leaves the current editor running so an active recording or unsaved draft is not silently reloaded. Save or back up important work and close other OP-PatchStudio tabs before choosing Update now. If another Studio tab is still open, the update stays waiting and the app asks you to close it before retrying. While an update waits, the active build, its previous activated build and the newest waiting build may be retained; superseded waiting builds are retired. After activation, the current and previous builds remain as bounded update/reload protection. If cache ownership cannot be proved during an upgrade or race, cleanup is deferred rather than deleting a possibly live build. Unrelated origin caches are left alone.

## Browser permissions and limits

- Recording requires a secure context and microphone/audio-input permission. Available inputs, labels, sample rates and channel counts come from the browser and operating system.
- MIDI control requires Web MIDI support and permission. Unsupported browsers can still use pointer and computer-keyboard controls.
- Audio decoding varies by browser and operating system, especially for compressed formats. Rejected files remain listed with a reason during import review.
- A project can contain at most 256 audio assets. Individual source, decoded-audio, archive and manifest limits are enforced before commit; the UI reports the applicable limit.
- The studio does not upload library or project audio to an application server. Opening external feedback, donation, documentation or issue links leaves the app.

## Local development

Use Node.js 22 or a newer supported LTS release and npm.

```bash
git clone https://github.com/sscommander79/op-patchstudio.git
cd op-patchstudio
npm ci
npm run dev
```

Build and verification commands:

```bash
npm run typecheck          # TypeScript project check
npm run lint               # ESLint for source, tests and configuration
npm test                   # Unit/component suite once
npm run build              # Typecheck, production build and PWA precache integrity
npm run check              # All four checks above
```

Browser checks require matching Playwright browsers:

```bash
npx playwright install chromium firefox webkit
npm run test:e2e                          # configured browser matrix against dev
npm run test:e2e:production               # configured browser matrix against dist
npm run test:e2e:production -- --project=chromium
npm run test:e2e:storage-integration       # real IndexedDB/source integration against dev
npm run test:e2e:recording                 # deterministic Chromium fake-input gate
```

The production browser suite uses only interfaces available from `dist`; its UI-created recovery records are inspected through the browser's native IndexedDB API. The separately named storage-integration suite runs two direct source-module checks against the development server: atomic session rollback after an injected transaction fault, and exact library-audio restoration. CI runs both suites in Chromium for changes. Manual and scheduled CI runs exercise both suites across Chromium, Firefox, WebKit and the configured mobile emulations. The recording command generates and uses an explicit synthetic WAV fixture. It does not access real recording hardware.

## Verification and release evidence

- [Final upgrade review](docs/verification/task-10-final-review.md)
- [Upgrade acceptance matrix](docs/verification/acceptance-matrix.md)
- [Task 9 quality and offline report](docs/verification/task-9-report.md)
- [Offline production checklist](docs/verification/task-9-offline-browser-checklist.md)
- [Device validation checklist](docs/verification/device-validation-checklist.md)
- [Release notes](CHANGELOG.md)

Automated results demonstrate the specific fixtures and browsers named in those records. They are not claims of human listening quality, assistive-technology validation or physical OP-XY acceptance.

## Attribution and license

OP-PatchStudio was created by [Joseph Holland](https://github.com/joseph-holland). This fork retains the original project's authorship and support links while maintaining its changes at [`sscommander79/op-patchstudio`](https://github.com/sscommander79/op-patchstudio). The project was inspired by Brandon Withrow's [opxy-drum-tool](https://buba447.github.io/opxy-drum-tool/).

The source is licensed under the [MIT License](LICENSE), which retains the Joseph Holland and Brandon Withrow copyright notices. OP-XY, OP-1 and OP-Z are trademarks of Teenage Engineering.

## Guided sampling and refinement

In **Multisample → Record takes**, choose NINA/Digitakt, Ableton, or Custom and open **Set up and check this route**. **Check sound on one note** measures the return without adding a take; **Test one note** retains a recording. In **Focus**, use **Analyze sound** for separate, reversible trim and loop suggestions. **Export OP-XY** includes a listening/storage checklist and instructions for extracting and copying the preset folder. Direct USB upload is not implemented.

See the [implementation and verification report](docs/verification/sampling-workflow-improvements-2026-09-18.md) for current test evidence, source-availability limits, and hardware checks.

### Library organization and quick previews

Open **Library → Details** on a saved preset to edit its description and comma-separated tags. Search matches names, descriptions and tags; favorites remain available. Metadata saves preserve the saved audio and reject updates to presets that have been deleted.

**Preview** plays up to three seconds of the first raw saved sample, within its saved trim markers, at reduced volume. It does not reproduce the complete instrument, load the preset, or change the current project. Use **Stop** to end playback; leaving the library or hiding the page also stops it.

### Collections and batch export

In **Library**, use **New collection** to group saved presets. Choose **All presets**, select sounds, and choose **Add to collection**. A collection can mix drums and multisamples. Its Move up/down controls set a saved order; Remove only removes membership. Deleting a collection leaves its presets in the Library. Deleting an actual preset also removes its collection references.

Use **Export selected** for checked presets or **Export collection** for every member, even when search hides some. The browser creates one ZIP with a separate, safely named `.preset` folder for each sound and `collection-order.txt` for reference. Extract the ZIP before transferring the preset folders using the supported OP-XY workflow. This does not set device track order or upload to hardware. Export reports progress, supports cancellation, and does not download a partial collection if a preset fails.

The Library has a collections sidebar on wide screens and a collapsible collection list with preset cards in narrower windows. Metadata and collection membership are saved in this browser profile; a device export ZIP is not a complete editable-library backup.
