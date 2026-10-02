# Control-site exceptions and coverage limits

The current static inventory has 583 sites. 556 have passing, current-source execution records. Of 26 sites in modules not imported by the app entry, two are exercised by unit tests and 24 have no execution. The other three unexecuted sites are unrendered or orphaned legacy controls. The remaining 554 app-reachable control sites have execution evidence. This establishes an interaction map, not proof of every state, gesture or function.

| Source site | Disposition |
|---|---|
| src/components/common/FileDropZone.tsx:100:7 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/common/FileDropZone.tsx:109:7 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/common/FileDropZone.tsx:124:13 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/common/GeneratePresetSection.tsx:118:13 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/common/GeneratePresetSection.tsx:172:15 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/common/GeneratePresetSection.tsx:253:23 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/common/GeneratePresetSection.tsx:285:19 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/common/GeneratePresetSection.tsx:408:11 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/common/GeneratePresetSection.tsx:449:11 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/common/GeneratePresetSection.tsx:484:11 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/common/GeneratePresetSection.tsx:525:11 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/common/WaveformEditor.tsx:321:9 | Unrendered legacy component. App imports only registerOverlayControl; no production JSX renders WaveformEditor. Active editors are EnhancedWaveformEditor and WaveformZoomModal. |
| src/components/common/WaveformEditor.tsx:346:7 | Unrendered legacy component. App imports only registerOverlayControl; no production JSX renders WaveformEditor. Active editors are EnhancedWaveformEditor and WaveformZoomModal. |
| src/components/drum/DrumKeyboard.tsx:468:7 | Orphan hidden input. fileInputRef has no click/focus trigger; selected-pad Add sample uses the focus editor input. Retained rather than deleting unrelated legacy code. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:155:7 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:190:17 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:202:17 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:231:17 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:281:17 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:301:17 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:321:17 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:341:17 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:361:17 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:391:17 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:410:17 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:439:15 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |
| src/components/multisample/MultisampleAdvancedSettings.tsx:453:13 | Dormant module: no static import path from src/main.tsx. No runtime pass claimed. |

Function coverage remains a separate unresolved requirement: 781 production V8 entries have no unit execution; browser execution is not merged into that report. Fable completed a read-only triage of 34 named functions; see function-gap-triage.md. Its two meaningful storage gaps now have 25 passing real-browser checks. This does not classify every anonymous function-map entry.

The earlier audition failures are retained. A later native Chromium trace established an actual audio-curve overlap race; the fix now has failing-before/passing-after unit and browser regressions. Final production matrix: 608 passed / 42 documented skips / zero failures. See audio-clock-regression.md for the explicit Firefox injection exception and earlier WebKit folder-timeout disposition. No physical-device or exhaustive state/function claim is made.
