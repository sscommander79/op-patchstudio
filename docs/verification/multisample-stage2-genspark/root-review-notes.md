# Integration review notes on the in-progress patch
Recheck these against the final implementation before acting; the implementation writer may already be correcting them.

1. AutoSamplingPanel standalone renders BOTH connect Check note (aria-label Start note) and capture Start note. Duplicate labels break existing tests/accessibility. Preserve exactly one start-note control in standalone.
2. Connect currently has no Stop automatic capture while a check is running. Keep an explicit Stop check control available during permission/check/cancel cleanup; do not require closing/discarding the entire modal.
3. Check buffer is not accounted in retained usage or 256 MiB budget. Count actual buffer bytes and bounded in-flight check capture before MIDI. Avoid double-counting or retaining multiple checks; include parent CaptureSession usage while a check buffer exists. Do not change audio engines.
4. MIDI ports changed during an in-flight check can clear evidence then the check callback restores it for the same route key. Use a monotonic evidence generation token, not only route-key equality, and publish evidence only after owned cleanup completes. Test unchanged-output port change and cancellation while check completion/cleanup is pending.
5. Guided Review needs a visible Stop preview button for take audition, not only the hidden legacy control.
6. Preserve playback gating for legacy Enable MIDI, input and manual capture where appropriate; ensure existing 13 AutoSamplingPanel tests remain meaningful.
7. Parent onAudioDeviceChange must distinguish explicit user input choice from saved-profile restoration. Do not clear unresolved saved-input safeguards by incrementing user-selection version for automatic restore.
8. Do not claim all phase steps complete merely because an empty/failed capture navigated to Review. Empty failures stay actionable and accurate.

Root will run typecheck, lint, focused and full tests after writer handoff, then visual/browser verification.

## Fresh handoff checks
Root refreshed all readable source into the disclosed validation runtime. Typecheck initial draft passed. Handoff lint passed. Focused tests: 34 passed, 2 failed (both added guided tests cannot find Audition check note within waitFor timeout; inspect the real 1-second hold + 1-second tail versus default 1-second test timeout; prefer seeded zero timing or controlled clock, not weakened assertions). Duplicated Start note was fixed by writer by handoff.

Required correction pass: read these findings, fix confirmed remaining defects with native edits only, add meaningful regression coverage for check cancellation/invalidation during completion, budget accounting, pending audition close/Stop, commit rejection/partial, and compatibility. Review existing fake boundaries; avoid mocking away the behavior. Do not blanket reread full source/test files; inspect focused regions. Root owns verification. Report each numbered finding disposition. Do not change audio engines or storage.
