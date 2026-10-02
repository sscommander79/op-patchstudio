# Human test — next step after automated remediation

Automated remediation passed its final checks; manual verification is now in progress. Record date, OS/browser, device/firmware, test data, expected result, observed result, and pass/fail for every row. **Drum, Storage/Library and Recording verification are IN PROGRESS. Presentation has OPEN table-layout and Safari Overview defects; other areas remain PENDING.** Do not use personal projects for destructive checks without an editable backup.

| Area | Human action and expected outcome | Status |
|---|---|---|
| First-time navigation | Find each task from Overview; guided setup, Library, Transfer and Devices are understandable without explanation | PENDING |
| Keyboard/assistive technology | Tab/Shift+Tab, Enter/Space and Escape through every screen/dialog; screen reader identifies controls and errors; no trapped/lost focus; especially Safari launch navigation | PENDING |
| Drum instrument | Load known sounds, audition all 24 pads, select/edit/replace/clear, Undo/Redo, swap Focus/Table, both mobile banks; verify the intended sound and no stuck audio | IN PROGRESS — demo load, three-pad audition, gain Undo/Redo and Clear/Cancel/Undo and Table/Focus switching passed; layout defect HV-001 open |
| Slicing | Mark by listening, adjust boundaries, audition, map pads, cancel/discard, attempt browser Back, apply and Undo; work must not disappear silently | IN PROGRESS — slicer opened; 17 sounds detected from recorded voice. Count/drag affordance observation HV-006 recorded. Manual two-sound preparation and drag/application outcomes pending |
| Multisample | Capture a small real note range; root/range/pitch and loops sound correct; settings/presets survive save and reload | PENDING |
| Recording | Choose actual audio source/channels, meters/monitor level, start/stop/cancel, review/delete/apply takes, device disconnect and permission denial | IN PROGRESS — HV-005 repaired and human retest passed: microphone setup, manual capture/stop, very clear audition, Pad 4 application/playback and 11 / 24 loaded. Library save/download, export structure and OP-XY recorded-voice import/playback also pass. Other recording scenarios and new-fixture persistence pending |
| OP-XY tracks | Real clock/transport and track capture, alignment, naming, review playback and WAV/ZIP export | PENDING |
| Devices | Actual port/channel selection; verify intended device receives only explicit sends; disconnect/reconnect/cancel and restore setup | PENDING |
| Storage/Library | Save, browse/search/filter, rename/collections, open, duplicate, confirmed delete, editable backup and restore; verify audible content and settings | IN PROGRESS — test kit saved, reopened, survived refresh and restored from editable backup |
| Transfer/OP-XY | Follow ../device-validation-checklist.md: sparse/full kit, multisample ranges, WAV/AIFF formats, markers/loops, repeat export, eject/restart | IN PROGRESS — sparse-kit import/mapping/playback, restart, explicit M4 eject and qualitative revised-export gain comparison passed on firmware 1.1.25; same-folder replacement and broader hardware fixtures pending |
| Presentation | Desktop/mobile light/dark, zoom and reduced motion; controls fit and remain understandable | OPEN DEFECTS — [HV-001 table clipping and HV-004 Safari Overview overflow](human-issues.md); other checks pending |
| Offline/update | Installable production build, offline reload, save/edit, update with unfinished work, recovery without project loss | PENDING |

## Human session — 2026-09-29

Evidence below is the user’s reported observation during the guided session. Browser/version and output device have not yet been reported. No OP-XY hardware result is recorded.

| Check | Expected | Observed | Result |
|---|---|---|---|
| Starting workspace | Empty disposable drum instrument | User: “Round 1: Its empty” | Confirmed starting state |
| Built-in Studio Seed load | 10 / 24 loaded | User confirmed the expected count | PASS |
| KD1 / SD1 / CH audition | Distinct kick, snare and closed hi-hat; no silence or stuck playback | User answered “yes, to both questions” to the count and audition checks | PASS — these three pads only |
| KD1 gain, Undo and Redo | −6 dB sounds quieter; Undo restores the original gain/volume; Redo restores the quieter setting | User answered “yes” to the four-step check | PASS |
| Save and reopen Human Test 01 | Library save confirmation; load returns 10 / 24 sounds, KD1 gain −6 dB and audible kick | User answered “yes” to the save/reopen check | PASS |
| Browser refresh persistence | Human Test 01 sounds, 10 / 24 count and KD1 −6 dB survive refresh/reopening | User: “Confirmed its survived”. Whether a Restore prompt appeared was not reported; no specific recovery route is claimed. | PASS — reported persistence |
| KD1 Clear, Cancel and Undo | Cancel retains 10 sounds and playable kick; confirmed clear leaves KD1 empty and 9 sounds; Undo restores kick, 10 sounds and −6 dB gain | User: “Confirmed” to the three-step check | PASS |
| Table/Focus switching | Kick audition unchanged; KD1 gain −6 dB and 10 / 24 loaded retained | User confirmed the check, with a separate table-clipping report | PASS — functional check |
| Drum Table layout | Waveform/drop areas and row buttons fit without clipping or overlap | User screenshot shows overlap and clipped rightmost controls; see [HV-001](human-issues.md) | FAIL — OPEN defect |

Table layout HV-001 remains OPEN and requires repair and human retest before presentation acceptance.

## Human session — 2026-09-30

| Check | Expected | Observed | Result |
|---|---|---|---|
| Editable project backup round trip | .opstudio file downloads; after changing name/gain, opening it restores Human Test 01, 10 / 24 loaded, KD1 gain −6 dB and audible kick | User answered “yes” to the backup/restore check | PASS — user reported |

## Human session — 2026-10-01

| Check | Expected | Observed | Result |
|---|---|---|---|
| Local OP-XY export / extracted contents | Human Test 01 .preset folder with patch.json and ten referenced sample files | User supplied extracted files. Direct inspection confirms ten regions, ten matching WAVs, matching frame counts, valid in-file trim ranges and consistent PCM16 mono 44.1 kHz headers. See [export inspection](evidence/human-export-2026-10-01-summary.json). | PASS — extracted file structure; ZIP and preflight screen not directly inspected |
| KD1 exported gain | Match the user’s current selected gain; earlier guided target −6 dB was a historical test instruction | Exported Seed Kick.wav region has gain −8. User confirmed the app shows −8 and that this is the value they set. | PASS — −8 dB preserved; HV-002 resolved |
| OP-XY USB / Field Kit connection | COM → M4 exposes presets, projects and samples | User answered “yes” to seeing all three folders in Field Kit. | PASS — connection and folder visibility only; firmware and file transfer still pending |
| OP-XY preset destination | Use a category folder present on the device | User reports no user folder inside presets. The guided instructions had assumed it existed; no file copy or import is reported. | SETUP ADJUSTMENT — use a new PatchStudio Tests category; not an app-failure finding |
| OP-XY preset file copy | Copy intact Human Test 01.preset into presets/PatchStudio Tests | User answered “Yes” to successful copying after the revised category-folder instructions. Device-side file contents were not independently read back. | PASS — user-reported copy; eject, import and listening not yet confirmed |
| OP-XY import and initial audition | Human Test 01 loads without error; kick, snare and hi-hat are audible | User answered “yes” to loading and hearing those three sounds after the guided preset-browser steps. Exact key positions, remaining sounds and silence on empty keys were not tested in this check. | PASS — import and initial three-sound audition only |
| OP-XY full sparse-kit key check | Ten sounds on the listed lower/upper keys; fourteen remaining keys silent; normal playback and endings | User: “yes, it matches and plays normally” to the all-24-key check and expected mapping table. | PASS — user-reported sparse-kit mapping and playback; no full 24-sound kit or other formats/settings tested |
| OP-XY restart persistence and firmware | Save the test project, power off/on; Human Test 01 and its ten sound mappings remain unchanged; report startup firmware | User: “1.1.25 and yes it survived” in response to the save/restart/re-audition instructions. Project name and an independent fresh preset-browser reload were not reported. | PASS — user-reported test-project/kit persistence on firmware 1.1.25 |
| OP-XY kick gain readback / listening level | Inspect the original exported kick gain (−8) without changing it; report the displayed number | User: “It worked. It was very quiet and I had to turn up the gain”. Original/current values, the specific control adjusted and whether the quietness affected only the kick or the whole kit were not reported. | INCONCLUSIVE for numeric gain preservation — playback confirmed; low-volume observation HV-003 recorded; hardware fixture gain changed by user |
| OP-XY quietness scope and adjusted control | Identify affected sound(s) and the control changed | User: “only the kick was quiet. I used the sample gain to increase”. Original/current numeric values remain unreported. | CONFIRMED — kick-only sample-gain adjustment; consistent with the kick’s exported −8 versus other regions’ 0; no numerical hardware match or software defect established |
| OP-XY gain display limitation | Determine whether the reference gain can be read numerically on the reported screen | User: “OPXY does not show a number , only a slider”. | NOT OBSERVABLE by this screen-based method — exact numeric hardware −8 is not marked passed; do not request another number from this slider |
| Human Test 02 revised export | Change only kick gain −8 → 0 and preset name; retain all audio and other settings | User confirmed readiness. Direct inspection of Downloads verifies only name and regions[0].gain differ from the frozen original patch; all ten WAVs match Human Test 01 byte-for-byte, headers/frames/trim bounds are valid, and ZIP bytes match extracted files. See [revised export inspection](evidence/human-export-2026-10-01-02-summary.json). | PASS — controlled local export; revised hardware copy and listening comparison pending |
| Human Test 02 hardware transfer and gain comparison | Copy the revised preset, explicitly eject with M4, freshly load Human Test 01 then Human Test 02 on the same track 2 at unchanged listening levels; revised kick louder, other nine sounds/mapping unchanged | User: “yes and yes, it was louder” in response to the combined copy/eject/load and listening checks. | PASS — user-reported transfer/eject/fresh loading and qualitative gain response; exact numeric hardware gain remains unverified |
| Built-in microphone setup | Enable input reaches monitoring without channel-dimension errors; preserve original setup error and support retry | HV-005 reproduced and repaired. Real Chrome MacBook Pro microphone now shows monitoring, 48,000 Hz, two channels, zero review takes. Automated project gate and five production fake-device workflows pass. | PASS for setup; user also confirmed clear manual capture/stop/audition. Pad application/playback now PASS by user report; save/export PENDING |
| Manual voice capture/stop and review audition | Start recording, speak briefly, Stop recording, then Audition the take | User: “yes, very clearly” to hearing the recorded phrase after the guided steps. | PASS by user report — pad application/playback also confirmed; save/export and hardware voice playback also pass; other recording modes pending |
| Apply voice take to Pad 4 | Add selected takes closes the dialog; Focus Pad 4 plays the same phrase and count increases to 11 / 24 | User answered “yes!” to both playback and loaded-count checks. | PASS by user report — save/export and hardware voice playback also pass; broader checks pending |
| Human Test 03 library save and preset download | Save the recording kit under a new name and download the 11-sample device preset | User confirmed both. Downloads ZIP inspected: Take 1.wav mapped to Pad 4 / MIDI 56, valid mono PCM16 44.1 kHz audio, ten earlier WAVs and regions unchanged; extracted folder matches ZIP. See [inspection](evidence/human-export-2026-10-01-03-summary.json). | PASS — library save/download by user report; export structure independently checked. Hardware voice playback now PASS by user report; new-fixture persistence pending |
| Human Test 03 OP-XY recorded-voice import/playback | Transfer prepared preset, load Human Test 03 and hear the recorded phrase clearly | User: “works perfectly” to import-without-error and clear-phrase playback. | PASS by user report — new-fixture restart persistence, exact physical key position and other formats/modes not separately verified |
| Safari Overview layout | Launch-card illustrations fit above their labels/actions without overlapping adjacent sections | User supplied a Safari screenshot showing all four illustrations extending into card footers/beyond card bounds. OP-1 FIELD is visibly selected; exact version/zoom/viewport and cause unknown. See [HV-004](human-issues.md#hv-004--safari-overview-illustrations-overflow-launch-cards-and-overlap-controls). | FAIL — OPEN presentation defect; microphone capture remains awaiting user report |

HV-002 is resolved: the export matches the user’s intended current −8 dB setting. This does not retrospectively establish the exact gain used during earlier reported tests.

User confirmed USB access, preset copying, import without error, full sparse-kit mapping/playback and test-project/kit persistence after restart. OP-XY firmware 1.1.25 is user reported; local macOS 26.1 was read via sw_vers. Only the kick was quiet and the user increased its sample gain (HV-003). The reported gain screen has only a slider; numerical hardware readback is unavailable by this screen-based method and remains unverified. The remaining regions were exported at gain 0; the kick was −8, so its quieter level is consistent with the chosen setting. The subsequent Human Test 02 comparison confirmed explicit M4 eject, fresh preset loads and an audible kick increase after changing exported gain from −8 to 0; other nine sounds/mapping were reported unchanged. Broader hardware fixtures remain pending.

Next: guided Human Test 04 slicing. Live Chrome has Human Test 03, Pad 4 / Take 1.opfloat selected in Focus and the export preflight still open. Close the export dialog, rename the current Instrument name to Human Test 04, keep Pad 4 selected and press Slice this sample. Await confirmation that “Turn a loop into drum sounds” opens with the recorded voice waveform. No slice boundary/mapping/application result is reported yet. Human Test 03 remains separately saved/downloaded. Multisampling requires establishing the synth/MIDI/audio route later. HV-001/HV-004 stay OPEN and deferred.

Original guided sequence: selected Pad 4 → Record here → Input device Macbook pro → Capture mode Manual → Enable input. Successful input enable should show State monitoring and Level reacting to speech. Start recording, say a short phrase, Stop recording, then Audition the take in Review tray. Await clear voice playback before Add selected takes, which applies the take to the selected pad. Save/export the resulting recording fixture as Human Test 03, preserving Human Test 02 exports. Manual capture/stop, clear audition and Pad 4 application/playback now pass by user report; library save/download are confirmed and export structure passes; recorded-voice hardware loading/playback now pass by user report. Same-name replacement is deferred and remains pending. HV-001 and HV-004 remain OPEN.


2026-10-02 slicing observation: user reports 17 automatically detected sounds and asks how to choose a count and drag slices. Live Chrome confirms 17 / zero assigned. No desired-count field exists; numbered sound buttons support drag to destination keys, whereas waveform canvases do not. Next manual preparation: Advanced → Reset to full source → Split sound, expecting two sounds (Replace edits if prompted). Await human result before mapping to empty Pad 2 / KD2 and Pad 7 / TB and applying. See [HV-006](human-issues.md#hv-006--slicing-count-control-and-drag-affordance-are-unclear).


### Human Test 04 usability interruption — 2026-10-02

IN PROGRESS: user reports Advanced looks like a label and mixed controls/scrolling are confusing. Live draft shows 18 sounds, zero assignments and pending Reset confirmation; Split remains enabled. Two-sound preparation has not passed. HV-006 grouping/confirmation findings OPEN, candidate bounded design awaiting approval. No product or live draft changes. Preserve recorded source, occupied pads and Human Test 03; resume boundary/audition/mapping/apply/Undo checks only after the usability decision.


### Human Test 04 — approved slicer repair and independent tests, 2026-10-02

Computer-based slicer checks PASS independently: exact boundaries/source bytes, pending decision guards (including M), Keep edits preservation, two-slice reset/split, assignment/DnD, portable save/restore/provenance, export/Undo, Back draft survival, disclosure keyboard use and fixed footer at desktop/phone widths. Fresh standard gate 1,143 units/111 files plus type/lint/build/PWA and 20 production browser checks all pass. Evidence: hv006-slicer-verification-summary.json.

The user's actual Human Test 04 draft remains 18 unassigned sounds, Sound 16 selected (3.197–3.208 s), source Pad 4 unchanged. It survived the update; Keep edits dismissed the pending reset. No actual recorded-source slicing Apply, listening judgment, OP-XY sliced-voice playback or human acceptance of the new grouping has been reported. Do not repeat computer-only checks with the user; request only remaining human outcomes.


### Human Test04 — occupied-pad repair checkpoint, 2026-10-02 (latest)

HV-007 computer checks complete independently:1,154 units/111 files, type/lint/build/PWA and25 production browser tests across five profiles PASS. Occupied/source replacement, existing-pad removal, original PCM/file retention, Cancel, stale state, atomic Apply and Undo/Redo were verified with disposable fixtures. Do not ask the user to repeat these computer checks.

Actual Chrome: saved Human Test04 restored with11 loaded sounds; Pad4 Take1.opfloat preserved. Fresh slicing detection:17 sounds,0assigned, Sound1 selected; waveform → numbered sounds → destination keys visible together. Earlier unsaved18-sound edits were lost during full development reload and cannot be claimed recovered. No actual slice Apply/listening/export/hardware outcome yet. Remaining human check: clarity of selecting/editing/assigning, whether real voice slices sound right, and later distinct hardware playback. HV001/HV004 remain OPEN and deferred. Saved Human Test03 and earlier downloads are preserved.
