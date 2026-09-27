# Task 8 original demo kit design

Status: document-only Astra handoff for later Task 8 implementation. No audio has been generated or auditioned for this assessment. Task 6 implementation is still in progress; reconcile its accepted commit API and Task 7 intake API before integrating this service. This document specifies sounds and acceptance checks, not a replacement onboarding flow.

## Scope and provenance

Use the editable preset name **Studio Seed** and recipe identifier `studio-seed-v1`. Generate ten mono one-shots locally from mathematical oscillators, envelopes, and seeded noise. Do not download, adapt, or embed third-party recordings, factory presets, branded drum-machine models, or copyrighted sample material. The parameter combinations below are an original proposal; standard synthesis mathematics and the PRNG are not claimed as inventions.

The available tool inventory was searched for MaxMSPMCP, `query_maxmsp_docs`, and `lookup_max_object_reference`; no callable reference server was available. Primary references checked instead: Julius O. Smith's [exponentially enveloped sinusoids](https://www.dsprelated.com/freebooks/mdft/Complex_Sinusoids.html), his [elementary digital filter difference equations](https://www.dsprelated.com/freebooks/filters/Elementary_Audio_Digital_Filters.html), and George Marsaglia's [Xorshift RNGs](https://www.jstatsoft.org/article/view/v008i14). These support the elementary building blocks, not claims about the sound of this unrendered kit. No new library API is specified here; fetch current Context7 documentation if implementation introduces API-specific questions.

Keep the recipe version, all constants, seed rule, source authorship note, and eventual verification results in repository documentation alongside the generator. A recipe change increments its version. Stable recipe IDs identify the recipe; use the accepted asset/source identity constructors for project samples. `sourceIdentity` is not a unique editor selection key, and these generated originals must not receive invented `sliceProvenance`.

## Voice and physical pad map

Indices below are the existing zero-based physical sample slots in `DrumKeyboard.tsx`, not screen order or MIDI note numbers. Bank labels refer to its existing lower/upper banks. Retain the keyboard mapping and MIDI mapping functions unchanged.

| Slot | Existing label / bank key | Demo sample name | Duration / frames at 44,100 Hz | Final absolute peak | Recipe |
|---|---|---|---|---|---|
| 0 | KD1 / lower A | Seed Kick | 0.48 s / 21,168 | 0.28 | `S(52, 115, .022, .105) + .08 H E(.010)` |
| 2 | SD1 / lower S | Seed Snare | 0.30 s / 13,230 | 0.22 | `.35 T(185,.060) + .18 T(310,.035) + .65 H E(.055)` |
| 4 | RIM / lower D | Seed Rim | 0.10 s / 4,410 | 0.14 | `T(920,.014) + .45 T(1510,.009) + .08 H E(.004)` |
| 5 | CLP / lower R | Seed Clap | 0.26 s / 11,466 | 0.18 | `H [E(.008,t) + .8 E(.008,t-.013) + .65 E(.008,t-.026) + .6 E(.038,t-.039)]` |
| 7 | SH / lower G | Seed Shaker | 0.14 s / 6,174 | 0.10 | `H sin²(πt/.14)` |
| 8 | CH / lower Y | Seed Closed Hat | 0.10 s / 4,410 | 0.10 | `(.8 H + .12 T(6310,.018) + .08 T(9170,.013)) E(.020)` |
| 10 | OH / lower U | Seed Open Hat | 0.55 s / 24,255 | 0.12 | `(.8 H + .12 T(6310,.160) + .08 T(9170,.120)) E(.120)` |
| 12 | LT1 / upper A | Seed Low Tom | 0.42 s / 18,522 | 0.20 | `S(108, 32, .025, .090) + .22 T(173,.045) + .04 H E(.008)` |
| 16 | HT / upper D | Seed High Tom | 0.26 s / 11,466 | 0.16 | `S(185, 48, .018, .055) + .22 T(297,.028) + .04 H E(.006)` |
| 17 | COW / upper R | Seed Dual Bell | 0.44 s / 19,404 | 0.12 | `T(557,.100) + .7 T(845,.080) + .18 T(1690,.035)` |

Leave slots **1, 3, 6, 9, 11, 13, 14, 15, 18, 19, 20, 21, 22, 23** empty on a fresh load. These provide visible Add/Record/assignment practice in both banks. Do not fill all remaining pads with copies. The proposed variety is low pitched decay, noise/body snare, short tonal rim, repeated noise attacks, soft noise pulse, paired short/long hats, two pitched toms, and an inharmonic bell. Listening must establish whether those distinctions are useful in practice.

## Exact synthesis contract

Render each voice at `Fs = 44100`, one channel, with exactly the table's integer frame count. For frame `n`, use `t = n/Fs`. All frequencies are Hz; envelope times are seconds; all tone phases start at zero. Do not trim silence or resample automatically during generation.

Definitions for the table:

- `E(τ,u) = exp(-u/τ)` for `u >= 0`, otherwise zero. An omitted `u` means `t`.
- `T(f,τ) = sin(2πft) E(τ)`.
- `S(f0, Δf, τp, τa) = sin(2π[f0 t + Δf τp (1-exp(-t/τp))]) E(τa)`. This integrates the falling frequency trajectory; do not substitute instantaneous frequency times time.
- `H[n] = (W[n]-W[n-1])/2`, with `W[-1]=0`. This is a simple first-difference noise color, not a claimed precisely calibrated high-pass cutoff. Generate a single `H` stream per voice and reuse it within that voice's formula. Voices with no noise need not advance their stream.

For `W`, use unsigned 32-bit xorshift with initial nonzero state `0x53540001 + physicalSlot`. At each frame, apply left-xor shift 13, unsigned right-xor shift 17, left-xor shift 5, retaining the low 32 bits. Convert the resulting unsigned state `u` to `W = 2u/4294967296 - 1`. Never use ambient randomness, time, device input, or generation order as a seed. The generator is for repeatable noise, not security.

After computing a voice's raw values `x[n]`, use an edge window:

`w[n] = sin²((π/2) min(1,n/(.0005 Fs))) × sin²((π/2) min(1,(N-1-n)/(.008 Fs)))`.

Calculate the weighted mean `μ = Σ(w[n]x[n])/Σw[n]`, then `z[n]=w[n](x[n]-μ)`. This removes the weighted DC component and fixes the first/last samples at zero. Scale the whole voice once by `tablePeak/max(abs(z))`, then store Float32 samples. Reject nonfinite values or a zero peak rather than dividing by zero. Preserve the rendered length. The final eight-millisecond taper is a deliberate edge treatment, not an inferred zero crossing.

Evaluate intermediate arithmetic consistently before final Float32 storage. Require byte-identical output for repeated runs of the same implementation/browser build. Standard transcendental functions may differ in their final rounding across engines: verify cross-engine Float32 samples within `1e-6`, rather than promising portable byte identity without a fixed math implementation. Persisted opfloat bytes must round-trip exactly regardless of regeneration. Do not create brittle cross-engine golden hashes and call them an audio quality test.

## Level, velocity, and playback choices

The supplied peaks range from 0.10 to 0.28 (approximately −20 to −11 dBFS). Leave sample gain at 0 dB and normalization off, preserving the designed relative levels. At unity gain, one instance of each of the four loudest voices has a conservative absolute-sum bound of 0.88. This is not a guarantee against clipping with repeated overlaps, all voices, added samples, changed gain, or device processing.

Use the existing one-shot playback and velocity handling. Do not bake velocity into separate source variants or introduce a new curve. `useAudioPlayer.ts` currently defaults its ADSR playback velocity to 127 and scales that path by velocity/127; the demo must also work with the existing ordinary pad playback caller. Verify audible levels at representative MIDI velocities 32, 64, 96, and 127 through the accepted MIDI path; do not infer that every current pad caller is velocity-sensitive. Keep existing preset defaults (`playmode: poly`, transpose 0, velocity setting 20, volume 69, width 0) unless the accepted Task 8 controls deliberately expose another user choice. Those device parameters are not calibrated loudness claims.

Do not auto-play the demo or alter system volume. During later listening, check each voice at a consistent listening level and a simple kick/snare/hat pattern. Check that snare/clap, rim/bell, and closed/open hat are distinguishable and that low/high tom ordering is clear. If a recipe needs changes, document them under a new recipe version; do not add unsupported claims such as hardware parity or professionally mastered sound.

## Source, export, and allocation limits

Use the accepted internal opfloat path (`encodeStoredAudio` / `STORED_AUDIO_TYPE`) with truthful source metadata: mono, 44,100 Hz, Float32, 32-bit source precision. A deterministic generated source `File` may use the sample name plus `.opfloat` and fixed `lastModified: 0`. Do not label Float32 as a 16-bit original to bypass export controls.

For an empty/explicitly replaced drum kit, the same musical operation should supply a valid editable preset name and explicit device export choices: WAV, 44,100 Hz, 16-bit, mono, normalization off. This makes an actual conversion from the honest Float32 originals. With Add, preserve current settings/name and let existing preflight explain the chosen conversion. No custom demo-only export path is needed.

The ten sources total **134,505 frames / 3.05 seconds**. Their Float32 PCM totals **538,020 bytes**; ten 24-byte opfloat headers make **538,260 bytes**. Treat normal generated originals as eligible for separate audio and source-file representations in a portable project; conservatively count both, **1,076,520 bytes**, before manifest and ZIP overhead. Do not exploit slice-only source omission by manufacturing provenance. Exporting the unedited kit to mono 16-bit WAV at the same rate yields **269,010 PCM bytes**, plus the actual writer's headers (269,450 total for ten plain 44-byte headers), before patch JSON and ZIP structure. Verify the actual writer output instead of relying solely on this estimate.

All individual durations are below the documented 20-second device limit, and the fresh kit is well below the application's 8 MiB patch indicator. These are format/size observations, not a physical-device test.

Before allocating, validate the fixed sample count, exact frame dimensions, and projected capacity against the **entire current project**, including multisamples and retained unassigned audio. Accepted Task 5 admission rules include 256 sample references, 128 MiB decoded storage including opfloat headers, and 256 MiB stored archive size. Its conservative stored reserve includes the full 2 MiB manifest plus **63,100 bytes** of STORE ZIP structure for the maximum current path layout. Count existing original source Files as well as decoded audio; archive audio/source deduplication is separate. Individual source and decoded buffers must remain within the accepted 64 MiB limits. Use the accepted shared admission helper rather than a dummy slicing request or a second approximate ledger.

Generation needs no unbounded analysis or worker. Render one short voice at a time, release temporary arrays after encoding, and check the operation generation/cancellation token between voices. Bound any scratch buffers by the largest voice, 24,255 frames. Revalidate current state at the actual synchronous guarded commit; preparation-time checks alone do not authorize overwrites or a now-overfull project.

## Integration with the accepted workspace flow

Use `workspace-design.md` unchanged: wait for session recovery; expose **Load demo kit** in the empty state; commit the kit as one undoable operation; select its first loaded sample with an individual asset identity. The guide completes from actual play/edit/export actions, its dismissal is presentation state, and its final action opens preflight. Generating sources or clicking Load does not count as playing a pad.

Existing work requires the designed explicit Replace/Add choice. Replace is scoped to the drum kit, preserving multisample work and applying the accepted recovery policy. Add must not silently replace occupied target slots: show occupied proposed destinations, offer free physical destinations or retained unassigned placement through the accepted intake workflow, and preserve all existing assets and settings. Cancellation makes no musical change. Repeated clicks or stale preparation must not apply two kits. The guarded commit receipt determines success; close the load/proposal UI only after it confirms the complete operation. One Undo must restore the previous drum assets/settings, including any demo export-setting changes, and one Redo must recover the same prepared audio rather than regenerate it.

Reuse Task 8 device preflight's mapped-only default and explicit unassigned inclusion choice. Full project backups retain every demo source and all pre-existing project audio. Do not create another save owner, device transfer claim, onboarding modal, sequencer, or automatic demonstration playback.

## Implementation acceptance evidence

- Generator tests: ten exact lengths and destinations, fourteen empty pads on fresh load, finite nonzero Float32 output, endpoint zeros, mean magnitude below `1e-6`, peaks within `1e-6` of the table, deterministic seeds independent of generation order, and repeated same-engine byte equality. Verify different noise voices are not identical copies.
- Audio checks: render and audition every source; record browser/OS and listening method, qualitative failures and adjustments. Compare supported engines within the declared numerical tolerance. Report hardware listening/transfer as untested unless separately performed. Recipe formulas alone do not establish musical quality.
- State tests: single guarded commit and matching success/error receipt; one Undo/Redo including settings; preservation of multisamples and unassigned assets; occupied Add destinations, near-capacity current-state rejection, Cancel, recovery still pending, stale completion, and repeated activation. Reuse accepted Task 6/7 interfaces and tests where applicable rather than dispatching raw per-file imports.
- Portable-source tests: save/reopen session and library/project backup, re-export backup, compare names, individual identities, Float32 audio bytes, frame counts and honest format metadata. No slice provenance on generated originals.
- Device-export tests: actual ten mapped WAV payloads at the explicitly selected rate/precision/channels; parse frame counts and compare PCM against the existing writer's 16-bit quantization behavior. Demonstrate export succeeds with a valid editable name, includes no empty slots, and observes current mapped/unassigned preflight choice. Do not infer success from ZIP creation alone.
- Controller-owned Task 8 browser walkthrough: empty → Load demo kit → actual play → select/edit → Undo/Redo → rename → export preflight → download. Existing project → Add/Replace/Cancel, keyboard-only and touch, and recovery ordering are part of workspace acceptance. This assessment ran no browser, test suite, server, or audio generation.

Source anchors reviewed for this handoff: `docs/verification/task-8-brief.md`, `workspace-design.md`, `task-5-round2-rereview.md`; `src/components/drum/DrumKeyboard.tsx`, `DrumSampleTable.tsx`; `src/utils/defaultSettings.ts`, `constants.ts`, `audioSlicing.ts`, `storedAudio.ts`, `projectArchive.ts`, `patchGeneration.ts`; `src/hooks/useAudioPlayer.ts`. Reconcile current accepted reports 6 and 7 before implementation; their moving runtime code was not reviewed here.
