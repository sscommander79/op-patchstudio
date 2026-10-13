# Native instrument integration and compatibility

Scope: the existing Serum AU recording flow, approved drum-style screen, optional inline Advanced, no additional features. Native recording integrates through main-app state, recovery and export. Hosted-agent changes are excluded. This branch builds on the separately reviewed drum/shared-UI checkpoint.

Fresh separated-branch checks: npm run check passed (1,331 tests in 128 files, typecheck, lint, production/PWA build); native compilation and ad-hoc signature verification passed. Earlier integrated build passed Serum editor selection, nine notes, playback, export and exact recovery/re-export. The host and recording UI are unchanged by excluding agent code. Rebuilt the separated branch, restored Pigments recordings and re-exported all ten files byte-identically.

| Instrument | Native editor | Capture and export | Acceptance |
| --- | --- | --- | --- |
| Serum AUv2 demo 1.326 | Selected PL Plucked [RI] successfully | Nine roots 48–72, 3 semitones, stereo 44.1k PCM16, no clipping; exact recovered export | Proven selected-preset flow |
| Animoog Z | Host reports no compatible editor; prior recordings survived the failed editor request | Nine non-silent, unclipped samples with correct roots; no external audio input | Capture works; editor workflow unsupported |
| Arturia Pigments | Editor opens, displays Reverse Box; automated preset-change attempts did not produce a verifiable change. Host reports Untitled | Nine non-silent, unclipped samples with correct roots; all ten archive files identical after recovery in separated build | Capture/recovery works; editor selection and name reporting remain unqualified |

These are installed Audio Units, not VST/VST3 hosting tests. Catalog discovery is not general compatibility certification. Test evidence remains local in the OPXY outputs/serum-main-integration folder. No new OP-XY hardware playback acceptance is claimed. Distribution signing/notarization and plug-in crash containment remain release work. No deployment is authorized.

Review target: codex/studio-upgrade development branch. Keep the original dirty worktrees and unrelated agent work preserved.
