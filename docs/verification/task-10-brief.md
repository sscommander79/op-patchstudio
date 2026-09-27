# Task 10: independent whole-branch review and delivery audit

Run only after Task1–9 implementation and scoped review closure. Workspace /Users/stevencommander/Desktop/AI/op-patchstudio-improved; base b669b7c57937bb74b887774a9ca73b5d4a81afed; branch codex/studio-upgrade. No commits, pushes, merges, publication or additional agents. All source changes remain uncommitted by instruction; controller provides one whole-working-tree review package including untracked source files.

## Review contract
Read design spec, acceptance matrix, task reports and ledger rulings. Verify both overall spec compliance and code quality. Account for every requirement and every prior Important finding; accepted limitations are explicit, not silently reclassified as complete.

Prioritize cross-feature integration: undo/redo versus async imports/recording/autosave; cache immutability versus destructive audio edits; new sample fields surviving archive/library/recovery; sparse assignments and overflow surviving slicing and export; loop/trim/resampling and WAV/AIFF endpoint truth; cancellation/microphone/note/pointer cleanup; keyboard dialog ownership; project archive validation before state change; large-input memory bounds; complete dark/mobile workflows; actual production offline import/edit/save/export; and truthful save/export error status.

Use existing high-value tests and independent adversarial fixtures where evidence is missing. Do not recreate all broad suites redundantly when controller just verified them unless source changes or a concrete concern justify it. Do not equate test count, mocked response or a downloaded file with physical hardware success. No microphone or OP-XY attached hardware is assumed. Report unperformed hardware validation as such.

Report concrete actionable findings with severity, exact file/line, trigger, impact and evidence. Distinguish confirmed regressions, incomplete requirements, inherited out-of-scope issues and optional follow-ups. Avoid style-only churn or repeating already accepted preview limitations as defects. Check retained license and source attribution, runnable scripts, documentation truthfulness and dependency disposition.

Write task-10-review.md with both verdicts, requirement mapping, validation performed, limitations and any findings. Controller will dispatch one combined final fix wave and one scoped re-review; no autonomous integration. The final delivery must identify the fork/worktree, working branch, complete validation results, remaining limits and review evidence. No acquisition/endorsement/perfection claim.

## Specific cross-feature admission seam to verify
Task7 now validates complete current manifest metadata before accepting patch settings. Later audio mutations can add sample references while retaining near-limit raw preset JSON. An audio-only capacity helper with a reserved2MiB manifest allowance does not prove the actual JSON stays within2MiB. Exercise near-limit accepted raw settings followed by import/slice/record/demo commits and confirm each successful candidate still supports its own portable archive. Task8 demo was explicitly asked to call the shared zero-PCM metadata validator; inspect earlier creative commit paths too. Use small buffers and bounded raw strings, not large audio allocation, and distinguish an actual reproduced failing candidate from a source-only hypothesis.
