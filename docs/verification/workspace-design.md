# Focused studio workspace design

Design proposal, 2026-09-04. Read-only source review against `docs/superpowers/specs/2026-09-04-studio-upgrade-design.md`; no runtime or visual accessibility pass was performed. This document specifies proposed behavior, not delivered capabilities.

## Recommended composition

Use one instrument workspace with an always-reachable project toolbar, the existing playable instrument, and one large selected-sample editor. Retain the detailed table as an explicit alternate view. Reduce repeated cards and large vertical gaps so naming, playing, editing and exporting belong to one screen.

Desktop layout at approximately 1100–1440 px:

```text
OP–PatchStudio · unofficial          Drums  Multisample  Library    Theme  Help
───────────────────────────────────────────────────────────────────────────
Studio kit [editable name]   Saved locally   Undo Redo  Project ▾  Export OP-XY
───────────────────────────────────────────────────────────────────────────
Add samples   Slice audio   Record takes            MIDI: device · channel

                Existing playable instrument / 24 drum slots
                 persistent selection + transient playing state

Samples   [Focus | Table]        8 assigned · 3 unassigned     Organize
┌──────────────────────────────────────────┬───────────────────────────────┐
│ Selected: 01 · KD1 · kick.wav             │ Playback / sample controls    │
│ waveform + trim / applicable loop markers│ Mode · Reverse                │
│ Play/Stop     Start [ ] End [ ]  Zoom     │ Tune · Gain · Pan             │
│                                          │ Replace · Clear · Slice       │
└──────────────────────────────────────────┴───────────────────────────────┘
Unassigned samples (3)     [audition · select · assign to pad]
Preset settings ▸          Audio processing ▸         Export settings ▸
```

The name and Export OP-XY button are primary navigation anchors. The vivid accent marks the export action, selected pad outline and current marker; use text/icons as well as color for recording, failures and selection. Keep the hardware-inspired keyboard and its note assignments rather than introducing a visually unrelated 16-pad grid.

### Empty state and first use

Show a compact panel above the empty instrument: “Build your first OP-XY kit” with “Load demo kit” and “Add samples”, plus visible “Record takes” and “Open project”. Brief supporting copy: “Load a sound, shape it, then export a preset.” A file drop area must also offer a normal file-picker button. Do not require an onboarding modal before the user can play.

Generate a small original demo kit locally, with a deterministic generation recipe and documented provenance. It should contain clearly named, musically distinct sounds across several assigned slots; leave empty slots to teach assignment. Supply a valid editable preset name and select the first loaded sound. Demo loading is one undoable operation. If work exists, offer a specific replace/add choice and preserve its recovery state; never overwrite silently. Do not claim a bundled external sample is freely licensed without checking its license.

After loading, show a dismissible three-step guide: “1 Play a pad · 2 Shape the sound · 3 Export your preset.” Steps complete from actual state/actions. Finishing the guide opens export preflight, not an immediate download. Store guide dismissal independently from musical project data. Session recovery must resolve before demo or guide actions can replace state.

### Selection, editing and table behavior

- Keep `selectedSampleIndex` initially in the tool/workspace presentation state. Pass it and `onSelectSample(index)` through `DrumKeyboardContainer` to `DrumKeyboard`, and into `DrumSampleTable`. This is not a musical edit and should not create history entries. If indices move after assignment/reorder, explicitly follow the moved sound or select the destination; define this once. A stable sample identity is preferable when the storage work introduces one.
- Clicking/tapping a loaded pad selects and auditions it. Arrow navigation changes selection without starting audio. Enter/Space auditions a focused loaded pad. For an empty pad, selection reveals “Add sample” and “Record here”; a second explicit action opens the chooser. Keep dropping a file onto that pad. This intentionally replaces the current empty-key immediate file-dialog behavior and needs a regression check.
- Playing from MIDI or typing should flash the playing pad without continually moving the editing target. Otherwise a performance would reset the editor during a parameter gesture. The optional “Follow played note” control can be added only if there is a clear need; default selection remains stable.
- Build a selected sample editor from the controls in `DrumSampleSettingsModal`, using `EnhancedWaveformEditor` for drum trim. Keep mode, reverse, transpose, gain, pan, zoom, zero-crossing snapping, numeric markers and replace/clear available. Preserve the full modal as a reachable “Detailed edit” path until all its controls and preview behavior are shared; do not mount two independent draft editors for the same sample.
- For the focused editor, commit one edit per completed slider/marker gesture or valid numeric change. Preview intermediate values locally; undo returns the entire gesture. This requires an editing transaction boundary supplied by the history implementation. Avoid an ambiguous second “Save” button: project save status represents committed musical changes. If extracting the modal with its existing Apply/Cancel model first, explicitly show those buttons and resolve its draft before selection changes or export.
- `Focus | Table` is a view toggle, not another project or sample list. Selecting a table row and returning to Focus retains the selection. Table retains every current slot, unassigned sample, individual setting/zoom action, add/replace/clear/record action, assignment, swap and reordering behavior. Unassigned sounds also appear in a small visible tray in Focus; the 24 playable slots alone do not represent all loaded audio.
- Provide an explicit “Assign to pad…” / “Move or swap…” control usable by keyboard and touch; drag and drop remains a shortcut. Before assigning to an occupied slot, show the exact destination and its existing sound. Bulk editing stays in a visible toolbar action with an affected-sample count.

### Persistent save and export

The toolbar contains the editable preset name, observed storage status, undo/redo, Project menu and Export OP-XY. Use precise status text: “Saving…”, “Saved locally”, “Unsaved changes”, and “Save failed · Retry”. Display “Saved locally” only after the relevant storage transaction completes, associated with the saved edit revision. Announce changes through one polite status region; do not announce every parameter tick.

Project menu: Save to library, Download project backup, Open project backup, Save settings as default, and separated reset actions. Keep library save and local session autosave distinctly named. Backup controls depend on the versioned lossless archive implementation. A menu item must not download an OP-XY preset under a backup label.

Export opens a preflight sheet/dialog that displays name, mapped sample count, unassigned exclusions, audio format, conversion settings and estimated output size. A blank name has an inline error that links back to the name field; unassigned-only audio cannot satisfy “ready to export”. Allow proceeding past nonfatal exclusions only after showing them. A failed conversion or archive build leaves the sheet open with an actionable message; it must not claim a successful export. Show transfer guidance after actual download initiation, and distinguish a browser-created file from verified device import. Verify any exact OP-XY device path/instruction before presenting it as authoritative.

On desktop, make the toolbar sticky near the top. On small screens, keep name/status at the top and one compact Save/Project + Export action bar at the bottom, with safe-area padding and matching content clearance. Avoid two simultaneous sticky keyboard/project regions occupying most of the viewport.

### Slicing and batch recording entry points

“Slice audio” is visible next to Add samples and Record takes; the selected editor also offers “Slice this sample”. Open the slicing workspace with a chosen source, waveform, Auto/Manual tabs, sensitivity, preview, editable markers, and an assignment summary such as “8 slices · 6 empty pads · 2 remain unassigned”. The operation keeps the original buffer, changes nothing until Apply, and applies all slices as one history entry. Cancel and empty/silent input must have clear states. Manual live chop gets an explicit “Mark slice” control and scoped shortcut only while its playback tool has focus.

“Record takes” opens one capture workspace with selected input, signal meter, manual/sound-trigger start, pre-roll, silence/length stop, and Review takes. A selected empty pad may invoke “Record here” using the same recorder with that target. Recorded takes stay in a review tray until the user assigns them; overflow goes to the unassigned tray. Show a persistent recording indication and Stop action while capturing. Close/cancel must stop and release the input stream. Input denial, missing devices, cancellation and full kits all need visible feedback; the current console-only full-kit fallback is insufficient.

## Implementation map

| Surface | Existing anchor | Proposed work and hook |
|---|---|---|
| Shell, width and theme | `src/App.tsx`, `src/components/common/AppHeader.tsx`, `MainTabs.tsx` | Replace the fixed 1000 px nested-card layout with a responsive studio shell, roughly 1280 px maximum. Retain routes, Library, feedback and donation destinations. Add a compact Light / Dark / System control and drive both CSS tokens and Carbon theme from the same resolved setting. |
| Project toolbar | `GeneratePresetSection.tsx`; handlers in `DrumTool.tsx` and `MultisampleTool.tsx` | Extract shared `ProjectToolbar.tsx` and `ExportPreflight.tsx`. Reuse `onPresetNameChange`, `onSaveToLibrary`, `onDownloadPreset`, `onSaveSettingsAsDefault`, `onResetAll`, naming/format callbacks and `PatchSizeIndicator`. Put format/renaming controls in a visible Export settings section/preflight rather than deleting them. |
| Save indicator | `src/hooks/useSessionManagement.ts` | Consume a single shared persistence controller/status. Current hook logs failures and returns actions but no observed save-state contract. Do not create another autosave owner in every toolbar. Revision-aware completion prevents an old save from marking newer edits saved. |
| Focus workspace | `DrumTool.tsx`, `DrumKeyboardContainer.tsx`, `DrumKeyboard.tsx` | Add `DrumWorkspace.tsx` or a small composition within DrumTool. Keep existing MIDI initialization/channel selector, organize labels, bank access and playback. Add selection callbacks separate from audition. Surface pin only if it remains useful with the sticky project toolbar. |
| Selected editor | `DrumSampleSettingsModal.tsx`, `EnhancedWaveformEditor.tsx`, `WaveformZoomModal.tsx` | Extract shared `DrumSampleEditor.tsx` controls and preview setup. Dispatch existing `UPDATE_DRUM_SAMPLE` / `UPDATE_ALL_DRUM_SAMPLES` through the history transaction layer. Preserve `useAudioPlayer` settings parity; retain “Apply to all” with explicit scope. |
| Detailed sample list | `DrumSampleTable.tsx` | Render unchanged capabilities in Table view; add selected row and select callback, then share editor content. Preserve `ASSIGN_DRUM_SAMPLE`, `SWAP_DRUM_SAMPLES`, `REORDER_DRUM_SAMPLES`, `onFileUpload`, `onClearSample`, `onRecordSample`. |
| Preset and conversion settings | `DrumPresetSettings.tsx`, `AudioProcessingSection.tsx` | Use labeled disclosure sections beneath Focus/Table with summaries of changed values. Keep reset-to-default actions and every setting. Defaults can start collapsed; edited settings should show a visible changed-state summary. |
| Import and library | `DrumTool.tsx`, `useFileUpload`, `LibraryPage` | Add samples uses existing upload flow, with an import assignment preview supplied by robust import work. “Import OP-1 preset” remains explicit in the Add/import menu and uses `handleOP1PresetImport`. “Add unassigned samples” continues to use `handleAddUnassignedSample`. Replace global `window` file-input references with owned refs while touching these controls. |
| Multisample parity | `MultisampleTool.tsx`, `VirtualMidiKeyboard.tsx`, `MultisampleSampleTable.tsx`, `MultisamplePresetSettings.tsx`, `WaveformEditor.tsx` | Share shell/toolbar/view toggle but preserve pitched-key zone mapping, note detection, root-note editing, envelopes, global playmode/gain, loop-enabled/release and cut-at-loop-end settings. Selecting a mapped sample should identify its root note/zone. Do not reuse the drum editor as-is: it has no multisample loop-marker contract. |
| Creative tools | `RecordingModal.tsx`, existing `handleOpenRecording` / `handleSaveRecording` | Add `SliceWorkspace.tsx` and evolve the recorder to a take-review surface backed by dedicated processing/recording services. These are new behavior dependencies; do not ship decorative enabled buttons before their Apply/Cancel/error paths exist. |
| Onboarding | new `StudioEmptyState.tsx`, `FirstPresetGuide.tsx` | Call a generated-demo service and a single batch import/edit action. Keep presentation state independent of editable preset state. |
| Styles | `src/theme/device-themes.scss`, `src/index.css` plus new `src/styles/studio.css` | Add semantic tokens and focused component classes. Remove inline layout/color rules as components are touched rather than applying a page-wide inversion or broad `!important` patch. |

## Visual and responsive specification

Use the existing Nimbus Sans for compact headings and a native sans stack for labels/body; use tabular numerals or a system monospace for frames, time and dB. Body text 14–16 px, labels at least 13 px, controls at least 44 px in touch layouts. Use a 4/8 px spacing rhythm, 16–24 px panel padding, 8 px panel radius, and restrained shadows. Avoid the current repeated 15 px-radius cards inside cards and large introductory title taking priority over the instrument.

Suggested starting tokens (must be measured in rendered controls before claiming contrast compliance):

| Token | Light | Dark |
|---|---|---|
| Page | `#efeee8` | `#171917` |
| Panel | `#faf9f4` | `#222521` |
| Recess / pad well | `#e4e4dc` | `#2c302a` |
| Main text | `#20251f` | `#f3f3eb` |
| Muted text | `#596153` | `#b8c0b1` |
| Border | `#abb1a2` | `#66715d` |
| Accent | `#d0ef62` | `#d0ef62` |
| Accent text | `#20251f` | `#20251f` |

Use dark text on the vivid accent, not white. Add distinct focus outlines that remain visible on accent, panel and black/white keys. Theme attributes must cover body, portals, Carbon controls and canvas drawing. A CSS variable change does not redraw a canvas: pass a resolved palette/theme revision into its draw effect.

At 768–1099 px, stack waveform and sample controls while retaining the full instrument width. Below 768 px, show a labeled bank selector with 12 reachable drum slots per bank, large touch targets, selected-sample name and editor below. Keep both bank controls visible rather than relying on swipe discovery. Allow a Table view scroll region, with its own clear label and row actions; the whole page must not overflow horizontally. At 320–390 px and 200% zoom, basic naming, trim, playback, record, import and export remain usable in portrait. Zoom editing is an optional full-screen dialog with a close button, not a blocking rotate-device requirement.

## Risks and acceptance checks

| Risk found in current source | Required design/implementation response |
|---|---|
| Drum keyboard has document key handlers for A/S/D/F/G/H/J/W/E/R/Y/U and Z/X. It excludes input/textarea/contenteditable but not modifiers, select controls, dialogs or repeated events. | Central shortcut arbitration: Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo and any save shortcut cannot trigger a bank switch or sound. Scope audition to the active instrument workspace and suspend behind dialogs; ignore editable/select controls, IME composition and unsupported modifier chords. Keep keyup cleanup even after focus changes. |
| Settings modal installs a document-level P shortcut without a text-input guard. Multisample has another keyboard map. | One documented shortcut help sheet listing the current instrument map. P playback only in the appropriate active editor and outside text entry; do not assign bare R to record because drum R already plays CLP/COW. Enter/Space retain normal button behavior and never trigger twice from local and global handlers. |
| `DrumSampleSettingsModal` stores drafts and reinitializes on `[isOpen, sample, sampleIndex]`; opening can dispatch marker initialization. | Refactor draft lifetime carefully. Opening or selecting must not become a history edit or reset a live drag because autosave/state updates produced another sample reference. Modal and focused editor share normalized defaults without opening-time mutation. |
| Drum sample trim values are stored in seconds while `EnhancedWaveformEditor` receives frame indices; `WaveformEditor` also uses frames and its default end is length minus one. | Use a shared explicit time/frame adapter with the export/audio domain’s documented end convention. Do not copy numeric fields between editors without conversion. Include one-frame and final-frame boundary checks. |
| `App.tsx` forces Carbon `white`; CSS forces `color-scheme: light`; several headings/modals/canvases use hard-coded colors. | Verify both themes across all retained detailed dialogs, library/import screens, keyboard states, forms, waveform and notifications. A dark shell alone is not complete dark mode. |
| App rotate overlay can cover the screen without an obvious dismissal path; keyboard has custom sticky/resize behavior; MainTabs uses overflow clipping. | Make portrait editing functional, give every full-screen surface Close/Escape, and test actual sticky ancestors/scroll containers. Do not let project toolbar disappear due to an overflow-hidden ancestor or cover focused content. |
| Focus editor could hide unassigned items, organize actions, format settings, bulk editing or advanced multisample controls. | Maintain a capability checklist against both existing tools. Every existing action gets a named reachable location; advanced disclosures show changed values and retain state across view changes. |
| `handleFileUpload`, download and recording paths currently catch/log errors; full recordings can end with a console warning only. | Feed operation results into visible notifications/action states; avoid success toast or cleared review state on failure. Export preflight and take review close only after their real operation succeeds. |
| Autosave, library save and portable backup represent different guarantees. | Distinct labels, observable completion, revision-aware saved state, one save owner and recovery tests. Never derive “Saved” from having a name or a loaded sample. |

Acceptance walkthroughs: empty → demo → play → trim → undo/redo → name → preflight/export; external multi-file import → rejected-file feedback → assign/unassigned → Table/Focus round trip; record → review → cancel/apply including no empty pads; slice → sensitivity/manual markers → overflow → single undo; library and lossless backup restoration; keyboard-only and touch portrait workflows; light/dark with reduced motion. Test dialogs for focus trapping, Escape and focus return; stop held notes on pointer cancellation, blur, bank switch and dialog open. Contrast, target sizes and screen-reader behavior require measured browser evidence rather than a source-only claim.
