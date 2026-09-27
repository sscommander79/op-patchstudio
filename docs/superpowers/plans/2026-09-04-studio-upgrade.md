# Studio Upgrade Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task. Read the scoped task brief and the design spec. Do not commit or spawn additional agents.

**Goal:** Deliver all improvements in the approved review as a coherent, dependable OP-XY creation studio.
**Architecture:** Evolve existing React application around tested export planning, transactional project persistence, shared immutable audio and reversible edit commands. Integrate creative tools in a focused pad/keyboard workspace.
**Tech Stack:** React, TypeScript, Web Audio, IndexedDB, JSZip, Vitest and Playwright.
**Spec:** docs/superpowers/specs/2026-09-04-studio-upgrade-design.md

## Global Constraints
- Work only in /Users/stevencommander/Desktop/AI/op-patchstudio-improved on codex/studio-upgrade.
- No commits, pushes, merges, publication or external account changes.
- Preserve source/license attribution and current working import/export capabilities.
- Write meaningful failing regressions before production changes.
- Real archives, browser storage and user interactions are acceptance evidence; mocked internals alone are insufficient.
- No unverified hardware compatibility or official affiliation claims.
- Retain all ten design requirements; incomplete work stays explicitly tracked.

## Task 1: Reliable export
**Files:** src/utils/patchGeneration.ts; src/utils/jsonImport.ts if needed; new src/utils/exportPlanning.ts; src/test/utils/exportIntegrity.test.ts; existing affected export tests.
**Consumes:** AppState, existing audio conversion/export functions.
**Produces:** Correct ZIP and patch.json from generateDrumPatch/generateMultisamplePatch with unchanged public signatures. Shared unique filename planning and archive preflight helpers if needed.
- [x] Establish failing tests: sparse keys 0/5 yield 53/58; two different hit.wav inputs yield distinct members and references; conversion rejection rejects entire generation; importedDrumPreset.fx.active survives; all references exist; sanitize collisions and extension conversion collisions remain distinct.
- [x] Run focused tests and record the observed failures.
- [x] Replace MIDI counter with slot mapping; resolve all output names once with a deterministic case-insensitive collision allocator shared by region and archive writing; include loaded unassigned samples under unique names to preserve existing behavior.
- [x] Await export promises, propagate contextual conversion failures, use real output frame counts and validate marker bounds. Avoid baking gain and applying it a second time in patch metadata; characterize existing contract before altering.
- [x] Correct imported state key; validate actual archive contract through real JSZip. Replace placeholder export assertions with useful cases.
- [x] Focused checks, full unit suite and build; independent scoped review.

## Subsequent deliverables (expand each scoped task before dispatch)
- [x] Task 2: atomic serialized autosave, lossless library audio, complete restore, visible save failures; real failure and round-trip regressions.
- [x] Task 3: portable versioned project backup/import and bounded undo/redo, with state/history integration tests.
- [x] Task 4: loop editor crossfade/playhead/drag robustness, preview calibration research and compatibility fixtures.
- [x] Task 5: slicing and manual chop with preview, adjustment and reversible pad assignment.
- [x] Task 6: batch and sound-triggered recording with pre-roll/take review and cleanup tests.
- [x] Task 7: robust multi-source imports and intelligent drum assignment, evaluated against PR #113.
- [x] Task 8: coherent selected-pad workspace, onboarding/demo, dark mode and responsive accessible polish.
- [x] Task 9: whole-suite quality, performance/offline improvements, documentation and CI gates.
- [x] Task 10: independent final review and requirement-by-requirement browser/audio/hardware verification ledger.

Tasks 2-8 share state interfaces: execute implementations sequentially; research and scoped review may run alongside independent controller documentation/test infrastructure work. Each later task will receive its own detailed test and interface brief based on current code rather than speculative APIs.
