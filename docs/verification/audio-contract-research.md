# OP-XY audio contract research

**Status:** research note, not a hardware certification  
**Researched:** 2026-09-04  
**Repository baseline:** `b669b7c57937bb74b887774a9ca73b5d4a81afed`, with the working tree inspected as it existed on the research date  
**Scope:** ADSR encoding and preview, loop crossfade, sample and loop endpoints, drum key mapping, and audio-file support

The OP-XY guide documents the user-facing controls, but it does not publish the numeric `patch.json` schema. The conclusions below therefore distinguish official behavior, device-observed repository evidence, file-format specifications, and implementation assumptions. Community issue claims are not treated as contracts unless they include reproducible device evidence.

## Decision table

| Contract | Established | Still unknown | Honest product handling |
| --- | --- | --- | --- |
| ADSR | OP-XY has amplitude and filter ADSR envelopes. PatchStudio and observed patches store the four values as integers in the apparent `0..32767` parameter domain. PatchStudio currently exports the selected raw values unchanged. | The conversion from raw attack, decay, and release values to seconds; whether amp and filter envelopes use identical curves; whether the curve or maximum varies by stage or firmware. | Keep raw values or normalized percentages as the authoritative editable values. Label browser timing as an **approximate preview**. Do not show an OP-XY duration in seconds or claim a maximum until it has been measured on hardware. |
| `loop.crossfade` | The official guide says it smooths loop transitions. A documented physical-device comparison shows that raw `29368` on a `166606`-frame sample displays as 17%, exactly `29368 / 166606`. A corpus reviewed in the same change used `display fraction × framecount`. The physical UI was reported as adjustable through 75%. | The audible fade window, curve, and whether the DSP maps the displayed percentage to loop length or some other duration. Behavior of JSON-authored values above the physical 75% control limit. | Present `0..75%` as the ordinary device-control range and encode the observed display value as `round(fraction × framecount)`. If values above 75% are allowed, place them behind an **unverified/advanced** label. Do not promise that browser crossfade audio matches the device. |
| Sample and loop endpoints | The official slicer description treats a slice boundary as both one slice's end and the next slice's start. Device-shaped patch artifacts use `sample.end == framecount` for a full sample. Web Audio uses an end boundary for `loopEnd`. AIFF MARK positions are boundaries between sample frames. RIFF `smpl` defines an inclusive loop end. | Teenage Engineering does not publish whether every `patch.json` start/end field uses half-open `[start,end)` boundaries, nor how OP-XY imports edge cases from WAV/AIFF metadata. | Use a canonical internal half-open frame range `[start,end)`, allow `end == framecount`, and convert at the file boundary. For RIFF `smpl`, write `start` unchanged and `end - 1`. Treat AIFF and OP-XY JSON conversion as requiring fixture and device round-trip tests before calling it exact. |
| Drum key mapping | The official guide says the drum sampler has 24 keyboard slots. A device-shaped public patch maps its 24 regions consecutively to MIDI notes 53 through 76. The current working tree maps physical slot `n` to `53 + n`. | Teenage Engineering does not publish the raw MIDI base in its guide, and the public artifact does not document how it was captured. | Preserve physical slot identity: slot `n` maps to `53 + n`, including holes. Do not compact assigned samples before calculating the note. Treat note-name octave labels as display preferences only. |
| Audio formats | Teenage Engineering explicitly supports AIFF and WAV files and states a 20-second maximum sample length. | The guide does not specify accepted sample rates, bit depths, integer versus float encoding, channel counts, WAVE variants, AIFC, or whether filename extensions are case-sensitive. | Describe WAV and AIFF as OP-XY formats. Describe MP3/M4A/OGG/FLAC, if retained, as **browser import formats that are converted for export**. Do not label every conversion option as hardware-compatible. Offer a conservative WAV PCM 16-bit/44.1 kHz profile as a compatibility preset, clearly described as conservative rather than an official device limit. |

## 1. ADSR values and preview timing

### Current implementation

- [`src/hooks/useAudioPlayer.ts`](../../src/hooks/useAudioPlayer.ts) declares ADSR values as `0..32767`. Its preview conversion normalizes each value by 32767, maps sustain linearly to `0..1`, and maps attack, decay, and release with `30 × normalized²` seconds (lines 77-82 and 430-451 in the inspected working tree).
- [`src/components/multisample/baseMultisampleJson.ts`](../../src/components/multisample/baseMultisampleJson.ts) contains raw-looking defaults such as amp decay `20295` and release `16383`; it contains no unit declaration (lines 34-46).
- [`src/utils/patchGeneration.ts`](../../src/utils/patchGeneration.ts) copies the selected amp and filter envelope objects into `patch.json` unchanged (lines 185-200). This raw passthrough is separate from browser preview timing.

### Evidence assessment

The [official instrument guide](https://teenage.engineering/guides/op-xy/instrument) establishes two ADSR envelopes and the attack/decay/sustain/release control order. It publishes neither seconds nor a raw-value mapping.

The current [ConvertWithMoss `OpXyTag.java` implementation](https://github.com/git-moss/ConvertWithMoss/blob/c1bb6545a1306325f8b2397ef03c42ef15d2b238/src/main/java/de/mossgrabers/convertwithmoss/format/teenage/opxy/OpXyTag.java#L111-L125) uses `32767`, a quadratic curve, and a 10-second maximum. That is useful as a competing implementation, not proof: the [pull request that introduced OP-XY support](https://github.com/git-moss/ConvertWithMoss/pull/302) explicitly said it was not tested on the device. No later hardware evidence found in that repository calibrates the envelope time curve.

Upstream [OP-PatchStudio issue #111](https://github.com/joseph-holland/op-patchstudio/issues/111) says attack can reach six minutes. It provides no firmware version, raw values, recording, exported preset, measurement method, or comments that independently reproduce the result. It therefore identifies a likely preview mismatch but does **not** establish a six-minute maximum. The present 30-second curve and ConvertWithMoss's 10-second curve are likewise undocumented hypotheses.

**Decision:** preserve raw values for export and avoid presenting the 30-second browser mapping as device timing. A useful label is “Approximate preview; OP-XY envelope timing has not been calibrated.”

## 2. `loop.crossfade`

The [official sample guide](https://teenage.engineering/guides/op-xy/sample) describes loop crossfade as an amount used to create smooth pads. It does not publish a unit, range, or DSP curve.

The strongest available numeric evidence is [ConvertWithMoss issue #317](https://github.com/git-moss/ConvertWithMoss/issues/317) and the associated [merged PR #318](https://github.com/git-moss/ConvertWithMoss/pull/318):

- An OP-XY owner reported that a raw crossfade value of `29368` on a `166606`-frame sample displayed as 17% on physical hardware. `29368 / 166606 = 0.1763`, consistent with a displayed whole-sample fraction after rounding.
- The reporter observed a physical knob range of 0-75%, while manually authored JSON could display values through 100%.
- The PR author checked 17 commercial-preset regions and found exact `display percentage × framecount` values, then implemented symmetric read/write conversion.
- The PR explicitly leaves the audible meaning unresolved: only listening on hardware can determine whether the fade duration follows loop length, absolute frames, or another rule.

This supports the serialization/display law:

```text
raw loop.crossfade ~= displayed_fraction * region.framecount
displayed_fraction ~= raw loop.crossfade / region.framecount
```

It does not support treating the raw integer as milliseconds or as a literal count of frames in the audible fade. The current generator writes `0` for every multisample region in [`src/utils/patchGeneration.ts`](../../src/utils/patchGeneration.ts) (line 371), so future UI work should calculate the raw value only after the final exported frame count is known.

## 3. Start/end conventions

### Canonical internal representation

PatchStudio's current [`frameRange`](../../src/utils/patchGeneration.ts) produces a start in `0..framecount-1` and an end in `start+1..framecount` (lines 109-121). That is a coherent half-open interval, `[start,end)`, and should remain the single internal representation for selection, slicing, playback, and export.

Supporting evidence:

- The [official sample guide](https://teenage.engineering/guides/op-xy/sample) says the start of one slice is also the end of the previous slice. Shared boundaries naturally avoid a duplicated or dropped frame.
- A [public OP-XY-shaped drum patch at an immutable commit](https://github.com/YYUUGGOO/OP-XY-Drum-Utility/blob/ba345758b546619f5fb42c5269dfe2f6ace40b61/patch.json) uses `sample.end == framecount` in all 24 regions. Its repository does not document capture provenance, so this is corroborating artifact evidence rather than an official schema.
- The [Web Audio specification](https://webaudio.github.io/web-audio-api/#dom-audiobuffersourcenode-loopend) loops when playback reaches the loop-end boundary. This supports `[start,end)` for browser preview only; it says nothing about OP-XY JSON.

### Container metadata is not one universal convention

- **WAV RIFF `smpl`:** Microsoft's [DirectXTK reader](https://github.com/microsoft/DirectXTK/blob/e31f0765a548f8f08d9c31e9df6f4d902f3f58b2/Audio/WAVFileReader.cpp#L450-L459) calculates loop length as `end - start + 1`, demonstrating an inclusive stored end. A canonical `[start,end)` selection therefore becomes `smpl.start = start`, `smpl.end = end - 1`.
- **AIFF MARK/INST:** Apple's *Audio Interchange File Format 1.3* says marker positions fall between sample frames; position 0 is before the first frame. Its full-length example has `numSampleFrames = 88200` and an end marker at `88200`. The surviving online copy used here is a [third-party mirror of the Apple specification](https://blog.zamzar.com/wp-content/uploads/2014/10/aiffspecs.pdf), pages 13-15 and 26. This supports boundary positions, but OP-XY's interpretation still needs a device fixture.

### Current export risks

- [`src/utils/wavExport.ts`](../../src/utils/wavExport.ts) subtracts one from both loop start and loop end (lines 149-150). A start of zero becomes unsigned `0xffffffff`; nonzero starts shift one frame early. With a half-open internal range, only the end should be decremented.
- [`src/utils/aiffExport.ts`](../../src/utils/aiffExport.ts) writes the start unchanged and subtracts one from the end (lines 309-316). That conflicts with AIFF's boundary-position model, where a full-file end may equal `numSampleFrames`.
- Drum export currently supplies `loopEnd: buffer.length - 1` before the WAV/AIFF writers apply their own decrement (lines 230-238 of `patchGeneration.ts`), while multisample export supplies the half-open `outputLoop.end` (lines 277-285). The two call sites therefore do not share one endpoint contract.

These are implementation findings, not permission to guess the OP-XY parser. Resolve them with byte-level fixtures and device round trips before claiming exact hardware parity.

## 4. Drum MIDI mapping

The [official sample guide](https://teenage.engineering/guides/op-xy/sample) establishes 24 drum slots across the musical keyboard but does not expose their MIDI numbers. The immutable [OP-XY Drum Utility patch artifact](https://github.com/YYUUGGOO/OP-XY-Drum-Utility/blob/ba345758b546619f5fb42c5269dfe2f6ace40b61/patch.json) contains 24 one-note regions with `lokey == hikey`, consecutively 53 through 76, alongside device-style filenames from `unnamed-f2-34.wav` through `unnamed-e4-22.wav`.

This is strong interoperability evidence for:

```text
region MIDI note = 53 + physical drum slot index, where slot is 0..23
```

Sparse kits must preserve the slot offset. Samples on slots 0 and 5 therefore map to 53 and 58, not 53 and 54. The inspected working tree already applies `53 + sampleKey` in [`src/utils/patchGeneration.ts`](../../src/utils/patchGeneration.ts) (lines 316-320). Note-name choices such as calling MIDI 60 “C3” or “C4” must not alter the numeric region mapping.

Because the artifact's provenance is not described, a two-slot sparse hardware test remains required before marking the base and hole behavior as device-certified.

## 5. Supported audio formats

The [official OP-XY sample guide](https://teenage.engineering/guides/op-xy/sample) states that OP-XY supports AIFF and WAV files and that samples are limited to 20 seconds. It also says pitch can be read from WAV metadata or a note in the filename. It does not publish an audio encoding matrix.

The app currently has two different concepts:

- Device export is limited to `'wav' | 'aiff'` in [`src/utils/audioExport.ts`](../../src/utils/audioExport.ts) (lines 1-7 and 55-64).
- Browser import advertises WAV/AIF/AIFF/MP3/M4A/OGG/FLAC in [`src/components/common/FileDropZone.tsx`](../../src/components/common/FileDropZone.tsx) and [`src/utils/audioFormats.ts`](../../src/utils/audioFormats.ts). However, the explicit metadata reader handles WAV, AIFF/AIF, and MP3 only; detected M4A/OGG/FLAC reach its unsupported default (lines 402-427). Browser decoding also varies by browser and operating system.

The UI should separate these labels:

- **OP-XY export:** WAV, AIFF.
- **Import for conversion:** list only formats verified in the current browser/runtime, and explain that imported files are converted to WAV or AIFF.
- **Compatibility preset:** WAV, PCM integer, 16-bit, 44.1 kHz, mono can be offered as a conservative ecosystem profile. The official guide does not prove that other rates, depths, float encodings, or stereo are unsupported, so this must not be described as the device's complete limit.
- **Advanced conversion:** current 11.025/22.05/44.1 kHz and 8/12/16/24-bit choices should carry “hardware verification pending” until the matrix below is run. AIFF float export needs the same qualification.

## Required hardware verification

Record the OP-XY firmware version, exact source fixture hash, exported preset, device-saved preset, and audio capture for each test.

1. **ADSR calibration:** author raw values `0`, `8192`, `16384`, `24576`, and `32767` for attack, decay, and release. Record output and measure stage durations. Repeat for amplitude and filter envelopes. Fit a curve only after the measurements are reproducible.
2. **Crossfade serialization and sound:** author displayed targets 0%, 25%, 50%, and 75% using `fraction × framecount`; load, read the device display, save on device, and inspect the saved JSON. Use an asymmetric loop fixture to determine what audio is mixed and over what duration. Test values above 75% separately as nonstandard JSON input.
3. **JSON endpoints:** use a short numbered impulse/ramp fixture. Test full-file `sample.end = framecount`, adjacent slice boundaries, loop end at framecount, and one-frame selections. Save on device and compare the emitted JSON.
4. **Container endpoints:** embed the same loop in WAV and AIFF, import each on OP-XY, save, and compare playback plus metadata. Include start 0 to catch unsigned underflow and end at framecount to catch off-by-one conversion.
5. **Sparse drum mapping:** assign only slots 0 and 5. Confirm they play on the first and sixth physical keys and that the saved regions are 53 and 58.
6. **Audio matrix:** test WAV and AIFF across integer/float encoding, 8/12/16/24/32-bit where representable, 11.025/22.05/44.1/48 kHz, mono/stereo, and AIFF versus AIFC. Record load success, playback correctness, metadata retention, and resaving behavior. Do not infer support from a successful browser decode.

## Source ledger and confidence

### Official product documentation

- Teenage Engineering, [OP-XY guide: sample](https://teenage.engineering/guides/op-xy/sample), accessed 2026-09-04. Establishes 20-second sample limit, sampler controls, loop-crossfade purpose, 24 drum samples, shared slice boundaries, 24 multisample zones, and WAV/AIFF support.
- Teenage Engineering, [OP-XY guide: instrument](https://teenage.engineering/guides/op-xy/instrument), accessed 2026-09-04. Establishes amplitude/filter ADSR controls, but no numeric time mapping.

### Format and browser specifications

- W3C Web Audio Working Group, [Web Audio API 1.1, `AudioBufferSourceNode.loopEnd`](https://webaudio.github.io/web-audio-api/#dom-audiobuffersourcenode-loopend), accessed 2026-09-04. Applies to PatchStudio preview, not OP-XY storage.
- Microsoft, [DirectXTK `WAVFileReader.cpp`](https://github.com/microsoft/DirectXTK/blob/e31f0765a548f8f08d9c31e9df6f4d902f3f58b2/Audio/WAVFileReader.cpp#L450-L459), immutable commit. Demonstrates inclusive RIFF `smpl` end handling.
- Apple Computer, *Audio Interchange File Format “AIFF” Version 1.3* (1989), [archival third-party mirror](https://blog.zamzar.com/wp-content/uploads/2014/10/aiffspecs.pdf), pages 13-15 and 26. The document is Apple-authored; the host is not Apple.

### Repository and hardware evidence

- git-moss/ConvertWithMoss, [issue #317](https://github.com/git-moss/ConvertWithMoss/issues/317), physical-device observations and attached source/output fixtures for crossfade.
- git-moss/ConvertWithMoss, [PR #318](https://github.com/git-moss/ConvertWithMoss/pull/318), derivation and implementation of crossfade serialization, with an explicit remaining hardware-listening question.
- git-moss/ConvertWithMoss, [`OpXyTag.java` at `c1bb654`](https://github.com/git-moss/ConvertWithMoss/blob/c1bb6545a1306325f8b2397ef03c42ef15d2b238/src/main/java/de/mossgrabers/convertwithmoss/format/teenage/opxy/OpXyTag.java), current competing implementation; its envelope constant is not device-calibrated evidence.
- git-moss/ConvertWithMoss, [PR #302](https://github.com/git-moss/ConvertWithMoss/pull/302), explicitly records that the initial format writer was not tested on device.
- YYUUGGOO/OP-XY-Drum-Utility, [`patch.json` at `ba34575`](https://github.com/YYUUGGOO/OP-XY-Drum-Utility/blob/ba345758b546619f5fb42c5269dfe2f6ace40b61/patch.json), corroborating 53-76 region map and `sample.end == framecount`; capture provenance is unstated.
- joseph-holland/op-patchstudio, [issue #111](https://github.com/joseph-holland/op-patchstudio/issues/111), useful report of preview mismatch but insufficient evidence for a six-minute attack contract.

## Implementation rule

Until the hardware matrix is complete, every conversion should have one of three labels in code and UI documentation:

- **Official:** directly stated by Teenage Engineering.
- **Device-observed:** backed by a reproducible physical-device artifact or readback.
- **Approximate:** chosen for preview or interoperability and not asserted to match OP-XY exactly.

Do not silently promote an approximate value to an OP-XY unit. Preserve raw patch values on import and round trip whenever the application cannot interpret them with device-backed confidence.
