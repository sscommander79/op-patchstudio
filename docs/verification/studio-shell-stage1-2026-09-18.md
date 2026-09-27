# Studio shell and Help — stage 1

Status: implemented and verified in the working local preview on port 5188.

## Scope

Turn the accepted task-first prototype into the working app: Start, hardware/software setup choices, existing sampling/multisampling/drum editors, Library, backup/transfer guidance, and persistent searchable Help. Preserve current library storage, imports, project archives, recovery, theme selection, and device exports. No full-library backup implementation, native USB transfer, DSP changes, commits, or publication.

Sol owns implementation and focused regression tests. Root owns independent integration review and final verification. The preceding bounded Astra review is recorded in `studio-ux-adversarial-review-2026-09-18.md`.

## Acceptance

1. The working app visibly uses the accepted start/navigation design at desktop and narrow widths.
2. Multisample and Sample offer hardware/software as the second decision, and lead into the existing automatic/manual recording tools; drum creation and Library remain accessible.
3. Help is usable inside recording, preserves pending capture/review state, and restores focus. Contextual routing Help clears irrelevant search filters. Explanations dismiss with Escape.
4. New navigation does not silently discard unaccepted takes. Leaving unfinished recording requires an explicit decision.
5. Existing editable project archive and device export are clearly distinguished from planned full-library backup.
6. Existing source/library behavior remains covered by regression checks. No storage migrations or user data resets.

## Baseline

Before implementation, the existing assembled validation runtime passed `npm test -- --maxWorkers=2`: 81 files, 815 tests, exit 0. This is baseline evidence only.

The source worktree is `/Users/stevencommander/Desktop/AI/op-patchstudio-improved`, branch `codex/studio-upgrade`. Tests use `/tmp/opstudio-sep18-validation` because some original support/configuration files and dependencies are cloud-offloaded. Current source is copied with SHA-256 provenance; any saved-baseline fallback files must remain disclosed in final results. A readable source snapshot before this change is at `/tmp/opstudio-stage1-before` for independent diff inspection.

## Final results

- Integrated `npm run check` exited 0: typecheck, full lint, 81 test files / 816 tests, production build and PWA validation passed.
- After the final route-scroll/title adjustment and additional preservation test: typecheck and focused lint passed; root reran the recorder suite (21/21) and production build/PWA checks (exit 0). The full suite count above predates that additional test.
- Root ran seven production Chromium checks: five shell workflows plus the existing library and collections workflows. All passed, including manual/automatic/drum recorder entry, Help search and focus restoration, navigation blocking, narrow layout, management wording, library persistence and collection exports.
- Independent in-app browser inspection verified manual software setup, Help over recorder with Escape/focus restoration, desktop and 390px layouts, and light/dark rendering. Document width equals viewport width at 390px. The initial visual check found header scrolling; the correction was verified at scrollY=0 with no programmatic heading outline.
- New recorder integration coverage uses the actual StudioShell Help with a fake capture boundary: an unaccepted named take survives Help opening and closing, and the capture session is not disposed. Explicit discard/Resume behavior is also covered. Physical audio/MIDI and OP-XY transfer were not exercised.
- The final runtime contains 264 current SHA-256-verified files and 19 disclosed saved-baseline support/configuration fallbacks, with no application-source fallbacks. This preserves the existing cloud-offloaded originals.
- Updated port 5188 with the verified production build, retaining older hashed assets for existing tabs. The served index matched the final build byte-for-byte. Used the existing app update flow; restored the prior Studio Seed session and verified all 10 drum samples were present after updating. No library reset or storage migration.
- Changed sources/tests and previous served index have an incremental backup at `/Users/stevencommander/Library/Application Support/OPPatchStudio/Backups/20260918-studio-shell-stage1`. Evidence logs and provenance are in `studio-shell-stage1-evidence/`.

## Review finding disposition

1. Navigation preservation: guarded shell, existing tab and project-library navigation while recorder is open; Help does not replace the editor; closing unfinished recording requires explicit discard.
2. Tooltip dismissal: faulty prototype hover tooltips were not copied. Production contextual explanations use the owned Help dialog with Escape and focus restoration.
3. Stale contextual Help: new Help mounts clear search; changing topic also clears it.
4. Favorites: existing functional LibraryPage was retained, avoiding the prototype attribute mismatch. Prototype remains an archived design reference; its filter was not shipped.
5. Backup distinctions: management and Help explain browser library saves, editable project archives and device ZIPs; full-library backup is explicitly unavailable.
6. Drum progress: no synthetic stepper was copied. The stage 1 setup goes directly to the existing drum tools; a complete task-specific wizard remains stage 2.

## Scope boundary

This delivers stage 1 interface and Help integration. Full guided capture/edit/save workflows, complete library backup/restore, and direct device transfer remain future stages. No commits, pushes or public deployment were made.
