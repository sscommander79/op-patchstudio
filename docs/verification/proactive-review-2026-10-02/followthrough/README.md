# OPXY continuation verification — 2026-10-02

Status: functional verification PASS; saved visual baselines PASS after the user-authorized follow-up reconciliation. Deferred issues, remote CI and human/hardware acceptance remain outstanding. No release/design approval or exhaustive-coverage claim.

## Visual reconciliation follow-up

The user subsequently requested “please fix those open mismatches”. All 12 references were reviewed and refreshed to retain the existing appearance selector and column-responsive waveform layout. The semantic gate passed 27 tests; two fresh visual runs with updates disabled each passed all 12. No application source or test tolerances changed. See [review and evidence](visual-reconciliation/README.md). Earlier failure records below are retained as historical evidence.

## Scope and preserved state

Resumed `.planning/OPXY-HANDOFF-2026-10-02.md` in the authoritative checkout, branch `codex/studio-upgrade`, HEAD `dc1e1f3515e2f2054f83b7507e1e71951f5ee80e`. Initial status count: 151; final count: 156. No commit, push, deployment, dependency installation, baseline update, or physical-device action. Existing source/test WIP and the two duplicate artifacts were preserved.

The existing Chrome tab on port 5191 was inspected without navigation/reload before and after edits. Human Test 04 remained at 11/24 loaded, Pad 4 `Take 1.opfloat`, out point 5.658666666666667, zero Unassigned sounds, and no slicing modal. The previously discarded 17-sound draft is not recoverable work in progress. No fixture used the user's kit. A later final readback attempt could not run because the Chrome extension connection became unavailable; the last successful readback above is the verified live state, not a claim about any subsequent user changes.

## Findings and dispositions

| Finding | Disposition | Evidence |
| --- | --- | --- |
| Devices immediate deletion / assertive success notices | Prior pass repair retained; success focus repaired in this continuation | Delete/Keep, storage failure/retry, byte-silence and focus regressions; success focuses Saved setups, failed persistence returns to Delete |
| Recorder discard ownership and short-viewport actions | Prior repair retained; browser fixture waits for a measured non-zero synthetic input level before Stop | Recording tests across five profiles; isolated 390×500 and 1280×500 geometry/focus/Resume/discard |
| Virtual keyboard access | Completed roving focus and activation checks | All five profiles pass arrow navigation, edge clamping and visible focus; unit tests cover modified/repeated keys |
| Virtual note lifetime | Repaired focused/physical/pointer cleanup on blur, deactivation and unmount, plus touch cancellation | `resume-red.log`, `resume-pointer-red.log`, focused GREEN logs |
| Pointer merely passing over a key cuts another input's note | Repaired by releasing only a pointer-owned note | Physical-key ownership regression |
| Assistive activation releases before async startup | Repaired; assistive activation awaits startup, then releases | `resume-async-red.log`, final unit gate |
| Release/unmount during async audio initialization | Repaired at MultisampleTool ownership boundary using existing playback cancellation signal | `resume-pending-start-red.log`, 60 affected tests pass; actual audio-hook acquisition/abort test retained |
| F4 busy keyboard Undo/Redo | Prior pass repair retained | Delayed import and post-import Undo regression in final standard gate |
| F6 Library preview read failure wording | Prior pass repair retained | Storage-read failure regression in final standard gate |
| F5 recovery focus ownership | Reproduced pending-buttons focus escape, repaired with owned dialog and focusable pending container | RED/GREEN recovery logs; explicit Escape-no-discard and focus wrapping tests; storage suite |
| F3 dormant format filters | No current reachable defect reproduced; no code change | Document-capture external import handler intercepts these routes; read-only review agrees; latent maintenance risk retained |
| F7 queued capture-message ordering | Theoretical concern, no harmful current ordering reproduced; no code change | Static review and existing capture/recording tests; not asserted impossible |
| HV001 Table clipping / HV004 actual Safari artwork | DEFERRED by user | Not reopened; passing unrelated geometry tests do not close these issues |
| Saved visual snapshots | RESOLVED in authorized follow-up | All 12 fail against saved baselines; current screenshots are byte-identical to pre-resume screenshots with shared fonts available. See `visual-final-baseline-comparison.json` and [visual comparison index](visual-review.md). The later follow-up refreshed all 12 after review; two update-disabled runs passed. See `visual-reconciliation/README.md`. |

## Verification matrix

| Check | Status | Result / evidence |
| --- | --- | --- |
| Standard integrated gate | PASS | `resume-final-check-3.log`: 1,172 tests / 111 files, typecheck, lint, build, PWA; three existing lint warnings and build/dependency warnings |
| Focused recorder + virtual keyboard browser checks | PASS | `resume-focused-browser.log`: 25 across Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari; before final pending-start forwarding change |
| Final production browser matrix | PASS | `resume-complete-production.log`: 783 passed, 42 documented skips, zero failures; all five profiles, exit 0 |
| Recorder valid-input reliability | PASS | `resume-nonzero-recording-repeats.log`: 50, five repetitions at both sizes across five profiles |
| Storage/recovery integration | PASS | `resume-verified-storage.log`: 25 across five profiles, including failed replacement, precision, stale revision and focus recovery |
| Explicit synthetic recording / auto-sampling / guided capture | PASS | `resume-verified-fake-recording.log`: 5 Chromium cases; generated audio and fake MIDI only |
| Explicit synthetic stem capture/export | PASS | `resume-verified-stem.log`: 1; real worklet, reviewed WAVs and ZIP, fake devices |
| Stale development-origin worker recovery | PASS | `resume-dev-origin.log`: 1; project data preserved, no forced tab reload |
| Visual snapshots, updates disabled | PASS after reconciliation | `visual-reconciliation/verify-1.log` and `verify-2.log`: 12 passed each; earlier `resume-final-visual.log` retains the historical mismatch evidence |
| Read-only Genspark Sol review | PASS within limited scope | Initial review + two follow-ups; last `resume-sol-cancellation-review.txt` reports startup race resolved and no material residual directly caused by edits. Static review, no reviewer-run tests; route banner is not provider attestation |
| Remote CI | BLOCKED / UNEXECUTED | No push authorization; local checks do not establish remote CI |
| Listening, actual assistive technology, physical MIDI/OP-XY | HUMAN/HARDWARE PENDING | See checklist below |

The appearance-state test now polls the original contrast thresholds through the existing colour transition; no threshold was weakened. Both corrected flows passed 30 repeated checks across five profiles (`resume-timing-regressions.log`); final edited browser-test lint also passes.

The slicing round-trip fixture also now waits for naturally completed short previews rather than racing a Stop click against completion; the longer preview still explicitly tests Stop. Its final corrected-flow checks are recorded below.

Earlier runs remain evidence, not final passes: first full matrix had 777 passed, 42 skipped, one recorder fixture timing failure. Elapsed frames alone later proved insufficient for WebKit startup silence; the final fixture waits for a measured non-zero generated burst, preserving the intended all-silent-take discard policy. The next matrix was deliberately stopped when follow-up review identified the pending-start race. The second completed matrix had 781 passed, 42 skipped and two timing-sensitive fixture failures (short-slice Stop and mid-transition colour measurement). A further run had 782 passed, 42 skipped and the recorder startup-silence fixture failure. That fixture now waits for observed non-zero input, with 50 repeated passes. The final run uses the finished build and all corrected fixtures. Visual diagnosis also includes an interrupted temporary baseline-server run with a canonical-path allow-list error; it is not a product defect.

The 42 browser skips are explicit: 25 cases require the dedicated fake-device configurations (those workflows ran separately in Chromium), 16 are desktop-only cases excluded from mobile profiles with separate narrow checks, and one Firefox synchronous audio-clock injection is inapplicable because its clock is task-stable. `browser-skips.json` lists every case.

No new function/control-site coverage census was run. Existing scenario suites exercise major workspaces and shared controls, but do not prove all states, branches, touch hardware, or assistive technologies. Physical MIDI-held note behavior is not certified by computer-key/pointer regressions.

## Remaining acceptance

1. Human Test 04: reopen a fresh slice draft, judge actual voice boundaries/audition and occupied-pad/unassign clarity, then apply/export and verify OP-XY playback. Cancel should preserve the 11-pad kit if the user does not want the result.
2. Actual screen-reader experience and physical touch interactions; synthetic activation and browser focus checks are supporting evidence only.
3. Physical MIDI routing, recording and device transfer outside previously user-confirmed Human Tests 01–03. Those earlier passes remain user reports, not new hardware verification.
4. Review the existing appearance changes against all 12 saved visual baselines before separately authorizing any baseline update. This is a computer-verifiable gate awaiting design/baseline authorization, not a listening-only check.
5. HV001/HV004 remain explicitly deferred. Remote CI remains unexecuted without a separately authorized push.

The exact pre-resume source/test baseline is recorded in `resume-source-manifest.json`; `resume-review.diff` attributes only this continuation. The prior pass's `review.diff` remains separate. All changes remain uncommitted.

Final process state: all task-started reviewers and test servers stopped. Existing preview5191 remains running (PID81379). No production source changed after the final standard gate; later edits only stabilized browser fixtures and documentation.
